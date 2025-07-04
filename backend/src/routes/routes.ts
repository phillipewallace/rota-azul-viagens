
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

    console.log('Creating route with data:', { name, description, points: points?.length, totalDistance, estimatedTime });

    const result = await pool.query(`
      INSERT INTO routes (name, description, points, total_distance, estimated_time, optimized_order)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      name || 'Nova Rota', 
      description || '', 
      JSON.stringify(points || []), 
      totalDistance || 0, 
      estimatedTime || '0 min', 
      JSON.stringify(optimizedOrder || [])
    ]);

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

    console.log('Route created successfully:', route.id);
    res.json(route);
  } catch (error) {
    console.error('Error creating route:', error);
    res.status(500).json({ error: 'Erro ao criar rota', details: error.message });
  }
});

// Update route - COMPLETELY FIXED
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('=== ROUTE UPDATE DEBUG ===');
    console.log('Raw ID from params:', JSON.stringify(id));
    console.log('ID type:', typeof id);
    console.log('ID length:', id?.length);
    console.log('Request body:', JSON.stringify(req.body));
    console.log('========================');
    
    // Validação rigorosa do ID
    if (!id || 
        id === 'undefined' || 
        id === 'null' || 
        id === '' || 
        typeof id !== 'string' || 
        id.trim() === '' ||
        id.includes('undefined') ||
        id.includes('null')) {
      console.error('❌ Invalid route ID detected:', JSON.stringify(id));
      return res.status(400).json({ 
        error: 'ID da rota é obrigatório e deve ser válido',
        receivedId: id,
        idType: typeof id
      });
    }

    const cleanId = id.trim();
    console.log('✅ Clean ID:', cleanId);

    // Verificar se a rota existe
    const existingRoute = await pool.query('SELECT id, name FROM routes WHERE id = $1', [cleanId]);
    if (existingRoute.rows.length === 0) {
      console.error('❌ Route not found with ID:', cleanId);
      return res.status(404).json({ error: 'Rota não encontrada', searchedId: cleanId });
    }

    console.log('✅ Route found:', existingRoute.rows[0].name);

    const { name, description, points, totalDistance, estimatedTime, optimizedOrder, status } = req.body;

    // Construir query dinamicamente apenas com campos válidos
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined && name !== null && name !== '') {
      updates.push(`name = $${paramIndex}`);
      values.push(name);
      paramIndex++;
    }

    if (description !== undefined) {
      updates.push(`description = $${paramIndex}`);
      values.push(description || '');
      paramIndex++;
    }

    if (points !== undefined) {
      updates.push(`points = $${paramIndex}`);
      values.push(JSON.stringify(points || []));
      paramIndex++;
    }

    if (totalDistance !== undefined && totalDistance !== null) {
      const numericDistance = parseFloat(totalDistance) || 0;
      updates.push(`total_distance = $${paramIndex}`);
      values.push(numericDistance);
      paramIndex++;
    }

    if (estimatedTime !== undefined && estimatedTime !== null) {
      updates.push(`estimated_time = $${paramIndex}`);
      values.push(estimatedTime || '0 min');
      paramIndex++;
    }

    if (optimizedOrder !== undefined) {
      updates.push(`optimized_order = $${paramIndex}`);
      values.push(JSON.stringify(optimizedOrder || []));
      paramIndex++;
    }

    if (status !== undefined && status !== null && status !== '') {
      updates.push(`status = $${paramIndex}`);
      values.push(status);
      paramIndex++;
    }

    if (updates.length === 0) {
      console.log('⚠️ No valid fields to update');
      return res.status(400).json({ error: 'Nenhum campo válido para atualizar' });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(cleanId);

    const query = `
      UPDATE routes 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    console.log('📝 Executing update query:', query);
    console.log('📝 With values:', values);

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      console.error('❌ Update failed - no rows affected');
      return res.status(404).json({ error: 'Falha ao atualizar rota' });
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
      createdAt: result.rows[0].created_at,
      updatedAt: result.rows[0].updated_at
    };

    console.log('✅ Route updated successfully:', route.id);
    res.json(route);
  } catch (error) {
    console.error('💥 Error updating route:', error);
    console.error('💥 Error message:', error.message);
    console.error('💥 Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Erro interno do servidor', 
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Delete route
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    console.log('Deleting route with ID:', id);

    // Validação do ID
    if (!id || id === 'undefined' || id === 'null' || typeof id !== 'string' || id.trim() === '') {
      console.error('Invalid route ID for deletion:', id);
      return res.status(400).json({ error: 'ID da rota é obrigatório para exclusão' });
    }

    const result = await pool.query('DELETE FROM routes WHERE id = $1 RETURNING id', [id.trim()]);

    if (result.rows.length === 0) {
      console.error('Route not found for deletion:', id);
      return res.status(404).json({ error: 'Rota não encontrada' });
    }

    console.log('Route deleted successfully:', result.rows[0].id);
    res.json({ success: true, id: result.rows[0].id });
  } catch (error) {
    console.error('Error deleting route:', error);
    res.status(500).json({ error: 'Erro ao deletar rota', details: error.message });
  }
});

export default router;
