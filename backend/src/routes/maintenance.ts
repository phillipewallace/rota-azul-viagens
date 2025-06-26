
import { Router } from 'express';
import { pool } from '../config/database';

const router = Router();

// Get all maintenance records
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT m.*, t.name as truck_name
      FROM maintenance m
      JOIN trucks t ON m.truck_id = t.id
      ORDER BY m.scheduled_date DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching maintenance records:', error);
    res.json([]);
  }
});

export default router;
