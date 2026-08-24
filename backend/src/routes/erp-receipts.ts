import { sendError } from '../utils/apiError';
import { parsePagination, sendPaginated } from '../utils/pagination';
import { Router } from 'express';
import { pool } from '../config/database';
import { requireAuth, requireRole } from '../middleware/requireAuth';
import { logger } from '../utils/logger';

const router = Router();
router.use(requireAuth);

// Papéis autorizados a mutar recibos (gerar, marcar pago, cancelar, reabrir).
const FIN_ROLES = ['admin', 'manager'] as const;


const SELECT = `
  r.id, r.numero, r.company_id AS "companyId", r.contract_id AS "contractId", r.competencia,
  r.periodo_inicio AS "periodoInicio", r.periodo_fim AS "periodoFim",
  r.data_emissao AS "dataEmissao", r.data_vencimento AS "dataVencimento",
  r.valor, r.pago, r.snapshot, r.pdf_gerado_em AS "pdfGeradoEm", r.created_at AS "createdAt",
  r.forma_pagamento AS "formaPagamento", r.data_pagamento AS "dataPagamento",
  r.valor_pago AS "valorPago", r.status,
  r.cancelado_em AS "canceladoEm", r.motivo_cancelamento AS "motivoCancelamento",
  COALESCE(r.sem_validade, FALSE) AS "semValidade",
  r.numero_display AS "numeroDisplay",
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
    const {
      contractId, competencia, pago, from, to,
      status, companyId, search, semValidade,
      dateBase, vencidoAte, venceAte,
    } = req.query as Record<string, string | undefined>;
    const conds: string[] = [];
    const params: unknown[] = [];
    if (contractId) { params.push(contractId); conds.push(`r.contract_id = $${params.length}`); }
    if (competencia) { params.push(competencia); conds.push(`r.competencia = $${params.length}`); }
    if (pago === 'true')  conds.push(`r.pago = TRUE`);
    if (pago === 'false') conds.push(`r.pago = FALSE`);
    if (status) { params.push(status); conds.push(`r.status = $${params.length}`); }
    if (companyId) { params.push(companyId); conds.push(`c.company_id = $${params.length}`); }
    if (semValidade === 'true')  conds.push(`COALESCE(r.sem_validade, FALSE) = TRUE`);
    if (semValidade === 'false') conds.push(`COALESCE(r.sem_validade, FALSE) = FALSE`);
    // dateBase = 'vencimento' aplica from/to em data_vencimento; default = data_emissao
    const dateCol = dateBase === 'vencimento' ? 'r.data_vencimento' : 'r.data_emissao';
    if (from) { params.push(from); conds.push(`${dateCol} >= $${params.length}`); }
    if (to)   { params.push(to);   conds.push(`${dateCol} <= $${params.length}`); }
    // Filtros de vencimento (independentes do dateBase)
    if (vencidoAte) {
      params.push(vencidoAte);
      conds.push(`r.status IN ('aberto','parcial') AND r.data_vencimento IS NOT NULL AND r.data_vencimento < $${params.length}`);
    }
    if (venceAte) {
      params.push(venceAte);
      conds.push(`r.status IN ('aberto','parcial') AND r.data_vencimento IS NOT NULL AND r.data_vencimento <= $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      const n = params.length;
      conds.push(`(r.numero ILIKE $${n} OR COALESCE(r.numero_display,'') ILIKE $${n} OR c.numero ILIKE $${n} OR cu.customer_name ILIKE $${n} OR emp.razao_social ILIKE $${n})`);
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const fromSql = `FROM erp_receipts r
         JOIN erp_contracts c ON c.id = r.contract_id
         LEFT JOIN erp_companies emp ON emp.id = c.company_id
         LEFT JOIN customers cu ON cu.id = c.customer_id
         ${where}`;
    const pg = parsePagination(req, params.length);
    const rowsQ = await pool.query(
      `SELECT ${SELECT} ${fromSql}
         ORDER BY r.data_emissao DESC, r.created_at DESC ${pg.sql}`,
      [...params, ...pg.params]
    );
    if (pg.paginated) {
      const totalQ = await pool.query(`SELECT COUNT(*)::int AS c ${fromSql}`, params);
      return sendPaginated(res, rowsQ.rows, totalQ.rows[0].c, pg);
    }
    res.json(rowsQ.rows);
  } catch (e: any) { sendError(res, e); }
});

