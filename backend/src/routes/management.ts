
import express from 'express';
import { pool } from '../config/database';

const router = express.Router();

// Get maintenance statistics
router.get('/stats', async (req, res) => {
  try {
    const [
      trucksResult,
      maintenanceResult,
      upcomingResult,
      costsResult
    ] = await Promise.all([
      pool.query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available,
          SUM(CASE WHEN status = 'in-route' THEN 1 ELSE 0 END) as in_route,
          SUM(CASE WHEN status = 'maintenance' THEN 1 ELSE 0 END) as in_maintenance
        FROM trucks
      `),
      pool.query(`
        SELECT 
          COUNT(*) as total_maintenances,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress
        FROM maintenance
      `),
      pool.query(`
        SELECT COUNT(*) as upcoming_count
        FROM maintenance 
        WHERE scheduled_date > CURRENT_DATE 
        AND scheduled_date <= CURRENT_DATE + INTERVAL '30 days'
        AND status = 'pending'
      `),
      pool.query(`
        SELECT 
          COALESCE(SUM(CASE WHEN CAST(cost AS NUMERIC) > 0 THEN CAST(cost AS NUMERIC) ELSE 0 END), 0) as total_cost,
          COALESCE(AVG(CASE WHEN CAST(cost AS NUMERIC) > 0 THEN CAST(cost AS NUMERIC) ELSE NULL END), 0) as avg_cost
        FROM maintenance 
        WHERE status = 'completed'
        AND created_at >= CURRENT_DATE - INTERVAL '30 days'
      `)
    ]);

    const stats = {
      trucks: {
        total: parseInt(trucksResult.rows[0].total) || 0,
        available: parseInt(trucksResult.rows[0].available) || 0,
        in_route: parseInt(trucksResult.rows[0].in_route) || 0,
        in_maintenance: parseInt(trucksResult.rows[0].in_maintenance) || 0
      },
      maintenance: {
        total_maintenances: parseInt(maintenanceResult.rows[0].total_maintenances) || 0,
        completed: parseInt(maintenanceResult.rows[0].completed) || 0,
        pending: parseInt(maintenanceResult.rows[0].pending) || 0,
        in_progress: parseInt(maintenanceResult.rows[0].in_progress) || 0
      },
      upcoming: {
        upcoming_count: parseInt(upcomingResult.rows[0].upcoming_count) || 0
      },
      costs: {
        total_cost: parseFloat(costsResult.rows[0].total_cost) || 0,
        avg_cost: parseFloat(costsResult.rows[0].avg_cost) || 0
      }
    };

    console.log('Stats generated:', stats);
    res.json(stats);
  } catch (error) {
    console.error('Error getting maintenance stats:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Get maintenance records with filters
router.get('/maintenance', async (req, res) => {
  try {
    const { startDate, endDate, truckId, status, type } = req.query;
    
    let query = `
      SELECT 
        m.*,
        t.name as truck_name,
        t.plate as truck_plate,
        COALESCE(CAST(m.cost AS NUMERIC), 0) as cost
      FROM maintenance m
      JOIN trucks t ON m.truck_id = t.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;

    if (startDate) {
      query += ` AND m.scheduled_date >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND m.scheduled_date <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    if (truckId && truckId !== 'all') {
      query += ` AND m.truck_id = $${paramIndex}`;
      params.push(truckId);
      paramIndex++;
    }

    if (status && status !== 'all') {
      query += ` AND m.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (type && type !== 'all') {
      query += ` AND m.maintenance_type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    query += ` ORDER BY m.scheduled_date DESC LIMIT 50`;

    console.log('Executing maintenance query:', query, params);
    const result = await pool.query(query, params);
    
    // Garantir que todos os custos sejam numéricos
    const records = result.rows.map(row => ({
      ...row,
      cost: parseFloat(row.cost) || 0
    }));
    
    res.json(records);
  } catch (error) {
    console.error('Error getting maintenance records:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Create maintenance record
router.post('/maintenance', async (req, res) => {
  try {
    const { truck_id, maintenance_type, description, scheduled_date, cost, status = 'pending' } = req.body;

    console.log('Creating maintenance record:', { truck_id, maintenance_type, description, scheduled_date, cost, status });

    // Validação de dados
    if (!truck_id || !maintenance_type || !scheduled_date) {
      return res.status(400).json({ error: 'Campos obrigatórios: truck_id, maintenance_type, scheduled_date' });
    }

    const numericCost = parseFloat(cost) || 0;

    const result = await pool.query(`
      INSERT INTO maintenance (truck_id, maintenance_type, description, scheduled_date, cost, status, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
      RETURNING *, CAST(cost AS NUMERIC) as cost
    `, [truck_id, maintenance_type, description || '', scheduled_date, numericCost, status]);

    const record = {
      ...result.rows[0],
      cost: parseFloat(result.rows[0].cost) || 0
    };

    console.log('Maintenance record created:', record.id);
    res.json(record);
  } catch (error) {
    console.error('Error creating maintenance record:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Update maintenance record
router.put('/maintenance/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { maintenance_type, description, scheduled_date, cost, status } = req.body;

    console.log('Updating maintenance record:', id, req.body);

    // Validação do ID
    if (!id || id === 'undefined' || id === 'null') {
      return res.status(400).json({ error: 'ID da manutenção é obrigatório' });
    }

    const numericCost = cost !== undefined ? (parseFloat(cost) || 0) : undefined;

    const result = await pool.query(`
      UPDATE maintenance 
      SET maintenance_type = COALESCE($1, maintenance_type),
          description = COALESCE($2, description),
          scheduled_date = COALESCE($3, scheduled_date),
          cost = COALESCE($4, cost),
          status = COALESCE($5, status),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING *, CAST(cost AS NUMERIC) as cost
    `, [maintenance_type, description, scheduled_date, numericCost, status, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Maintenance record not found' });
    }

    const record = {
      ...result.rows[0],
      cost: parseFloat(result.rows[0].cost) || 0
    };

    console.log('Maintenance record updated:', record.id);
    res.json(record);
  } catch (error) {
    console.error('Error updating maintenance record:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Delete maintenance record
router.delete('/maintenance/:id', async (req, res) => {
  try {
    const { id } = req.params;

    console.log('Deleting maintenance record:', id);

    // Validação do ID
    if (!id || id === 'undefined' || id === 'null') {
      return res.status(400).json({ error: 'ID da manutenção é obrigatório' });
    }

    const result = await pool.query('DELETE FROM maintenance WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Maintenance record not found' });
    }

    console.log('Maintenance record deleted:', result.rows[0].id);
    res.json({ success: true, id: result.rows[0].id });
  } catch (error) {
    console.error('Error deleting maintenance record:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Get maintenance costs summary
router.get('/costs-summary', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let query = `
      SELECT 
        maintenance_type,
        COUNT(*) as count,
        SUM(CAST(cost AS NUMERIC)) as total_cost,
        AVG(CAST(cost AS NUMERIC)) as avg_cost
      FROM maintenance 
      WHERE status = 'completed' AND CAST(cost AS NUMERIC) > 0
    `;
    
    const params = [];
    let paramIndex = 1;

    if (startDate) {
      query += ` AND scheduled_date >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND scheduled_date <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    query += ` GROUP BY maintenance_type ORDER BY total_cost DESC`;

    console.log('Executing costs summary query:', query, params);
    const result = await pool.query(query, params);
    
    // Garantir que todos os valores sejam numéricos
    const summary = result.rows.map(row => ({
      maintenance_type: row.maintenance_type,
      count: parseInt(row.count) || 0,
      total_cost: parseFloat(row.total_cost) || 0,
      avg_cost: parseFloat(row.avg_cost) || 0
    }));
    
    res.json(summary);
  } catch (error) {
    console.error('Error getting costs summary:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

export default router;
