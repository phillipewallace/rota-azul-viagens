
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
          COALESCE(SUM(cost), 0) as total_cost,
          COALESCE(AVG(cost), 0) as avg_cost
        FROM maintenance 
        WHERE status = 'completed'
        AND created_at >= CURRENT_DATE - INTERVAL '30 days'
      `)
    ]);

    const stats = {
      trucks: trucksResult.rows[0],
      maintenance: maintenanceResult.rows[0],
      upcoming: upcomingResult.rows[0],
      costs: costsResult.rows[0]
    };

    res.json(stats);
  } catch (error) {
    console.error('Error getting maintenance stats:', error);
    res.status(500).json({ error: 'Internal server error' });
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
        t.plate as truck_plate
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

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error getting maintenance records:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create maintenance record
router.post('/maintenance', async (req, res) => {
  try {
    const { truck_id, maintenance_type, description, scheduled_date, cost, status = 'pending' } = req.body;

    const result = await pool.query(`
      INSERT INTO maintenance (truck_id, maintenance_type, description, scheduled_date, cost, status)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [truck_id, maintenance_type, description, scheduled_date, cost || 0, status]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating maintenance record:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update maintenance record
router.put('/maintenance/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { maintenance_type, description, scheduled_date, cost, status } = req.body;

    const result = await pool.query(`
      UPDATE maintenance 
      SET maintenance_type = COALESCE($1, maintenance_type),
          description = COALESCE($2, description),
          scheduled_date = COALESCE($3, scheduled_date),
          cost = COALESCE($4, cost),
          status = COALESCE($5, status),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING *
    `, [maintenance_type, description, scheduled_date, cost, status, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Maintenance record not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating maintenance record:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete maintenance record
router.delete('/maintenance/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query('DELETE FROM maintenance WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Maintenance record not found' });
    }

    res.json({ success: true, id: result.rows[0].id });
  } catch (error) {
    console.error('Error deleting maintenance record:', error);
    res.status(500).json({ error: 'Internal server error' });
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
        SUM(cost) as total_cost,
        AVG(cost) as avg_cost
      FROM maintenance 
      WHERE status = 'completed' AND cost > 0
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

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error getting costs summary:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