// KPIs de recibos — respeitam os mesmos filtros server-side (exceto paginação).
// Retorna totais corretos sobre o conjunto FILTRADO (não apenas a página atual).
router.get('/stats/kpis', async (req, res) => {
  try {
    const {
      contractId, competencia, status, companyId, search, semValidade,
      dateBase, from, to,
    } = req.query as Record<string, string | undefined>;
    const conds: string[] = [];
    const params: unknown[] = [];
    if (contractId) { params.push(contractId); conds.push(`r.contract_id = $${params.length}`); }
    if (competencia) { params.push(competencia); conds.push(`r.competencia = $${params.length}`); }
    if (status) { params.push(status); conds.push(`r.status = $${params.length}`); }
    if (companyId) { params.push(companyId); conds.push(`c.company_id = $${params.length}`); }
    if (semValidade === 'true')  conds.push(`COALESCE(r.sem_validade, FALSE) = TRUE`);
    if (semValidade === 'false') conds.push(`COALESCE(r.sem_validade, FALSE) = FALSE`);
    const dateCol = dateBase === 'vencimento' ? 'r.data_vencimento' : 'r.data_emissao';
    if (from) { params.push(from); conds.push(`${dateCol} >= $${params.length}`); }
    if (to)   { params.push(to);   conds.push(`${dateCol} <= $${params.length}`); }
    if (search) {
      params.push(`%${search}%`);
      const n = params.length;
      conds.push(`(r.numero ILIKE $${n} OR COALESCE(r.numero_display,'') ILIKE $${n} OR c.numero ILIKE $${n} OR cu.customer_name ILIKE $${n} OR emp.razao_social ILIKE $${n})`);
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const q = await pool.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE r.status='pago')::int AS "qtdPagos",
        COUNT(*) FILTER (WHERE r.status='aberto')::int AS "qtdAbertos",
        COUNT(*) FILTER (WHERE r.status='parcial')::int AS "qtdParciais",
        COUNT(*) FILTER (WHERE r.status='cancelado')::int AS "qtdCancelados",
        COUNT(*) FILTER (WHERE r.status IN ('aberto','parcial')
                          AND r.data_vencimento IS NOT NULL
                          AND r.data_vencimento < CURRENT_DATE)::int AS "qtdVencidos",
        COALESCE(SUM(CASE WHEN r.status IN ('pago','parcial')
                           THEN COALESCE(r.valor_pago, r.valor, 0) ELSE 0 END), 0)::float AS "recebido",
        COALESCE(SUM(CASE WHEN r.status = 'aberto' THEN r.valor ELSE 0 END), 0)::float AS "aberto",
        COALESCE(SUM(CASE WHEN r.status IN ('aberto','parcial')
                           AND r.data_vencimento IS NOT NULL
                           AND r.data_vencimento < CURRENT_DATE
                           THEN (r.valor - COALESCE(r.valor_pago, 0)) ELSE 0 END), 0)::float AS "vencido",
        COALESCE(SUM(CASE WHEN r.status <> 'cancelado' THEN r.valor ELSE 0 END), 0)::float AS "totalAtivos"
      FROM erp_receipts r
      JOIN erp_contracts c ON c.id = r.contract_id
      LEFT JOIN erp_companies emp ON emp.id = c.company_id
      LEFT JOIN customers cu ON cu.id = c.customer_id
      ${where}`, params);
    res.json(q.rows[0] || {
      total: 0, qtdPagos: 0, qtdAbertos: 0, qtdParciais: 0, qtdCancelados: 0, qtdVencidos: 0,
      recebido: 0, aberto: 0, vencido: 0, totalAtivos: 0,
    });
  } catch (e: any) { sendError(res, e); }
});



// Pendentes: contratos ativos que ainda não têm recibo na competência informada (default = mês atual)
router.get('/pending', async (req, res) => {
  try {
    const competencia = String((req.query as any).competencia || competenciaAtual());
    // [#6 alto] usa o ÚLTIMO dia do mês da competência como corte (e não dia 28
    // fixo, que excluía contratos iniciados em 29/30/31).
    const r = await pool.query(
      `SELECT c.id AS "contractId", c.numero AS "contractNumero",
              COALESCE(
                CASE WHEN c.tipo_contrato = 'evento' THEN c.valor_total_evento ELSE c.valor_mensal END,
                0
              )::numeric AS "valorMensal",
              c.tipo_contrato AS "tipoContrato",
              c.dia_vencimento AS "diaVencimento",
              c.data_inicio AS "dataInicio",
              c.renovacao_automatica AS "renovacaoAutomatica",
              c.company_id AS "companyId", c.customer_id AS "customerId",
              c.cno AS "cno", c.endereco_obra AS "enderecoObra", c.local_evento AS "localEvento",
              emp.razao_social AS "companyRazaoSocial", emp.cnpj AS "companyCnpj",
              cu.customer_name AS "customerName", cu.document AS "customerDocument"
         FROM erp_contracts c
         LEFT JOIN erp_companies emp ON emp.id = c.company_id
         LEFT JOIN customers cu ON cu.id = c.customer_id
        WHERE c.ativo = TRUE
          AND c.data_inicio <= (date_trunc('month', ($1 || '-01')::date)
                                + INTERVAL '1 month - 1 day')::date
          -- Mês do 1º faturamento (opcional): antes dessa competência o
          -- contrato NÃO entra no faturamento, mesmo com início anterior.
          AND (c.primeira_competencia IS NULL
               OR c.primeira_competencia = ''
               OR $1 >= c.primeira_competencia)
          -- Recibo "sem validade jurídica" é controle interno: NÃO tira o
          -- contrato da lista de pendentes do faturamento oficial.
          AND NOT EXISTS (
             SELECT 1 FROM erp_receipts r
              WHERE r.contract_id = c.id AND r.competencia = $1
                AND COALESCE(r.sem_validade, FALSE) = FALSE
          )
          -- Também considera "faturado" quando há NF ativa vinculada
          -- (fluxo: cliente paga por Nota Fiscal do portal do governo).
          AND NOT EXISTS (
             SELECT 1 FROM erp_invoices i
              WHERE i.contract_id = c.id
                AND i.competencia = $1
                AND i.status = 'ativa'
          )
        ORDER BY c.dia_vencimento ASC`,
      [competencia]
    );
    res.json({ competencia, pendentes: r.rows });
  } catch (e: any) { sendError(res, e); }
});


// Gera (ou regera) recibo da competência. Se já existir, atualiza valor e marca regerado.
router.post('/generate', requireRole(...FIN_ROLES), async (req, res) => {
  const {
    contractId, competencia: comp, valor, pago = true, regerar = false,
    periodoInicio, periodoFim, semValidade = false,
    dataVencimento: dataVencimentoIn, cno, enderecoObra,
  } = req.body || {};
  
  const user = (req as any).user?.username || (req as any).user?.nome;
  logger.finance('GENERATE', `Solicitação de geração de recibo por ${user}`, { contractId, competencia: comp, semValidade });

  if (!contractId) return res.status(400).json({ error: 'contractId obrigatório' });

  // Validação e normalização do período (DD/MM exato a exibir no recibo).
  const isISO = (s: any) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
  if ((periodoInicio && !isISO(periodoInicio)) || (periodoFim && !isISO(periodoFim))) {
    return res.status(400).json({ error: 'periodoInicio/periodoFim devem estar em YYYY-MM-DD' });
  }
  if (periodoInicio && periodoFim && periodoFim < periodoInicio) {
    return res.status(400).json({ error: 'periodoFim não pode ser anterior a periodoInicio' });
  }
  // Competência (YYYY-MM) é derivada do mês do periodoInicio quando informado,
  // preservando a unicidade por contrato+competência e a lógica de pendentes.
  const competencia = periodoInicio ? String(periodoInicio).slice(0, 7)
                    : (comp || competenciaAtual());

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
              emp.financeiro_contato AS company_financeiro_contato,
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
    if (!ct.company_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Contrato sem empresa emissora não pode gerar recibo.' });
    }

    // Unicidade é POR TIPO: recibo normal e "sem validade jurídica" podem
    // coexistir na mesma competência (migration-erp-receipts-sem-validade-unique).
    const existing = await client.query(
      `SELECT id, numero, snapshot FROM erp_receipts
        WHERE contract_id=$1 AND competencia=$2
          AND COALESCE(sem_validade, FALSE) = $3`,
      [contractId, competencia, !!semValidade]
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

    const valorPadraoContrato = ct.tipo_contrato === 'evento'
      ? (ct.valor_total_evento ?? 0)
      : (ct.valor_mensal ?? 0);
    const baseValor = Number(valor ?? valorPadraoContrato ?? 0);
    if (!Number.isFinite(baseValor) || baseValor < 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Valor do recibo inválido (número ≥ 0).' });
    }
    const valorFinal = baseValor + freteAplicado;

    // Vencimento é definido pelo CONTRATO (dia_vencimento no mês da competência),
    // salvo quando o usuário informa `dataVencimento` manualmente (override).
    const [ano, mes] = competencia.split('-').map(Number);
    const ultimoDia = new Date(ano, mes, 0).getDate();
    const dia = Math.min(Math.max(1, Number(ct.dia_vencimento || 10)), ultimoDia);
    const dataVencCalc = `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    const dataVenc = (typeof dataVencimentoIn === 'string' && isISO(dataVencimentoIn))
      ? dataVencimentoIn
      : dataVencCalc;


    // Se informado CNO/Endereço no POST, fazemos o override no contrato e no snapshot
    if (cno !== undefined || enderecoObra !== undefined) {
      const updates: string[] = [];
      const vals: any[] = [];
      if (cno !== undefined) {
        updates.push(`cno = $${vals.length + 2}`);
        vals.push(cno);
        ct.cno = cno; // atualiza objeto em memória para snapshot
      }
      if (enderecoObra !== undefined) {
        updates.push(`endereco_obra = $${vals.length + 2}`);
        vals.push(enderecoObra);
        ct.endereco_obra = enderecoObra; // atualiza objeto em memória para snapshot
      }
      if (updates.length > 0) {
        await client.query(`UPDATE erp_contracts SET ${updates.join(', ')} WHERE id = $1`, [contractId, ...vals]);
      }
    }

    const snapshot = {
      contract: {
        numero: ct.numero, descricao: ct.descricao,
        dataInicio: ct.data_inicio, valorMensal: ct.valor_mensal,
        diaVencimento: ct.dia_vencimento,
        enderecoObra: ct.endereco_obra || ct.local_evento, 
        cno: ct.cno, tipoContrato: ct.tipo_contrato,
      },
      company: {
        razaoSocial: ct.company_razao_social, cnpj: ct.company_cnpj,
        endereco: ct.company_endereco, cidade: ct.company_cidade,
        estado: ct.company_estado, cep: ct.company_cep,
        telefone: ct.company_telefone, email: ct.company_email,
        inscricaoEstadual: ct.company_ie,
        logoUrl: ct.company_logo_url, logoDataUrl: ct.company_logo_dataurl,
        assinaturaUrl: ct.company_assinatura_url,
        financeiroContato: ct.company_financeiro_contato,
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
      periodo: (periodoInicio || periodoFim)
        ? { inicio: periodoInicio || null, fim: periodoFim || null }
        : null,
    };

    if (existing.rows[0]) {
      if (!regerar) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: semValidade
            ? 'Recibo sem validade jurídica desta competência já existe'
            : 'Recibo desta competência já existe',
          existing: existing.rows[0],
        });
      }
      await client.query(
        `UPDATE erp_receipts
            SET valor=$2, pago=$3, snapshot=$4, data_vencimento=$5,
                periodo_inicio = COALESCE($6, periodo_inicio),
                periodo_fim    = COALESCE($7, periodo_fim),
                pdf_gerado_em=NOW()
          WHERE id=$1`,
        [existing.rows[0].id, valorFinal, !!pago, snapshot, dataVenc,
         periodoInicio || null, periodoFim || null]
      );
      await client.query('COMMIT');
      logger.success('FINANCE', `Recibo ${existing.rows[0].numero} REGERADO com sucesso por ${user}`);
      return res.json({ ok: true, id: existing.rows[0].id, numero: existing.rows[0].numero, regerado: true });
    }

    // Numeração: recibos "sem validade jurídica" têm contador próprio (REC_SV)
    // e são exibidos como "0001". Prefixamos internamente com "SV-" apenas
    // para preservar a UNIQUE(numero) sem contaminar o PDF/UI.
    const docKey = semValidade ? 'REC_SV' : 'REC';
    const numRes = await client.query(
      `SELECT erp_next_doc_number($1, $2::uuid) AS num`,
      [docKey, ct.company_id]
    );
    const rawNum = numRes.rows[0].num as string;
    const numeroDisplay = semValidade ? rawNum : null;
    const numero = semValidade ? `SV-${rawNum}` : rawNum;

    const ins = await client.query(
      `INSERT INTO erp_receipts
          (numero, company_id, contract_id, competencia, data_emissao, data_vencimento,
          valor, pago, snapshot, pdf_gerado_em, periodo_inicio, periodo_fim,
          sem_validade, numero_display)
        VALUES ($1,$2,$3,$4,CURRENT_DATE,$5,$6,$7,$8,NOW(),$9,$10,$11,$12)
       RETURNING id, numero, numero_display AS "numeroDisplay"`,
      [numero, ct.company_id, contractId, competencia, dataVenc, valorFinal, !!pago, snapshot,
       periodoInicio || null, periodoFim || null, !!semValidade, numeroDisplay]
    );

    await client.query('COMMIT');
    res.json({ ok: true, ...ins.rows[0] });
  } catch (e: any) {
    await client.query('ROLLBACK');
    console.error('[erp-receipts generate]', e);
    sendError(res, e);
  } finally { client.release(); }
});

