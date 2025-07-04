
import { Router } from 'express';
import { pool } from '../config/database';

const router = Router();

// Get dashboard statistics
router.get('/stats', async (req, res) => {
  try {
    const statsQuery = `
      SELECT 
        (SELECT COUNT(*) FROM trips WHERE status = 'completed') as total_trips,
        (SELECT COUNT(*) FROM drivers WHERE status = 'active') as active_drivers,
        (SELECT COUNT(*) FROM trucks WHERE status != 'maintenance') as active_trucks,
        (SELECT COUNT(*) FROM routes WHERE status = 'active') as active_routes,
        (SELECT COALESCE(SUM(distance_traveled), 0) FROM performance_metrics WHERE date >= CURRENT_DATE - INTERVAL '30 days') as monthly_distance,
        (SELECT COALESCE(AVG(fuel_efficiency), 0) FROM performance_metrics WHERE date >= CURRENT_DATE - INTERVAL '30 days') as avg_fuel_efficiency
    `;

    const result = await pool.query(statsQuery);
    const stats = result.rows[0];

    res.json({
      totalTrips: parseInt(stats.total_trips) || 0,
      activeDrivers: parseInt(stats.active_drivers) || 0,
      activeTrucks: parseInt(stats.active_trucks) || 0,
      activeRoutes: parseInt(stats.active_routes) || 0,
      monthlyDistance: parseFloat(stats.monthly_distance) || 0,
      avgFuelEfficiency: parseFloat(stats.avg_fuel_efficiency) || 0
    });
  } catch (error) {
    console.error('Error fetching management stats:', error);
    res.status(500).json({ error: 'Erro ao buscar estatísticas' });
  }
});

// Get monthly performance data
router.get('/monthly-performance', async (req, res) => {
  try {
    const { year = new Date().getFullYear() } = req.query;
    
    const performanceQuery = `
      SELECT 
        month,
        total_trips,
        total_distance,
        total_fuel_cost,
        total_maintenance_cost,
        total_revenue,
        active_trucks,
        active_drivers
      FROM monthly_summaries 
      WHERE year = $1 
      ORDER BY month
    `;

    const result = await pool.query(performanceQuery, [year]);
    
    // Fill missing months with zeros
    const months = Array.from({ length: 12 }, (_, i) => {
      const monthData = result.rows.find(row => row.month === i + 1);
      return {
        month: i + 1,
        totalTrips: monthData?.total_trips || 0,
        totalDistance: parseFloat(monthData?.total_distance) || 0,
        totalFuelCost: parseFloat(monthData?.total_fuel_cost) || 0,
        totalMaintenanceCost: parseFloat(monthData?.total_maintenance_cost) || 0,
        totalRevenue: parseFloat(monthData?.total_revenue) || 0,
        activeTrucks: monthData?.active_trucks || 0,
        activeDrivers: monthData?.active_drivers || 0
      };
    });

    res.json(months);
  } catch (error) {
    console.error('Error fetching monthly performance:', error);
    res.status(500).json({ error: 'Erro ao buscar dados mensais' });
  }
});

// Get route usage statistics
router.get('/route-usage', async (req, res) => {
  try {
    const routeUsageQuery = `
      SELECT 
        r.name,
        r.id,
        COALESCE(ra.times_used, 0) as usage_count,
        COALESCE(ra.average_completion_time, 0) as avg_completion_time,
        COALESCE(ra.efficiency_score, 0) as efficiency_score
      FROM routes r
      LEFT JOIN route_analytics ra ON r.id = ra.route_id 
        AND ra.date >= CURRENT_DATE - INTERVAL '30 days'
      WHERE r.status = 'active'
      ORDER BY COALESCE(ra.times_used, 0) DESC
      LIMIT 10
    `;

    const result = await pool.query(routeUsageQuery);
    
    const routeUsage = result.rows.map(row => ({
      routeName: row.name,
      routeId: row.id,
      usageCount: parseInt(row.usage_count) || 0,
      avgCompletionTime: parseInt(row.average_completion_time) || 0,
      efficiencyScore: parseFloat(row.efficiency_score) || 0
    }));

    res.json(routeUsage);
  } catch (error) {
    console.error('Error fetching route usage:', error);
    res.status(500).json({ error: 'Erro ao buscar uso de rotas' });
  }
});

