import { Router } from 'express';
import { pool } from '../config/database';

const router = Router();

// Get all routes
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, description, points, total_distance, 
             estimated_time, optimized_order, status, created_at
      FROM routes
      ORDER BY created_at DESC
    `);

    const routes = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      points: row.points || [],
      totalDistance: parseFloat(row.total_distance) || 0,
      estimatedTime: row.estimated_time,
      optimizedOrder: row.optimized_order || [],
      status: row.status,
      createdAt: row.created_at
    }));

    res.json(routes);
  } catch (error) {
    console.error('Error fetching routes:', error);
    res.status(500).json({ error: 'Erro ao buscar rotas' });
  }
});

// Create new route
router.post('/', async (req, res) => {
  try {
    const { name, description, points, totalDistance, estimatedTime, optimizedOrder } = req.body;

    const result = await pool.query(`
      INSERT INTO routes (name, description, points, total_distance, estimated_time, optimized_order)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [name, description, JSON.stringify(points || []), totalDistance || 0, estimatedTime, JSON.stringify(optimizedOrder || [])]);

    const route = {
      id: result.rows[0].id,
      name: result.rows[0].name,
      description: result.rows[0].description,
      points: result.rows[0].points || [],
      totalDistance: parseFloat(result.rows[0].total_distance) || 0,
      estimatedTime: result.rows[0].estimated_time,
      optimizedOrder: result.rows[0].optimized_order || [],
      status: result.rows[0].status,
      createdAt: result.rows[0].created_at
    };

    res.json(route);
  } catch (error) {
    console.error('Error creating route:', error);
    res.status(500).json({ error: 'Erro ao criar rota' });
  }
});

// Update route
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, points, totalDistance, estimatedTime, optimizedOrder, status } = req.body;

    // Log the incoming data for debugging
    console.log('Updating route:', { id, name, description, points, totalDistance, estimatedTime, optimizedOrder, status });

    const result = await pool.query(`
      UPDATE routes 
      SET name = COALESCE($1, name),
          description = COALESCE($2, description),
          points = COALESCE($3, points),
          total_distance = COALESCE($4, total_distance),
          estimated_time = COALESCE($5, estimated_time),
          optimized_order = COALESCE($6, optimized_order),
          status = COALESCE($7, status),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $8
      RETURNING *
    `, [
      name, 
      description, 
      points ? JSON.stringify(points) : null,
      totalDistance,
      estimatedTime,
      optimizedOrder ? JSON.stringify(optimizedOrder) : null,
      status,
      id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Rota não encontrada' });
    }

    const route = {
      id: result.rows[0].id,
      name: result.rows[0].name,
      description: result.rows[0].description,
      points: result.rows[0].points || [],
      totalDistance: parseFloat(result.rows[0].total_distance) || 0,
      estimatedTime: result.rows[0].estimated_time,
      optimizedOrder: result.rows[0].optimized_order || [],
      status: result.rows[0].status,
      createdAt: result.rows[0].created_at
    };

    res.json(route);
  } catch (error) {
    console.error('Error updating route:', error);
    console.error('Error details:', error.message);
    res.status(500).json({ error: 'Erro ao atualizar rota', details: error.message });
  }
});

// Delete route
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query('DELETE FROM routes WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Rota não encontrada' });
    }

    res.json({ success: true, id: result.rows[0].id });
  } catch (error) {
    console.error('Error deleting route:', error);
    res.status(500).json({ error: 'Erro ao deletar rota' });
  }
});

export default router;
