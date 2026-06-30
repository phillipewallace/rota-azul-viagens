import { Router } from 'express';
import { pool } from '../config/database';
import { requireAuth } , requireRole from '../middleware/requireAuth';

const router = Router();
router.use(requireAuth);

const SEL = `
  id, categoria, descricao, valor, data, fornecedor,
  nota_fiscal AS "notaFiscal", anexo_url AS "anexoUrl",
  observacoes, created_at AS "createdAt"
`;

// Lista combinada: gastos manuais + manutenção (somente leitura)
router.get('/', async (req, res) => {
  try {
    const { from, to, categoria, origem } = req.query as any;
    const conds: string[] = [];
    const params: any[] = [];
    if (from) { params.push(from); conds.push(`data >= $${params.length}`); }
    if (to)   { params.push(to);   conds.push(`data <= $${params.length}`); }
    if (categoria && categoria !== 'all') { params.push(categoria); conds.push(`categoria = $${params.length}`); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    const wantManual = !origem || origem === 'manual' || origem === 'all';
    const wantManut  = !origem || origem === 'manutencao' || origem === 'all';

    const manuais = wantManual
      ? await pool.query(
          `SELECT ${SEL}, 'manual' AS origem FROM erp_expenses ${where} ORDER BY data DESC LIMIT 1000`,
          params
        )
      : { rows: [] as any[] };

    // manutenções concluídas viram custos
    const fromD = from || '1900-01-01';
    const toD   = to   || '2999-12-31';
    const mn = wantManut
      ? await pool.query(
          `SELECT m.id, 'manutencao' AS categoria,
                  COALESCE(m.description, 'Manutenção ' || COALESCE(m.maintenance_type, m.type, '')) AS descricao,
                  COALESCE(m.cost, 0) AS valor,
                  COALESCE(m.completed_date, m.maintenance_date, m.created_at::date) AS data,
                  COALESCE(t.name, 'Frota') AS fornecedor,
                  NULL AS "notaFiscal", NULL AS "anexoUrl",
                  m.performed_by AS observacoes,
                  m.created_at AS "createdAt",
                  'manutencao' AS origem
             FROM maintenance_records m
             LEFT JOIN trucks t ON t.id = m.truck_id
            WHERE COALESCE(m.cost,0) > 0
              AND COALESCE(m.completed_date, m.maintenance_date, m.created_at::date) BETWEEN $1 AND $2
            ORDER BY data DESC LIMIT 1000`,
          [fromD, toD]
        )
      : { rows: [] as any[] };

    const all = [...manuais.rows, ...mn.rows].sort(
      (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()
    );
    res.json(all);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const e = req.body || {};
    if (!e.descricao || e.valor == null) return res.status(400).json({ error: 'descricao e valor obrigatórios' });
    const r = await pool.query(
      `INSERT INTO erp_expenses(categoria, descricao, valor, data, fornecedor, nota_fiscal, anexo_url, observacoes)
       VALUES (COALESCE($1,'outros'), $2, $3, COALESCE($4,CURRENT_DATE), $5, $6, $7, $8)
       RETURNING ${SEL}`,
      [e.categoria || null, e.descricao, Number(e.valor) || 0, e.data || null,
       e.fornecedor || null, e.notaFiscal || null, e.anexoUrl || null, e.observacoes || null]
    );
    res.json(r.rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const e = req.body || {};
    await pool.query(
      `UPDATE erp_expenses SET
         categoria = COALESCE($2, categoria),
         descricao = COALESCE($3, descricao),
         valor = COALESCE($4, valor),
         data = COALESCE($5, data),
         fornecedor = $6, nota_fiscal = $7, anexo_url = $8, observacoes = $9,
         updated_at = NOW()
       WHERE id = $1`,
      [req.params.id, e.categoria || null, e.descricao || null,
       e.valor != null ? Number(e.valor) : null, e.data || null,
       e.fornecedor || null, e.notaFiscal || null, e.anexoUrl || null, e.observacoes || null]
    );
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', requireRole('admin','manager'), async (req, res) => {
  try {
    await pool.query('DELETE FROM erp_expenses WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
