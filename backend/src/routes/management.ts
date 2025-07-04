
import { Router } from 'express';
import { pool } from '../config/database';

const router = Router();

// Get management statistics
router.get('/stats', async (req, res) => {
  try {
    console.log('📊 Fetching management stats...');
    
    // Get trucks stats
    const trucksQuery = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'available' THEN 1 END) as available,
        COUNT(CASE WHEN status = 'in_route' THEN 1 END) as in_route,
        COUNT(CASE WHEN status = 'maintenance' THEN 1 END) as in_maintenance
      FROM trucks
    `;
    
    // Get maintenance stats
    const maintenanceQuery = `
      SELECT 
        COUNT(*) as total_maintenances,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress
      FROM maintenance_records
    `;
    
    // Get upcoming maintenance
    const upcomingQuery = `
      SELECT COUNT(*) as upcoming_count
      FROM maintenance_records 
      WHERE scheduled_date >= CURRENT_DATE 
      AND scheduled_date <= CURRENT_DATE + INTERVAL '30 days'
      AND status != 'completed'
    `;
    
    // Get costs
    const costsQuery = `
      SELECT 
        COALESCE(SUM(cost), 0) as total_cost,
        COALESCE(AVG(cost), 0) as avg_cost
      FROM maintenance_records 
      WHERE maintenance_date >= CURRENT_DATE - INTERVAL '30 days'
    `;

    const [trucksResult, maintenanceResult, upcomingResult, costsResult] = await Promise.all([
      pool.query(trucksQuery),
      pool.query(maintenanceQuery),
      pool.query(upcomingQuery),
      pool.query(costsQuery)
    ]);

    const stats = {
      trucks: {
        total: parseInt(trucksResult.rows[0]?.total) || 0,
        available: parseInt(trucksResult.rows[0]?.available) || 0,
        in_route: parseInt(trucksResult.rows[0]?.in_route) || 0,
        in_maintenance: parseInt(trucksResult.rows[0]?.in_maintenance) || 0
      },
      maintenance: {
        total_maintenances: parseInt(maintenanceResult.rows[0]?.total_maintenances) || 0,
        completed: parseInt(maintenanceResult.rows[0]?.completed) || 0,
        pending: parseInt(maintenanceResult.rows[0]?.pending) || 0,
        in_progress: parseInt(maintenanceResult.rows[0]?.in_progress) || 0
      },
      upcoming: {
        upcoming_count: parseInt(upcomingResult.rows[0]?.upcoming_count) || 0
      },
      costs: {
        total_cost: parseFloat(costsResult.rows[0]?.total_cost) || 0,
        avg_cost: parseFloat(costsResult.rows[0]?.avg_cost) || 0
      }
    };

    console.log('✅ Management stats loaded successfully');
    res.json(stats);
  } catch (error) {
    console.error('❌ Error fetching management stats:', error);
    res.status(500).json({ error: 'Erro ao buscar estatísticas' });
  }
});

// Get maintenance records
router.get('/maintenance', async (req, res) => {
  try {
    console.log('🔧 Fetching maintenance records...');
    
    const { startDate, endDate, truckId, status, type } = req.query;
    
    let query = `
      SELECT 
        m.id,
        m.truck_id,
        m.maintenance_type,
        m.description,
        m.scheduled_date,
        m.cost,
        m.status,
        m.created_at,
        m.updated_at,
        t.name as truck_name,
        t.plate as truck_plate
      FROM maintenance_records m
      LEFT JOIN trucks t ON m.truck_id = t.id
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
    
    if (truckId) {
      query += ` AND m.truck_id = $${paramIndex}`;
      params.push(truckId);
      paramIndex++;
    }
    
    if (status) {
      query += ` AND m.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    
    if (type) {
      query += ` AND m.maintenance_type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }
    
    query += ' ORDER BY m.scheduled_date DESC, m.created_at DESC';
    
    const result = await pool.query(query, params);
    
    const maintenanceRecords = result.rows.map(record => ({
      id: record.id,
      truck_id: record.truck_id,
      truck_name: record.truck_name,
      truck_plate: record.truck_plate,
      maintenance_type: record.maintenance_type,
      description: record.description,
      scheduled_date: record.scheduled_date,
      cost: parseFloat(record.cost) || 0,
      status: record.status,
      created_at: record.created_at,
      updated_at: record.updated_at
    }));

    console.log(`✅ Found ${maintenanceRecords.length} maintenance records`);
    res.json(maintenanceRecords);
  } catch (error) {
    console.error('❌ Error fetching maintenance records:', error);
    res.status(500).json({ error: 'Erro ao buscar registros de manutenção' });
  }
});

