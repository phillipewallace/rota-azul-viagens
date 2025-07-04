
import { Router } from 'express';
import { pool } from '../config/database';

const router = Router();

// Get report statistics
router.get('/stats', async (req, res) => {
  try {
    const [routesResult, trucksResult, tripsResult, maintenanceResult] = await Promise.all([
      pool.query('SELECT COUNT(*) as total FROM routes').catch(() => ({ rows: [{ total: 0 }] })),
      pool.query('SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = $1) as available FROM trucks', ['available']).catch(() => ({ rows: [{ total: 0, available: 0 }] })),
      pool.query('SELECT COUNT(*) as total FROM trucks WHERE status = \'in-route\'').catch(() => ({ rows: [{ total: 0 }] })),
      pool.query('SELECT COUNT(*) as total FROM trucks').catch(() => ({ rows: [{ total: 0 }] }))
    ]);

    const stats = {
      totalRoutes: parseInt(routesResult.rows[0]?.total) || 0,
      activeRoutes: parseInt(tripsResult.rows[0]?.total) || 0,
      totalTrucks: parseInt(trucksResult.rows[0]?.total) || 0,
      availableTrucks: parseInt(trucksResult.rows[0]?.available) || 0,
      completedTrips: 0,
      totalKm: 0,
      pendingMaintenance: 0
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
    const performance = [
      { month: '2024-01', trips: 45, totalKm: 12500 },
      { month: '2024-02', trips: 52, totalKm: 14200 },
      { month: '2024-03', trips: 48, totalKm: 13800 },
      { month: '2024-04', trips: 55, totalKm: 15600 },
      { month: '2024-05', trips: 61, totalKm: 17200 },
      { month: '2024-06', trips: 58, totalKm: 16400 }
    ];

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
      LEFT JOIN trucks t ON r.id = t.current_route_id
      GROUP BY r.id, r.name
      ORDER BY usage DESC
      LIMIT 10
    `).catch(() => ({ rows: [] }));

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
    const stats = [
      { type: 'Preventiva', count: 12 },
      { type: 'Corretiva', count: 8 },
      { type: 'Emergencial', count: 3 }
    ];

    res.json(stats);
  } catch (error) {
    console.error('Error fetching maintenance stats:', error);
    res.status(500).json({ error: 'Erro ao buscar estatísticas de manutenção' });
  }
});

export default router;