/**
 * PATCH /:id/vencimento
 * Ajuste manual da data de vencimento de um recibo já emitido.
 * Body: { dataVencimento: 'YYYY-MM-DD' | null }
 */
router.patch('/:id/vencimento', requireRole(...FIN_ROLES), async (req, res) => {
  try {
    const { dataVencimento } = req.body || {};
    if (dataVencimento !== null && !(typeof dataVencimento === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dataVencimento))) {
      return res.status(400).json({ error: 'dataVencimento deve estar em YYYY-MM-DD ou null' });
    }
    const cur = await pool.query('SELECT id, status FROM erp_receipts WHERE id=$1', [req.params.id]);
    if (!cur.rows[0]) return res.status(404).json({ error: 'Recibo não encontrado' });
    if (cur.rows[0].status === 'cancelado') {
      return res.status(409).json({ error: 'Recibo cancelado — não pode ter vencimento alterado.' });
    }
    await pool.query(
      `UPDATE erp_receipts SET data_vencimento=$2, updated_at=NOW() WHERE id=$1`,
      [req.params.id, dataVencimento],
    );
    res.json({ ok: true });
  } catch (e: any) {
    console.error('[erp-receipts patch vencimento]', e);
    sendError(res, e);
  }
});

/**
 * PATCH /:id
 * Edição ampla de um recibo já emitido (correções manuais).
 * Aceita qualquer subconjunto de:
 *   { dataEmissao, dataVencimento, periodoInicio, periodoFim, valor, numeroDisplay, competencia, cno, enderecoObra }
 * Datas em YYYY-MM-DD (ou null para limpar dataVencimento/numeroDisplay).
 * Não altera pagamento/status — use os endpoints específicos.
 */
