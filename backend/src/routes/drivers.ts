
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
    res.status(500).json({ error: 'Erro ao buscar motoristas' });
  }
});

// Create new driver
router.post('/', async (req, res) => {
  try {
    const { name, license, phone, email } = req.body;

    const result = await pool.query(`
      INSERT INTO drivers (name, license, phone, email)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [name, license, phone, email]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating driver:', error);
    res.status(500).json({ error: 'Erro ao criar motorista' });
  }
});

export default router;
