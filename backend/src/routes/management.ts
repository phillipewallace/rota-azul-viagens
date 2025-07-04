
import express from 'express';
import { pool } from '../config/database';

const router = express.Router();

// Get general statistics
router.get('/stats', async (req, res) => {
  try {
    const [
      trucksResult,
      driversResult,
      routesResult,
      tripsResult
    ] = await Promise.all([
      pool.query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available,
          SUM(CASE WHEN status = 'in-route' THEN 1 ELSE 0 END) as in_route,
          SUM(CASE WHEN status = 'maintenance' THEN 1 ELSE 0 END) as maintenance
        FROM trucks
      `),
      pool.query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active
        FROM drivers
      `),
      pool.query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active
        FROM routes
      `),
      pool.query(`
        SELECT 
          COUNT(*) as total_trips,
          COALESCE(SUM(distance_km), 0) as total_distance,
          COALESCE(AVG(duration_minutes), 0) as avg_duration
        FROM trips
        WHERE status = 'completed'
      `)
    ]);

    const stats = {
      trucks: trucksResult.rows[0],
      drivers: driversResult.rows[0],
      routes: routesResult.rows[0],
      trips: tripsResult.rows[0]
    };

    res.json(stats);
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get performance data with filters
router.get('/performance', async (req, res) => {
  try {
    const { startDate, endDate, truckId, routeId } = req.query;
    
    let query = `
      SELECT 
        DATE(t.completed_at) as date,
        COUNT(*) as trips,
        COALESCE(SUM(t.distance_km), 0) as total_distance,
        COALESCE(AVG(t.duration_minutes), 0) as avg_duration,
        tr.name as truck_name,
        r.name as route_name
      FROM trips t
      LEFT JOIN trucks tr ON t.truck_id = tr.id
      LEFT JOIN routes r ON t.route_id = r.id
      WHERE t.status = 'completed'
    `;
    
    const params = [];
    let paramIndex = 1;

    if (startDate) {
      query += ` AND t.completed_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND t.completed_at <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    if (truckId) {
      query += ` AND t.truck_id = $${paramIndex}`;
      params.push(truckId);
      paramIndex++;
    }

    if (routeId) {
      query += ` AND t.route_id = $${paramIndex}`;
      params.push(routeId);
      paramIndex++;
    }

    query += ` GROUP BY DATE(t.completed_at), tr.name, r.name ORDER BY date DESC LIMIT 30`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error getting performance data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get route usage statistics
router.get('/route-usage', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let query = `
      SELECT 
        r.name,
        r.id,
        COUNT(t.id) as usage_count,
        COALESCE(SUM(t.distance_km), 0) as total_distance,
        COALESCE(AVG(t.duration_minutes), 0) as avg_duration
      FROM routes r
      LEFT JOIN trips t ON r.id = t.route_id AND t.status = 'completed'
    `;
    
    const params = [];
    let paramIndex = 1;

    if (startDate) {
      query += ` AND t.completed_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND t.completed_at <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    query += ` GROUP BY r.id, r.name ORDER BY usage_count DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error getting route usage:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get truck performance
router.get('/truck-performance', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let query = `
      SELECT 
        tr.name,
        tr.id,
        tr.plate,
        COUNT(t.id) as trips_count,
        COALESCE(SUM(t.distance_km), 0) as total_distance,
        COALESCE(AVG(t.duration_minutes), 0) as avg_duration,
        tr.status
      FROM trucks tr
      LEFT JOIN trips t ON tr.id = t.truck_id AND t.status = 'completed'
    `;
    
    const params = [];
    let paramIndex = 1;

    if (startDate) {
      query += ` AND t.completed_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND t.completed_at <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    query += ` GROUP BY tr.id, tr.name, tr.plate, tr.status ORDER BY trips_count DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error getting truck performance:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Export report data
router.get('/export', async (req, res) => {
  try {
    const { startDate, endDate, format = 'json' } = req.query;
    
    // Get comprehensive report data
    const [statsResult, performanceResult, routeUsageResult] = await Promise.all([
      pool.query('SELECT COUNT(*) as total_trucks FROM trucks'),
      pool.query(`
        SELECT 
          DATE(completed_at) as date,
          COUNT(*) as trips,
          SUM(distance_km) as distance
        FROM trips 
        WHERE status = 'completed'
        ${startDate ? 'AND completed_at >= $1' : ''}
        ${endDate ? 'AND completed_at <= $2' : ''}
        GROUP BY DATE(completed_at)
        ORDER BY date DESC
      `, [startDate, endDate].filter(Boolean)),
      pool.query(`
        SELECT 
          r.name,
          COUNT(t.id) as usage
        FROM routes r
        LEFT JOIN trips t ON r.id = t.route_id
        GROUP BY r.name
        ORDER BY usage DESC
      `)
    ]);

    const reportData = {
      period: { startDate, endDate },
      stats: statsResult.rows[0],
      performance: performanceResult.rows,
      routeUsage: routeUsageResult.rows,
      generatedAt: new Date().toISOString()
    };

    res.json(reportData);
  } catch (error) {
    console.error('Error exporting report:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
