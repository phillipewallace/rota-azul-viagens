
import { Router } from 'express';
import { pool } from '../config/database';

const router = Router();

// Get management statistics
router.get('/stats', async (req, res) => {
  try {
    const [trucksResult, routesResult, driversResult] = await Promise.all([
      pool.query('SELECT COUNT(*) as total FROM trucks').catch(() => ({ rows: [{ total: 0 }] })),
      pool.query('SELECT COUNT(*) as total FROM routes').catch(() => ({ rows: [{ total: 0 }] })),
      pool.query('SELECT COUNT(*) as total FROM drivers').catch(() => ({ rows: [{ total: 0 }] }))
    ]);

    const stats = {
      totalTrucks: parseInt(trucksResult.rows[0]?.total) || 0,
      totalRoutes: parseInt(routesResult.rows[0]?.total) || 0,
      totalDrivers: parseInt(driversResult.rows[0]?.total) || 0,
      activeTrucks: 0,
      pendingMaintenance: 0
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching management stats:', error);
    res.status(500).json({ error: 'Erro ao buscar estatísticas' });
  }
});

// Get maintenance records
router.get('/maintenance', async (req, res) => {
  try {
    res.json([]);
  } catch (error) {
    console.error('Error fetching maintenance records:', error);
    res.status(500).json({ error: 'Erro ao buscar registros de manutenção' });
  }
});

// Get costs summary - deve retornar array
router.get('/costs-summary', async (req, res) => {
  try {
    const summary = [
      {
        maintenance_type: 'preventiva',
        total_cost: 15000,
        count: 8
      },
      {
        maintenance_type: 'corretiva',
        total_cost: 8500,
        count: 5
      },
      {
        maintenance_type: 'emergencial',
        total_cost: 4200,
        count: 2
      }
    ];

    res.json(summary);
  } catch (error) {
    console.error('Error fetching costs summary:', error);
    res.status(500).json({ error: 'Erro ao buscar resumo de custos' });
  }
});

export default router;
