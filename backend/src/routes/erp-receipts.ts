import { Router } from 'express';
import { pool } from '../config/database';
import { requireAuth, requireRole } from '../middleware/requireAuth';

const router = Router();
router.use(requireAuth);

const SELECT = `
  r.id, r.numero, r.contract_id AS "contractId", r.competencia,
  r.data_emissao AS "dataEmissao", r.data_vencimento AS "dataVencimento",
  r.valor, r.pago, r.snapshot, r.pdf_gerado_em AS "pdfGeradoEm", r.created_at AS "createdAt",
  r.forma_pagamento AS "formaPagamento", r.data_pagamento AS "dataPagamento",
  r.valor_pago AS "valorPago", r.status,
  r.cancelado_em AS "canceladoEm", r.motivo_cancelamento AS "motivoCancelamento",
  c.numero AS "contractNumero",
  c.dia_vencimento AS "diaVencimento",
  c.valor_mensal AS "valorMensal",
  c.ativo AS "contractAtivo",
  c.renovacao_automatica AS "renovacaoAutomatica",
  emp.razao_social AS "companyRazaoSocial", emp.cnpj AS "companyCnpj",
  cu.customer_name AS "customerName", cu.document AS "customerDocument"
`;

const competenciaAtual = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

router.get('/', async (req, res) => {
  try {
    const { contractId, competencia, pago } = req.query as any;
    const conds: string[] = [];
    const params: any[] = [];
    if (contractId) { params.push(contractId); conds.push(`r.contract_id = $${params.length}`); }
    if (competencia) { params.push(competencia); conds.push(`r.competencia = $${params.length}`); }
    if (pago === 'true')  conds.push(`r.pago = TRUE`);
    if (pago === 'false') conds.push(`r.pago = FALSE`);
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const r = await pool.query(
      `SELECT ${SELECT}
         FROM erp_receipts r
         JOIN erp_contracts c ON c.id = r.contract_id
         LEFT JOIN erp_companies emp ON emp.id = c.company_id
         LEFT JOIN customers cu ON cu.id = c.customer_id
         ${where}
         ORDER BY r.data_emissao DESC, r.created_at DESC LIMIT 1000`,
      params
    );
    res.json(r.rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Pendentes: contratos ativos que ainda não têm recibo na competência informada (default = mês atual)
router.get('/pending', async (req, res) => {
  try {
    const competencia = String((req.query as any).competencia || competenciaAtual());
    // [#6 alto] usa o ÚLTIMO dia do mês da competência como corte (e não dia 28
    // fixo, que excluía contratos iniciados em 29/30/31).
    const r = await pool.query(
      `SELECT c.id AS "contractId", c.numero AS "contractNumero",
              c.valor_mensal AS "valorMensal", c.dia_vencimento AS "diaVencimento",
              c.data_inicio AS "dataInicio",
              c.renovacao_automatica AS "renovacaoAutomatica",
              c.company_id AS "companyId", c.customer_id AS "customerId",
              emp.razao_social AS "companyRazaoSocial", emp.cnpj AS "companyCnpj",
              cu.customer_name AS "customerName", cu.document AS "customerDocument"
         FROM erp_contracts c
         LEFT JOIN erp_companies emp ON emp.id = c.company_id
         LEFT JOIN customers cu ON cu.id = c.customer_id
        WHERE c.ativo = TRUE
          AND c.data_inicio <= (date_trunc('month', ($1 || '-01')::date)
                                + INTERVAL '1 month - 1 day')::date
          AND NOT EXISTS (
             SELECT 1 FROM erp_receipts r
              WHERE r.contract_id = c.id AND r.competencia = $1
          )
        ORDER BY c.dia_vencimento ASC`,
      [competencia]
    );
    res.json({ competencia, pendentes: r.rows });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});


// Gera (ou regera) recibo da competência. Se já existir, atualiza valor e marca regerado.
router.post('/generate', async (req, res) => {
  const { contractId, competencia: comp, valor, pago = true, regerar = false } = req.body || {};
  if (!contractId) return res.status(400).json({ error: 'contractId obrigatório' });
  const competencia = comp || competenciaAtual();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const contractRes = await client.query(
      `SELECT c.*, emp.razao_social AS company_razao_social, emp.cnpj AS company_cnpj,
              emp.endereco AS company_endereco, emp.cidade AS company_cidade,
              emp.estado AS company_estado, emp.cep AS company_cep,
              emp.telefone AS company_telefone, emp.email AS company_email,
              emp.logo_url AS company_logo_url, emp.logo_dataurl AS company_logo_dataurl,
              emp.assinatura_url AS company_assinatura_url,
              emp.inscricao_estadual AS company_ie,
              cu.customer_name, cu.document AS customer_document, cu.address AS customer_address,
              cu.numero AS customer_numero, cu.bairro AS customer_bairro,
              cu.cidade AS customer_cidade, cu.estado AS customer_estado, cu.cep AS customer_cep
         FROM erp_contracts c
         LEFT JOIN erp_companies emp ON emp.id = c.company_id
         LEFT JOIN customers cu ON cu.id = c.customer_id
        WHERE c.id = $1`,
      [contractId]
    );
    if (!contractRes.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'contrato não encontrado' }); }
    const ct = contractRes.rows[0];

    const existing = await client.query(
      `SELECT id, numero, snapshot FROM erp_receipts WHERE contract_id=$1 AND competencia=$2`,
      [contractId, competencia]
    );

    // [#10 alto] regerar um recibo NÃO deve duplicar o frete: ao regerar,
    // reutilizamos o freteIncluso que já estava no snapshot original.
    const freteCt = Number(ct.frete || 0);
    let isPrimeiro = false;
    let freteAplicado = 0;

    if (existing.rows[0]) {
      // Regeração — preserva a decisão original sobre o frete.
      const snap = existing.rows[0].snapshot || {};
      freteAplicado = Number(snap.freteIncluso || 0);
      isPrimeiro = !!snap.primeiroRecibo;
    } else {
      // Nova competência — é o primeiro se ainda não há outro recibo do contrato.
      const totalRecibos = await client.query(
        `SELECT COUNT(*)::int AS n FROM erp_receipts WHERE contract_id=$1`,
        [contractId]
      );
      isPrimeiro = (totalRecibos.rows[0]?.n || 0) === 0;
      freteAplicado = (isPrimeiro && freteCt > 0) ? freteCt : 0;
    }

    const baseValor = Number(valor ?? ct.valor_mensal ?? 0);
    const valorFinal = baseValor + freteAplicado;

    // [#21 médio] Vencimento da competência — respeita dia_vencimento mesmo > 28,
    // limitando ao último dia real do mês quando necessário.
    const [ano, mes] = competencia.split('-').map(Number);
    const ultimoDia = new Date(ano, mes, 0).getDate(); // dia 0 do mês seguinte
    const dia = Math.min(Math.max(1, Number(ct.dia_vencimento || 10)), ultimoDia);
    const dataVenc = `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;


    const snapshot = {
      contract: {
        numero: ct.numero, descricao: ct.descricao,
        dataInicio: ct.data_inicio, valorMensal: ct.valor_mensal,
        diaVencimento: ct.dia_vencimento,
      },
      company: {
        razaoSocial: ct.company_razao_social, cnpj: ct.company_cnpj,
        endereco: ct.company_endereco, cidade: ct.company_cidade,
        estado: ct.company_estado, cep: ct.company_cep,
        telefone: ct.company_telefone, email: ct.company_email,
        inscricaoEstadual: ct.company_ie,
        logoUrl: ct.company_logo_url, logoDataUrl: ct.company_logo_dataurl,
        assinaturaUrl: ct.company_assinatura_url,
      },
      customer: {
        name: ct.customer_name, document: ct.customer_document,
        address: ct.customer_address, numero: ct.customer_numero,
        bairro: ct.customer_bairro, cidade: ct.customer_cidade,
        estado: ct.customer_estado, cep: ct.customer_cep,
      },
      os: ct.os_id ? { id: ct.os_id } : null,
      valorLocacao: baseValor,
      freteIncluso: freteAplicado,
      primeiroRecibo: isPrimeiro,
    };

    if (existing.rows[0]) {
      if (!regerar) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Recibo desta competência já existe', existing: existing.rows[0] });
      }
      await client.query(
        `UPDATE erp_receipts SET valor=$2, pago=$3, snapshot=$4, data_vencimento=$5, pdf_gerado_em=NOW()
           WHERE id=$1`,
        [existing.rows[0].id, valorFinal, !!pago, snapshot, dataVenc]
      );
      await client.query('COMMIT');
      return res.json({ ok: true, id: existing.rows[0].id, numero: existing.rows[0].numero, regerado: true });
    }

    const numRes = await client.query(`SELECT erp_next_doc_number('REC') AS num`);
    const numero = numRes.rows[0].num;

    const ins = await client.query(
      `INSERT INTO erp_receipts
         (numero, contract_id, competencia, data_emissao, data_vencimento, valor, pago, snapshot, pdf_gerado_em)
       VALUES ($1,$2,$3,CURRENT_DATE,$4,$5,$6,$7,NOW())
       RETURNING id, numero`,
      [numero, contractId, competencia, dataVenc, valorFinal, !!pago, snapshot]
    );

    await client.query('COMMIT');
    res.json({ ok: true, ...ins.rows[0] });
  } catch (e: any) {
    await client.query('ROLLBACK');
    console.error('[erp-receipts generate]', e);
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

/**
 * PATCH /:id/pago
 * Atualiza status de pagamento. Aceita:
 *  - { pago: boolean }                            (compat antigo)
 *  - { status, formaPagamento, dataPagamento, valorPago }   (rico)
 * Calcula status automaticamente:
 *   valorPago >= valor          → 'pago'
 *   0 < valorPago < valor       → 'parcial'
 *   valorPago == 0 ou null      → 'aberto'
 */
router.patch('/:id/pago', async (req, res) => {
  try {
    const { pago, formaPagamento, dataPagamento, valorPago, status: statusIn } = req.body || {};
    const cur = await pool.query('SELECT valor, status FROM erp_receipts WHERE id=$1', [req.params.id]);
    if (!cur.rows[0]) return res.status(404).json({ error: 'Recibo não encontrado' });
    if (cur.rows[0].status === 'cancelado') {
      return res.status(409).json({ error: 'Recibo cancelado — não pode ser pago.' });
    }

    const totalValor = Number(cur.rows[0].valor || 0);
    let finalValorPago: number | null = null;
    let finalStatus = statusIn as string | undefined;

    if (valorPago !== undefined && valorPago !== null) {
      finalValorPago = Math.max(0, Number(valorPago));
    } else if (typeof pago === 'boolean') {
      finalValorPago = pago ? totalValor : 0;
    }

    if (!finalStatus) {
      if (finalValorPago == null) finalStatus = undefined;
      else if (finalValorPago <= 0) finalStatus = 'aberto';
      else if (finalValorPago + 0.005 >= totalValor) finalStatus = 'pago';
      else finalStatus = 'parcial';
    }

    const finalPagoBool = finalStatus === 'pago';
    const finalDataPag  = (finalStatus === 'aberto') ? null : (dataPagamento || new Date().toISOString().slice(0, 10));

    await pool.query(
      `UPDATE erp_receipts
          SET status           = COALESCE($2, status),
              pago             = $3,
              valor_pago       = $4,
              forma_pagamento  = COALESCE($5, forma_pagamento),
              data_pagamento   = $6
        WHERE id = $1`,
      [
        req.params.id,
        finalStatus || null,
        finalPagoBool,
        finalValorPago,
        formaPagamento || null,
        finalDataPag,
      ]
    );
    res.json({ ok: true, status: finalStatus, valorPago: finalValorPago });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /:id/cancel — marca recibo como cancelado preservando histórico
router.post('/:id/cancel', async (req, res) => {
  try {
    const { motivo } = req.body || {};
    if (!motivo || !String(motivo).trim()) {
      return res.status(400).json({ error: 'motivo é obrigatório' });
    }
    const cur = await pool.query('SELECT status FROM erp_receipts WHERE id=$1', [req.params.id]);
    if (!cur.rows[0]) return res.status(404).json({ error: 'Recibo não encontrado' });
    if (cur.rows[0].status === 'cancelado') {
      return res.status(409).json({ error: 'Recibo já está cancelado.' });
    }
    await pool.query(
      `UPDATE erp_receipts
          SET status = 'cancelado',
              pago = FALSE,
              cancelado_em = NOW(),
              motivo_cancelamento = $2
        WHERE id = $1`,
      [req.params.id, String(motivo).trim()]
    );
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /summary?months=12 — série mensal para gráfico
router.get('/summary', async (req, res) => {
  try {
    const months = Math.min(36, Math.max(1, Number((req.query as any).months) || 12));
    // Recebidos (recibos com status pago/parcial) por competência
    const recR = await pool.query(
      `WITH meses AS (
         SELECT to_char(date_trunc('month', CURRENT_DATE) - (i || ' months')::interval, 'YYYY-MM') AS competencia
           FROM generate_series(0, $1 - 1) AS i
       )
       SELECT m.competencia,
              COALESCE(SUM(CASE WHEN r.status IN ('pago','parcial')
                                THEN COALESCE(r.valor_pago, r.valor, 0)
                                ELSE 0 END), 0) AS recebido,
              COALESCE(SUM(CASE WHEN r.status = 'aberto'
                                THEN r.valor ELSE 0 END), 0) AS aberto
         FROM meses m
         LEFT JOIN erp_receipts r ON r.competencia = m.competencia
        GROUP BY m.competencia
        ORDER BY m.competencia ASC`,
      [months]
    );

    // Gastos (manuais + manutenção) por mês
    const gR = await pool.query(
      `WITH meses AS (
         SELECT to_char(date_trunc('month', CURRENT_DATE) - (i || ' months')::interval, 'YYYY-MM') AS competencia,
                date_trunc('month', CURRENT_DATE) - (i || ' months')::interval AS ini,
                (date_trunc('month', CURRENT_DATE) - (i || ' months')::interval + INTERVAL '1 month - 1 day')::date AS fim
           FROM generate_series(0, $1 - 1) AS i
       ),
       manuais AS (
         SELECT to_char(date_trunc('month', data), 'YYYY-MM') AS competencia,
                COALESCE(SUM(valor),0) AS total
           FROM erp_expenses GROUP BY 1
       ),
       manut AS (
         SELECT to_char(date_trunc('month', COALESCE(m.completed_date, m.maintenance_date, m.created_at::date)), 'YYYY-MM') AS competencia,
                COALESCE(SUM(m.cost),0) AS total
           FROM maintenance_records m
          WHERE COALESCE(m.cost,0) > 0
          GROUP BY 1
       )
       SELECT m.competencia,
              COALESCE(ma.total,0) + COALESCE(mn.total,0) AS gasto
         FROM meses m
         LEFT JOIN manuais ma ON ma.competencia = m.competencia
         LEFT JOIN manut   mn ON mn.competencia = m.competencia
        ORDER BY m.competencia ASC`,
      [months]
    );

    const map = new Map<string, any>();
    recR.rows.forEach((r: any) => map.set(r.competencia, {
      competencia: r.competencia,
      recebido: Number(r.recebido) || 0,
      aberto: Number(r.aberto) || 0,
      gasto: 0,
    }));
    gR.rows.forEach((g: any) => {
      const row = map.get(g.competencia) || { competencia: g.competencia, recebido: 0, aberto: 0, gasto: 0 };
      row.gasto = Number(g.gasto) || 0;
      map.set(g.competencia, row);
    });
    const series = Array.from(map.values())
      .sort((a, b) => a.competencia.localeCompare(b.competencia))
      .map(r => ({ ...r, resultado: r.recebido - r.gasto }));
    res.json({ series });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', requireRole('admin','manager'), async (req, res) => {
  try {
    // [#24] não permitir deletar recibo pago sem flag explícita (?force=1).
    // Mantém histórico financeiro auditável.
    const force = String((req.query as any).force || '') === '1';
    const cur = await pool.query('SELECT pago FROM erp_receipts WHERE id=$1', [req.params.id]);
    if (!cur.rows[0]) return res.status(404).json({ error: 'Recibo não encontrado' });
    if (cur.rows[0].pago && !force) {
      return res.status(409).json({ error: 'Recibo pago — confirme a exclusão (force=1) para remover.' });
    }
    await pool.query('DELETE FROM erp_receipts WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
