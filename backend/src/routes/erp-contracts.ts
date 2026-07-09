import { Router } from 'express';
import { pool } from '../config/database';
import { requireAuth, requireRole } from '../middleware/requireAuth';

const router = Router();
router.use(requireAuth);

const SELECT = `
  c.id, c.numero, c.company_id AS "companyId", c.customer_id AS "customerId",
  c.os_id AS "osId", c.origem, c.descricao,
  c.tipo_contrato AS "tipoContrato",
  c.data_inicio AS "dataInicio", c.data_fim AS "dataFim",
  c.data_evento AS "dataEvento", c.data_recolhimento AS "dataRecolhimento",
  c.local_evento AS "localEvento", c.hora_entrega AS "horaEntrega",
  c.endereco_obra AS "enderecoObra", c.cno AS "cno",
  c.valor_total_evento AS "valorTotalEvento",
  c.dia_vencimento AS "diaVencimento",
  c.valor_mensal AS "valorMensal",
  c.frete AS "frete",

  c.renovacao_automatica AS "renovacaoAutomatica",
  c.ativo, c.encerrado_em AS "encerradoEm", c.motivo_encerramento AS "motivoEncerramento",
  c.pdf_url AS "pdfUrl", c.observacoes,
  c.responsavel_nome     AS "responsavelNome",
  c.responsavel_telefone AS "responsavelTelefone",
  c.responsavel_email    AS "responsavelEmail",
  c.company_snapshot AS "companySnapshot", c.customer_snapshot AS "customerSnapshot",
  c.created_at AS "createdAt",
  emp.razao_social AS "companyRazaoSocial", emp.cnpj AS "companyCnpj",
  emp.logo_url AS "companyLogoUrl",
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
         tipo_contrato, data_inicio, data_fim,
         data_evento, data_recolhimento, local_evento, hora_entrega, valor_total_evento,
         dia_vencimento, valor_mensal,
         renovacao_automatica, ativo, pdf_url, observacoes,
         company_snapshot, customer_snapshot, frete, endereco_obra, cno)
       VALUES ($1,$2,$3,$4,COALESCE($5,'manual'),$6,
               COALESCE($7,'locacao'),$8,$9,
               $10,$11,$12,$13,$14,
               COALESCE($15,10),COALESCE($16,0),
               COALESCE($17,TRUE),COALESCE($18,TRUE),$19,$20,$21,$22,COALESCE($23,0),$24,$25)
       RETURNING id, numero`,
      [numero, c.companyId || null, c.customerId || null, c.osId || null,
       c.origem || null, c.descricao || null,
       c.tipoContrato || null,
       c.dataInicio, c.dataFim || null,
       c.dataEvento || null, c.dataRecolhimento || null, c.localEvento || null,
       c.horaEntrega || null, c.valorTotalEvento != null ? Number(c.valorTotalEvento) : null,
       c.diaVencimento ?? 10, c.valorMensal ?? 0,
       c.renovacaoAutomatica, c.ativo, c.pdfUrl || null, c.observacoes || null,
       companySnap, customerSnap, c.frete != null ? Number(c.frete) : 0,
       c.enderecoObra || null, c.cno || null]
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
         tipo_contrato = COALESCE($6, tipo_contrato),
         data_inicio = COALESCE($7, data_inicio),
         data_fim = $8,
         data_evento = $9,
         data_recolhimento = $10,
         local_evento = $11,
         hora_entrega = $12,
         valor_total_evento = $13,
         dia_vencimento = COALESCE($14, dia_vencimento),
         valor_mensal = COALESCE($15, valor_mensal),
         renovacao_automatica = COALESCE($16, renovacao_automatica),
         ativo = COALESCE($17, ativo),
         pdf_url = COALESCE($18, pdf_url),
         observacoes = $19,
         motivo_encerramento = $20,
         frete = COALESCE($21, frete),
         endereco_obra = $22,
         cno = $23,
         -- [#7 alto] encerrado_em só muda quando $17 vem definido; null deixa intacto.
         encerrado_em = CASE
           WHEN $17::boolean IS NULL THEN encerrado_em
           WHEN $17 = FALSE AND ativo = TRUE THEN NOW()
           WHEN $17 = TRUE THEN NULL
           ELSE encerrado_em
         END,
         updated_at = NOW()
       WHERE id = $1`,
      [req.params.id, c.companyId || null, c.customerId || null, c.osId || null,
       c.descricao ?? null, c.tipoContrato || null,
       c.dataInicio || null, c.dataFim || null,
       c.dataEvento || null, c.dataRecolhimento || null, c.localEvento || null,
       c.horaEntrega || null, c.valorTotalEvento != null ? Number(c.valorTotalEvento) : null,
       c.diaVencimento ?? null, c.valorMensal ?? null,
       c.renovacaoAutomatica, c.ativo, c.pdfUrl || null,
       c.observacoes ?? null, c.motivoEncerramento ?? null,
       c.frete != null ? Number(c.frete) : null,
       c.enderecoObra ?? null, c.cno ?? null]
    );
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});


router.delete('/:id', requireRole('admin','manager'), async (req, res) => {
  try {
    // [#26 baixo] Bloqueia exclusão de contrato com recibos associados.
    const dep = await pool.query(
      `SELECT COUNT(*)::int AS n FROM erp_receipts WHERE contract_id=$1`,
      [req.params.id]
    );
    if ((dep.rows[0]?.n || 0) > 0) {
      return res.status(400).json({
        error: `Contrato possui ${dep.rows[0].n} recibo(s) emitido(s). Encerre o contrato em vez de excluí-lo.`,
      });
    }
    const r = await pool.query('DELETE FROM erp_contracts WHERE id=$1 RETURNING id', [req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ error: 'não encontrado' });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});


export default router;