// Create maintenance record
router.post('/maintenance', async (req, res) => {
  try {
    console.log('🔧 Creating maintenance record...');
    
    const { 
      truck_id, 
      maintenance_type, 
      description, 
      scheduled_date, 
      cost, 
      status 
    } = req.body;
    
    const query = `
      INSERT INTO maintenance_records (
        truck_id, maintenance_type, description, scheduled_date, cost, status
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    
    const result = await pool.query(query, [
      truck_id,
      maintenance_type,
      description,
      scheduled_date,
      parseFloat(cost) || 0,
      status || 'pending'
    ]);
    
    console.log('✅ Maintenance record created:', result.rows[0].id);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error creating maintenance record:', error);
    res.status(500).json({ error: 'Erro ao criar registro de manutenção' });
  }
});

// Update maintenance record
router.put('/maintenance/:id', async (req, res) => {
  try {
    console.log('🔧 Updating maintenance record:', req.params.id);
    
    const { id } = req.params;
    const { 
      maintenance_type, 
      description, 
      scheduled_date, 
      cost, 
      status 
    } = req.body;
    
    const query = `
      UPDATE maintenance_records 
      SET maintenance_type = $1, description = $2, scheduled_date = $3, 
          cost = $4, status = $5, updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING *
    `;
    
    const result = await pool.query(query, [
      maintenance_type,
      description,
      scheduled_date,
      parseFloat(cost) || 0,
      status,
      id
    ]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Registro de manutenção não encontrado' });
    }
    
    console.log('✅ Maintenance record updated:', id);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error updating maintenance record:', error);
    res.status(500).json({ error: 'Erro ao atualizar registro de manutenção' });
  }
});

// Delete maintenance record
router.delete('/maintenance/:id', async (req, res) => {
  try {
    console.log('🔧 Deleting maintenance record:', req.params.id);
    
    const { id } = req.params;
    
    const result = await pool.query('DELETE FROM maintenance_records WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Registro de manutenção não encontrado' });
    }
    
    console.log('✅ Maintenance record deleted:', id);
    res.json({ message: 'Registro de manutenção excluído com sucesso' });
  } catch (error) {
    console.error('❌ Error deleting maintenance record:', error);
    res.status(500).json({ error: 'Erro ao excluir registro de manutenção' });
  }
});

// Get costs summary
router.get('/costs-summary', async (req, res) => {
  try {
    console.log('💰 Fetching costs summary...');
    
    const { startDate, endDate } = req.query;
    
    let query = `
      SELECT 
        maintenance_type,
        COUNT(*) as count,
        COALESCE(SUM(cost), 0) as total_cost,
        COALESCE(AVG(cost), 0) as avg_cost
      FROM maintenance_records
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (startDate) {
      query += ` AND maintenance_date >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }
    
    if (endDate) {
      query += ` AND maintenance_date <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }
    
    query += ' GROUP BY maintenance_type ORDER BY total_cost DESC';
    
    const result = await pool.query(query, params);
    
    const summary = result.rows.map(row => ({
      maintenance_type: row.maintenance_type,
      count: parseInt(row.count),
      total_cost: parseFloat(row.total_cost),
      avg_cost: parseFloat(row.avg_cost)
    }));

    console.log(`✅ Found ${summary.length} cost summary items`);
    res.json(summary);
  } catch (error) {
    console.error('❌ Error fetching costs summary:', error);
    res.status(500).json({ error: 'Erro ao buscar resumo de custos' });
  }
});

export default router;
