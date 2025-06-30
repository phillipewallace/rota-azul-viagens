
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
    res.status(500).json({ error: 'Erro ao buscar registros de manutenção' });
  }
});

// Create new maintenance record
router.post('/', async (req, res) => {
  try {
    const { truck_id, maintenance_type, description, scheduled_date, cost } = req.body;

    const result = await pool.query(`
      INSERT INTO maintenance (truck_id, maintenance_type, description, scheduled_date, cost)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [truck_id, maintenance_type, description, scheduled_date, cost]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating maintenance record:', error);
    res.status(500).json({ error: 'Erro ao criar registro de manutenção' });
  }
});

export default router;
