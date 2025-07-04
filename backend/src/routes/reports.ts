
import { Router } from 'express';
import { pool } from '../config/database';

const router = Router();

// Get report statistics
router.get('/stats', async (req, res) => {
  try {
    const [routesResult, trucksResult, tripsResult, maintenanceResult] = await Promise.all([
      pool.query('SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = $1) as active FROM routes', ['active']),
      pool.query('SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = $1) as available FROM trucks', ['available']),
      pool.query('SELECT COUNT(*) as total, SUM(distance_km) as total_km FROM trips WHERE status = $1', ['completed']),
      pool.query('SELECT COUNT(*) as pending FROM maintenance WHERE status = $1', ['scheduled'])
    ]);

    const stats = {
      totalRoutes: parseInt(routesResult.rows[0].total) || 0,
      activeRoutes: parseInt(routesResult.rows[0].active) || 0,
      totalTrucks: parseInt(trucksResult.rows[0].total) || 0,
      availableTrucks: parseInt(trucksResult.rows[0].available) || 0,
      completedTrips: parseInt(tripsResult.rows[0].total) || 0,
      totalKm: parseFloat(tripsResult.rows[0].total_km) || 0,
      pendingMaintenance: parseInt(maintenanceResult.rows[0].pending) || 0
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching report stats:', error);
    res.status(500).json({ error: 'Erro ao buscar estatísticas' });
  }
});

// Get monthly performance
router.get('/monthly-performance', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        TO_CHAR(created_at, 'YYYY-MM') as month,
        COUNT(*) as trips,
        COALESCE(SUM(distance_km), 0) as total_km
      FROM trips 
      WHERE status = 'completed'
        AND created_at >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY TO_CHAR(created_at, 'YYYY-MM')
      ORDER BY month
    `);

    const performance = result.rows.map(row => ({
      month: row.month,
      trips: parseInt(row.trips) || 0,
      totalKm: parseFloat(row.total_km) || 0
    }));

    res.json(performance);
  } catch (error) {
    console.error('Error fetching monthly performance:', error);
    res.status(500).json({ error: 'Erro ao buscar performance mensal' });
  }
});

// Get route usage
router.get('/route-usage', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        r.name,
        COUNT(t.id) as usage
      FROM routes r
      LEFT JOIN trips t ON r.id = t.route_id AND t.status = 'completed'
      WHERE t.created_at >= CURRENT_DATE - INTERVAL '6 months' OR t.created_at IS NULL
      GROUP BY r.id, r.name
      ORDER BY usage DESC
      LIMIT 10
    `);

    const usage = result.rows.map(row => ({
      name: row.name,
      usage: parseInt(row.usage) || 0
    }));

    res.json(usage);
  } catch (error) {
    console.error('Error fetching route usage:', error);
    res.status(500).json({ error: 'Erro ao buscar uso de rotas' });
  }
});

// Get maintenance stats
router.get('/maintenance-stats', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        maintenance_type,
        COUNT(*) as count,
        AVG(cost) as avg_cost
      FROM maintenance
      WHERE created_at >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY maintenance_type
      ORDER BY count DESC
    `);

    const stats = result.rows.map(row => ({
      type: row.maintenance_type,
      count: parseInt(row.count) || 0,
      averageCost: parseFloat(row.avg_cost) || 0
    }));

    res.json(stats);
  } catch (error) {
    console.error('Error fetching maintenance stats:', error);
    res.status(500).json({ error: 'Erro ao buscar estatísticas de manutenção' });
  }
});

export default router;