router.patch('/:id', requireRole(...FIN_ROLES), async (req, res) => {
  const dateOrNull = (v: unknown, allowNull = false): string | null | undefined => {
    if (v === undefined) return undefined;
    if (v === null) return allowNull ? null : undefined;
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    return 'INVALID';
  };
  try {
    const b = req.body || {};
    const patch: Record<string, any> = {};

    const de = dateOrNull(b.dataEmissao);
    if (de === 'INVALID') return res.status(400).json({ error: 'dataEmissao inválida (YYYY-MM-DD)' });
    if (de !== undefined) patch.data_emissao = de;

    const dv = dateOrNull(b.dataVencimento, true);
    if (dv === 'INVALID') return res.status(400).json({ error: 'dataVencimento inválida (YYYY-MM-DD ou null)' });
    if (dv !== undefined) patch.data_vencimento = dv;

    const pi = dateOrNull(b.periodoInicio, true);
    if (pi === 'INVALID') return res.status(400).json({ error: 'periodoInicio inválido' });
    if (pi !== undefined) patch.periodo_inicio = pi;

    const pf = dateOrNull(b.periodoFim, true);
    if (pf === 'INVALID') return res.status(400).json({ error: 'periodoFim inválido' });
    if (pf !== undefined) patch.periodo_fim = pf;

    if (b.valor !== undefined) {
      const v = Number(b.valor);
      if (!Number.isFinite(v) || v < 0) return res.status(400).json({ error: 'valor inválido' });
      patch.valor = v;
    }

    if (b.numeroDisplay !== undefined) {
      if (b.numeroDisplay === null || b.numeroDisplay === '') patch.numero_display = null;
      else if (typeof b.numeroDisplay === 'string' && b.numeroDisplay.length <= 64) patch.numero_display = b.numeroDisplay;
      else return res.status(400).json({ error: 'numeroDisplay inválido (max 64 chars)' });
    }

    if (b.competencia !== undefined) {
      if (typeof b.competencia !== 'string' || !/^\d{4}-\d{2}$/.test(b.competencia)) {
        return res.status(400).json({ error: 'competencia inválida (YYYY-MM)' });
      }
       patch.competencia = b.competencia;
    }

    if (b.cno !== undefined) patch.cno = b.cno;
    if (b.enderecoObra !== undefined) patch.endereco_obra = b.enderecoObra;

    if (patch.periodo_inicio && patch.periodo_fim && patch.periodo_fim < patch.periodo_inicio) {
      return res.status(400).json({ error: 'periodoFim deve ser >= periodoInicio' });
    }

    const keys = Object.keys(patch);
    if (keys.length === 0) return res.status(400).json({ error: 'Nada para atualizar' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const cur = await client.query('SELECT id, status, contract_id, snapshot FROM erp_receipts WHERE id=$1', [req.params.id]);
      if (!cur.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Recibo não encontrado' });
      }
      const rec = cur.rows[0];
      if (rec.status === 'cancelado') {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Recibo cancelado — não pode ser editado.' });
      }

      // Se houver alteração de CNO ou Endereço, atualizamos o snapshot e o contrato
      if (patch.cno !== undefined || patch.endereco_obra !== undefined) {
        const snap = rec.snapshot || {};
        const snapContract = snap.contract || {};
        
        if (patch.cno !== undefined) {
          snapContract.cno = patch.cno;
          await client.query('UPDATE erp_contracts SET cno = $2 WHERE id = $1', [rec.contract_id, patch.cno]);
        }
        if (patch.endereco_obra !== undefined) {
          snapContract.enderecoObra = patch.endereco_obra;
          await client.query('UPDATE erp_contracts SET endereco_obra = $2 WHERE id = $1', [rec.contract_id, patch.endereco_obra]);
        }
        
        snap.contract = snapContract;
        patch.snapshot = snap;
        
        // Remove campos que não são colunas da tabela erp_receipts se necessário
        // (cno e endereco_obra não existem na tabela, apenas no snapshot e no contrato)
        delete patch.cno;
        delete patch.endereco_obra;
      }

      const finalKeys = Object.keys(patch);
      if (finalKeys.length > 0) {
        const sets = finalKeys.map((k, i) => `${k} = $${i + 2}`).join(', ');
        const values = finalKeys.map(k => patch[k]);
        await client.query(
          `UPDATE erp_receipts SET ${sets}, updated_at=NOW() WHERE id=$1`,
          [req.params.id, ...values],
        );
      }
      
      await client.query('COMMIT');
      res.json({ ok: true });
    } catch (e: any) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (e: any) {
    console.error('[erp-receipts patch]', e);
    sendError(res, e);
  }
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
router.patch('/:id/pago', requireRole(...FIN_ROLES), async (req: any, res) => {
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
    const actor = req.user?.username || req.user?.name || null;

    await pool.query(
      `UPDATE erp_receipts
          SET status           = COALESCE($2, status),
              pago             = $3,
              valor_pago       = $4,
              forma_pagamento  = COALESCE($5, forma_pagamento),
              data_pagamento   = $6,
              updated_by       = $7,
              updated_at       = NOW()
        WHERE id = $1`,
      [
        req.params.id,
        finalStatus || null,
        finalPagoBool,
        finalValorPago,
        formaPagamento || null,
        finalDataPag,
        actor,
      ]
    );
    res.json({ ok: true, status: finalStatus, valorPago: finalValorPago });
  } catch (e: any) { sendError(res, e); }
});


// POST /:id/cancel — marca recibo como cancelado preservando histórico
router.post('/:id/cancel', requireRole(...FIN_ROLES), async (req: any, res) => {
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
    const actor = req.user?.username || req.user?.name || null;
    await pool.query(
      `UPDATE erp_receipts
          SET status = 'cancelado',
              pago = FALSE,
              cancelado_em = NOW(),
              motivo_cancelamento = $2,
              updated_by = $3,
              updated_at = NOW()
        WHERE id = $1`,
      [req.params.id, String(motivo).trim(), actor]
    );
    res.json({ ok: true });
  } catch (e: any) { sendError(res, e); }
});


// POST /:id/reopen — reverte um recibo CANCELADO ao estado "não faturado",
// removendo-o para que a competência volte à lista de pendentes.
// Uso típico: clique acidental no cancelar. Só funciona para status='cancelado'.
router.post('/:id/reopen', requireRole(...FIN_ROLES), async (req, res) => {
  try {
    const cur = await pool.query('SELECT status FROM erp_receipts WHERE id=$1', [req.params.id]);
    if (!cur.rows[0]) return res.status(404).json({ error: 'Recibo não encontrado' });
    if (cur.rows[0].status !== 'cancelado') {
      return res.status(409).json({ error: 'Só é possível reabrir recibos cancelados.' });
    }
    await pool.query('DELETE FROM erp_receipts WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e: any) { sendError(res, e); }
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
  } catch (e: any) { sendError(res, e); }
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
  } catch (e: any) { sendError(res, e); }
});

export default router;