// Get maintenance statistics
router.get('/maintenance-stats', async (req, res) => {
  try {
    const maintenanceQuery = `
      SELECT 
        t.name as truck_name,
        t.plate,
        COUNT(m.id) as maintenance_count,
        COALESCE(SUM(m.cost), 0) as total_cost,
        MAX(m.completed_date) as last_maintenance
      FROM trucks t
      LEFT JOIN maintenance m ON t.id = m.truck_id 
        AND m.completed_date >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY t.id, t.name, t.plate
      ORDER BY total_cost DESC
    `;

    const result = await pool.query(maintenanceQuery);
    
    const maintenanceStats = result.rows.map(row => ({
      truckName: row.truck_name,
      plate: row.plate,
      maintenanceCount: parseInt(row.maintenance_count) || 0,
      totalCost: parseFloat(row.total_cost) || 0,
      lastMaintenance: row.last_maintenance
    }));

    res.json(maintenanceStats);
  } catch (error) {
    console.error('Error fetching maintenance stats:', error);
    res.status(500).json({ error: 'Erro ao buscar dados de manutenção' });
  }
});

// Generate report data for specific period
router.get('/report-data', async (req, res) => {
  try {
    const { month, year } = req.query;
    
    if (!month || !year) {
      return res.status(400).json({ error: 'Mês e ano são obrigatórios' });
    }

    // Get summary data for the period
    const summaryQuery = `
      SELECT * FROM monthly_summaries 
      WHERE month = $1 AND year = $2
    `;
    
    const summaryResult = await pool.query(summaryQuery, [month, year]);
    const summary = summaryResult.rows[0];

    if (!summary) {
      return res.json({
        period: `${month}/${year}`,
        summary: {
          totalTrips: 0,
          totalDistance: 0,
          totalFuelCost: 0,
          totalMaintenanceCost: 0,
          totalRevenue: 0,
          activeTrucks: 0,
          activeDrivers: 0
        },
        topRoutes: [],
        truckPerformance: [],
        driverPerformance: []
      });
    }

    // Get top routes for the period
    const topRoutesQuery = `
      SELECT 
        r.name,
        COUNT(t.id) as trip_count,
        SUM(t.distance_km) as total_distance
      FROM trips t
      JOIN routes r ON t.route_id = r.id
      WHERE EXTRACT(MONTH FROM t.completed_at) = $1 
        AND EXTRACT(YEAR FROM t.completed_at) = $2
        AND t.status = 'completed'
      GROUP BY r.id, r.name
      ORDER BY trip_count DESC
      LIMIT 5
    `;

    const topRoutesResult = await pool.query(topRoutesQuery, [month, year]);

    // Get truck performance
    const truckPerformanceQuery = `
      SELECT 
        tr.name,
        tr.plate,
        COUNT(t.id) as trips,
        COALESCE(SUM(t.distance_km), 0) as distance,
        COALESCE(AVG(pm.fuel_efficiency), 0) as efficiency
      FROM trucks tr
      LEFT JOIN trips t ON tr.id = t.truck_id 
        AND EXTRACT(MONTH FROM t.completed_at) = $1
        AND EXTRACT(YEAR FROM t.completed_at) = $2
        AND t.status = 'completed'
      LEFT JOIN performance_metrics pm ON tr.id = pm.truck_id
        AND EXTRACT(MONTH FROM pm.date) = $1
        AND EXTRACT(YEAR FROM pm.date) = $2
      GROUP BY tr.id, tr.name, tr.plate
      ORDER BY trips DESC
      LIMIT 10
    `;

    const truckPerformanceResult = await pool.query(truckPerformanceQuery, [month, year]);

    const reportData = {
      period: `${month}/${year}`,
      summary: {
        totalTrips: summary.total_trips || 0,
        totalDistance: parseFloat(summary.total_distance) || 0,
        totalFuelCost: parseFloat(summary.total_fuel_cost) || 0,
        totalMaintenanceCost: parseFloat(summary.total_maintenance_cost) || 0,
        totalRevenue: parseFloat(summary.total_revenue) || 0,
        activeTrucks: summary.active_trucks || 0,
        activeDrivers: summary.active_drivers || 0
      },
      topRoutes: topRoutesResult.rows.map(row => ({
        name: row.name,
        tripCount: parseInt(row.trip_count) || 0,
        totalDistance: parseFloat(row.total_distance) || 0
      })),
      truckPerformance: truckPerformanceResult.rows.map(row => ({
        name: row.name,
        plate: row.plate,
        trips: parseInt(row.trips) || 0,
        distance: parseFloat(row.distance) || 0,
        efficiency: parseFloat(row.efficiency) || 0
      }))
    };

    res.json(reportData);
  } catch (error) {
    console.error('Error generating report data:', error);
    res.status(500).json({ error: 'Erro ao gerar dados do relatório' });
  }
});

export default router;
