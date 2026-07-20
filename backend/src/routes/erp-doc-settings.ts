import { sendError } from '../utils/apiError';
import { Router } from 'express';
import { pool } from '../config/database';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();
router.use(requireAuth);

const DOCS = ['ORC', 'OS', 'CTR', 'REC', 'REC_SV'];

router.get('/', async (_req, res) => {
  try {
    const r = await pool.query(
      `SELECT doc, start_number AS "startNumber", include_year AS "includeYear",
              padding, prefix, updated_at AS "updatedAt"
         FROM erp_doc_settings ORDER BY doc`
    );
    // garante todos os docs no retorno
    const map = new Map(r.rows.map((x: any) => [x.doc, x]));
    const rows = DOCS.map((d) => map.get(d) || {
      doc: d, startNumber: 0, includeYear: d === 'ORC' || d === 'OS', padding: 4, prefix: d === 'REC_SV' ? null : d,
    });
    res.json(rows);
  } catch (e: any) { sendError(res, e); }
});

router.put('/:doc', async (req, res) => {
  try {
    const { doc } = req.params;
    if (!DOCS.includes(doc)) return res.status(400).json({ error: 'doc inválido' });
    const { startNumber = 0, includeYear = false, padding = 4, prefix = null } = req.body || {};
    await pool.query(
      `INSERT INTO erp_doc_settings(doc, start_number, include_year, padding, prefix, updated_at)
       VALUES ($1,$2,$3,$4,$5,NOW())
       ON CONFLICT (doc) DO UPDATE SET
         start_number = EXCLUDED.start_number,
         include_year = EXCLUDED.include_year,
         padding = EXCLUDED.padding,
         prefix = EXCLUDED.prefix,
         updated_at = NOW()`,
      [doc, Math.max(0, Number(startNumber) || 0), !!includeYear,
       Math.max(1, Number(padding) || 4), prefix || null]
    );
    res.json({ ok: true });
  } catch (e: any) { sendError(res, e); }
});

export default router;
