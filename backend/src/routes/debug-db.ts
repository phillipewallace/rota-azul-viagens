import { Router } from 'express';
import { pool } from '../config/database';
const router = Router();
router.get('/schema', async (req, res) => {
  try {
    const tables = ['erp_service_orders', 'erp_quotes', 'erp_os_sanitarios', 'sanitarios', 'erp_contracts', 'customers'];
    const results: any = {};
    for (const table of tables) {
      const r = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = ", [table]);
      results[table] = r.rows;
    }
    res.json(results);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
export default router;
