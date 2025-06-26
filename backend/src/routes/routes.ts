
import { Router } from 'express';
import { pool } from '../config/database';

const router = Router();

// Get all routes
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, points, total_distance, estimated_time, 
             optimized_order, description, status, created_at
      FROM routes
      ORDER BY created_at DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching routes:', error);
    res.json([]);
  }
});

// Create new route
router.post('/', async (req, res) => {
  try {
    const { name, points, totalDistance, estimatedTime, optimizedOrder, description, status } = req.body;

    const result = await pool.query(`
      INSERT INTO routes (name, points, total_distance, estimated_time, optimized_order, description, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [name, JSON.stringify(points), totalDistance, estimatedTime, JSON.stringify(optimizedOrder), description, status || 'active']);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating route:', error);
    res.status(500).json({ error: 'Erro ao criar rota' });
  }
});

export default router;
