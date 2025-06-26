
import { Router } from 'express';
import { pool } from '../config/database';

const router = Router();

// Get all drivers
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, phone, email, license, status, current_route, total_trips
      FROM drivers
      ORDER BY name
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching drivers:', error);
    res.json([]);
  }
});

export default router;
