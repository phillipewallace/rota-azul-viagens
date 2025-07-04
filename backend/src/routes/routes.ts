
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
    
    // Validate ID
    if (!id || id === 'undefined' || id === 'null') {
      return res.status(400).json({ error: 'ID da rota é obrigatório' });
    }

    const { name, description, points, totalDistance, estimatedTime, optimizedOrder, status } = req.body;

    console.log('Updating route:', { id, body: req.body });

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      values.push(name);
      paramIndex++;
    }

    if (description !== undefined) {
      updates.push(`description = $${paramIndex}`);
      values.push(description);
      paramIndex++;
    }

    if (points !== undefined) {
      updates.push(`points = $${paramIndex}`);
      values.push(JSON.stringify(points));
      paramIndex++;
    }

    if (totalDistance !== undefined) {
      updates.push(`total_distance = $${paramIndex}`);
      values.push(totalDistance);
      paramIndex++;
    }

    if (estimatedTime !== undefined) {
      updates.push(`estimated_time = $${paramIndex}`);
      values.push(estimatedTime);
      paramIndex++;
    }

    if (optimizedOrder !== undefined) {
      updates.push(`optimized_order = $${paramIndex}`);
      values.push(JSON.stringify(optimizedOrder));
      paramIndex++;
    }

    if (status !== undefined) {
      updates.push(`status = $${paramIndex}`);
      values.push(status);
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const query = `
      UPDATE routes 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    console.log('Update query:', query);
    console.log('Update values:', values);

    const result = await pool.query(query, values);

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
    console.error('Error stack:', error.stack);
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
