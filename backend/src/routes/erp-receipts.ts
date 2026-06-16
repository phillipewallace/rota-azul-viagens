import { Router } from 'express';
import { pool } from '../config/database';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();
router.use(requireAuth);

const SELECT = `
  r.id, r.numero, r.contract_id AS "contractId", r.competencia,
  r.data_emissao AS "dataEmissao", r.data_vencimento AS "dataVencimento",
  r.valor, r.pago, r.snapshot, r.pdf_gerado_em AS "pdfGeradoEm", r.created_at AS "createdAt",
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
          AND c.data_inicio <= ($1 || '-28')::date
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
      `SELECT id, numero FROM erp_receipts WHERE contract_id=$1 AND competencia=$2`,
      [contractId, competencia]
    );

    const valorFinal = Number(valor ?? ct.valor_mensal ?? 0);

    // Vencimento da competência
    const [ano, mes] = competencia.split('-').map(Number);
    const dia = Math.min(Number(ct.dia_vencimento || 10), 28);
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
      },
      customer: {
        name: ct.customer_name, document: ct.customer_document,
        address: ct.customer_address, numero: ct.customer_numero,
        bairro: ct.customer_bairro, cidade: ct.customer_cidade,
        estado: ct.customer_estado, cep: ct.customer_cep,
      },
      os: ct.os_id ? { id: ct.os_id } : null,
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

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM erp_receipts WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
