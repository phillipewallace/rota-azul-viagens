import { Router } from 'express';
import { pool } from '../config/database';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();
router.use(requireAuth);

const SELECT = `
  c.id, c.numero, c.company_id AS "companyId", c.customer_id AS "customerId",
  c.os_id AS "osId", c.origem, c.descricao,
  c.data_inicio AS "dataInicio", c.data_fim AS "dataFim",
  c.dia_vencimento AS "diaVencimento",
  c.valor_mensal AS "valorMensal",
  c.renovacao_automatica AS "renovacaoAutomatica",
  c.ativo, c.encerrado_em AS "encerradoEm", c.motivo_encerramento AS "motivoEncerramento",
  c.pdf_url AS "pdfUrl", c.observacoes,
  c.company_snapshot AS "companySnapshot", c.customer_snapshot AS "customerSnapshot",
  c.created_at AS "createdAt",
  emp.razao_social AS "companyRazaoSocial", emp.cnpj AS "companyCnpj",
  cu.customer_name AS "customerName", cu.document AS "customerDocument",
  os.numero AS "osNumero"
`;

router.get('/', async (req, res) => {
  try {
    const { ativo, customerId } = req.query as any;
    const conds: string[] = [];
    const params: any[] = [];
    if (ativo === 'true')  conds.push(`c.ativo = TRUE`);
    if (ativo === 'false') conds.push(`c.ativo = FALSE`);
    if (customerId) { params.push(customerId); conds.push(`c.customer_id = $${params.length}`); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const r = await pool.query(
      `SELECT ${SELECT}
         FROM erp_contracts c
         LEFT JOIN erp_companies emp ON emp.id = c.company_id
         LEFT JOIN customers cu ON cu.id = c.customer_id
         LEFT JOIN erp_service_orders os ON os.id = c.os_id
         ${where}
         ORDER BY c.ativo DESC, c.created_at DESC LIMIT 1000`,
      params
    );
    res.json(r.rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT ${SELECT}
         FROM erp_contracts c
         LEFT JOIN erp_companies emp ON emp.id = c.company_id
         LEFT JOIN customers cu ON cu.id = c.customer_id
         LEFT JOIN erp_service_orders os ON os.id = c.os_id
         WHERE c.id = $1`, [req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'não encontrado' });
    res.json(r.rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  const c = req.body || {};
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const numRes = await client.query(`SELECT erp_next_doc_number('CTR') AS num`);
    const numero = numRes.rows[0].num;

    let companySnap: any = null, customerSnap: any = null;
    if (c.companyId) {
      const cc = await client.query('SELECT * FROM erp_companies WHERE id=$1', [c.companyId]);
      companySnap = cc.rows[0] || null;
    }
    if (c.customerId) {
      const cu = await client.query('SELECT * FROM customers WHERE id=$1', [c.customerId]);
      customerSnap = cu.rows[0] || null;
    }

    const ins = await client.query(
      `INSERT INTO erp_contracts
        (numero, company_id, customer_id, os_id, origem, descricao,
         data_inicio, data_fim, dia_vencimento, valor_mensal,
         renovacao_automatica, ativo, pdf_url, observacoes,
         company_snapshot, customer_snapshot)
       VALUES ($1,$2,$3,$4,COALESCE($5,'manual'),$6,
               $7,$8,COALESCE($9,10),COALESCE($10,0),
               COALESCE($11,TRUE),COALESCE($12,TRUE),$13,$14,$15,$16)
       RETURNING id, numero`,
      [numero, c.companyId || null, c.customerId || null, c.osId || null,
       c.origem || null, c.descricao || null,
       c.dataInicio, c.dataFim || null, c.diaVencimento ?? 10, c.valorMensal ?? 0,
       c.renovacaoAutomatica, c.ativo, c.pdfUrl || null, c.observacoes || null,
       companySnap, customerSnap]
    );
    await client.query('COMMIT');
    res.json(ins.rows[0]);
  } catch (e: any) {
    await client.query('ROLLBACK');
    console.error('[erp-contracts POST]', e);
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

router.put('/:id', async (req, res) => {
  try {
    const c = req.body || {};
    await pool.query(
      `UPDATE erp_contracts SET
         company_id = COALESCE($2, company_id),
         customer_id = COALESCE($3, customer_id),
         os_id = $4,
         descricao = $5,
         data_inicio = COALESCE($6, data_inicio),
         data_fim = $7,
         dia_vencimento = COALESCE($8, dia_vencimento),
         valor_mensal = COALESCE($9, valor_mensal),
         renovacao_automatica = COALESCE($10, renovacao_automatica),
         ativo = COALESCE($11, ativo),
         pdf_url = COALESCE($12, pdf_url),
         observacoes = $13,
         motivo_encerramento = $14,
         encerrado_em = CASE WHEN $11 = FALSE AND ativo = TRUE THEN NOW()
                             WHEN $11 = TRUE THEN NULL ELSE encerrado_em END,
         updated_at = NOW()
       WHERE id = $1`,
      [req.params.id, c.companyId || null, c.customerId || null, c.osId || null,
       c.descricao ?? null, c.dataInicio || null, c.dataFim || null,
       c.diaVencimento ?? null, c.valorMensal ?? null,
       c.renovacaoAutomatica, c.ativo, c.pdfUrl || null,
       c.observacoes ?? null, c.motivoEncerramento ?? null]
    );
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM erp_contracts WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
