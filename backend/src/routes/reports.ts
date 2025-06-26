
import { Router } from 'express';
import { pool } from '../config/database';

const router = Router();

// Get report statistics
router.get('/stats', async (req, res) => {
  try {
    // Primeiro verifica se as tabelas existem
    const tablesCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('routes', 'trucks', 'trips', 'maintenance')
    `);

    if (tablesCheck.rows.length < 4) {
      return res.json({
        totalRoutes: 0,
        activeRoutes: 0,
        totalTrucks: 0,
        activeTrucks: 0,
        totalKm: 0,
        completedTrips: 0,
        pendingTrips: 0,
        upcomingMaintenance: []
      });
    }

    const result = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM routes) as "totalRoutes",
        (SELECT COUNT(*) FROM routes WHERE status = 'active') as "activeRoutes",
        (SELECT COUNT(*) FROM trucks) as "totalTrucks",
        (SELECT COUNT(*) FROM trucks WHERE status = 'active') as "activeTrucks",
        (SELECT COALESCE(SUM(distance_km), 0) FROM trips WHERE created_at >= date_trunc('month', CURRENT_DATE)) as "totalKm",
        (SELECT COUNT(*) FROM trips WHERE status = 'completed') as "completedTrips",
        (SELECT COUNT(*) FROM trips WHERE status = 'pending') as "pendingTrips"
    `);

    const upcomingMaintenance = await pool.query(`
      SELECT 
        t.name as "truckName",
        m.maintenance_type as "maintenanceType",
        m.scheduled_date::text as "scheduledDate",
        (m.scheduled_date - CURRENT_DATE) as "daysRemaining"
      FROM maintenance m
      JOIN trucks t ON m.truck_id = t.id
      WHERE m.scheduled_date >= CURRENT_DATE
      ORDER BY m.scheduled_date
      LIMIT 5
    `);

    res.json({
      ...result.rows[0],
      upcomingMaintenance: upcomingMaintenance.rows
    });
  } catch (error) {
    console.error('Error fetching report stats:', error);
    // Retorna dados vazios em caso de erro
    res.json({
      totalRoutes: 0,
      activeRoutes: 0,
      totalTrucks: 0,
      activeTrucks: 0,
      totalKm: 0,
      completedTrips: 0,
      pendingTrips: 0,
      upcomingMaintenance: []
    });
  }
});

// Get monthly performance
router.get('/monthly-performance', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        TO_CHAR(date_trunc('month', created_at), 'Mon') as month,
        COUNT(*) as trips,
        COALESCE(SUM(distance_km), 0) as km
      FROM trips
      WHERE created_at >= CURRENT_DATE - INTERVAL '6 months'
      GROUP BY date_trunc('month', created_at)
      ORDER BY date_trunc('month', created_at)
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching monthly performance:', error);
    res.json([]);
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
      LEFT JOIN trips t ON r.id = t.route_id
      GROUP BY r.id, r.name
      ORDER BY usage DESC
      LIMIT 10
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching route usage:', error);
    res.json([]);
  }
});

// Get maintenance stats
router.get('/maintenance-stats', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        maintenance_type as name,
        COUNT(*) as value
      FROM maintenance
      WHERE scheduled_date >= CURRENT_DATE - INTERVAL '3 months'
      GROUP BY maintenance_type
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching maintenance stats:', error);
    res.json([]);
  }
});

export default router;
