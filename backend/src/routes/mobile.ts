
import { Router } from 'express';
import { pool } from '../config/database';

const router = Router();

// Get truck by plate for mobile app
router.get('/truck/:plate', async (req, res) => {
  try {
    const { plate } = req.params;
    
    const result = await pool.query(`
      SELECT t.*, r.name as route_name, r.points as route_points
      FROM trucks t
      LEFT JOIN routes r ON t.current_route = r.name
      WHERE LOWER(t.plate) = LOWER($1)
    `, [plate]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Caminhão não encontrado' });
    }

    const truck = result.rows[0];
    
    const truckData = {
      id: truck.id,
      name: truck.name,
      plate: truck.plate,
      status: truck.status,
      currentRoute: truck.current_route ? {
        name: truck.route_name,
        points: truck.route_points || []
      } : null,
      location: truck.location_lat && truck.location_lng ? {
        lat: parseFloat(truck.location_lat),
        lng: parseFloat(truck.location_lng)
      } : null
    };

    res.json(truckData);
  } catch (error) {
    console.error('Error fetching truck by plate:', error);
    res.status(500).json({ error: 'Erro ao buscar caminhão' });
  }
});

// Update truck location from mobile app
router.put('/truck/:id/location', async (req, res) => {
  try {
    const { id } = req.params;
    const { lat, lng } = req.body;

    await pool.query(
      'UPDATE trucks SET location_lat = $1, location_lng = $2 WHERE id = $3',
      [lat, lng, id]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating truck location:', error);
    res.status(500).json({ error: 'Erro ao atualizar localização' });
  }
});

// Update route point status
router.put('/truck/:truckId/route/point/:pointId', async (req, res) => {
  try {
    const { truckId, pointId } = req.params;
    const { completed } = req.body;

    // Get current route
    const truckResult = await pool.query(
      'SELECT current_route FROM trucks WHERE id = $1',
      [truckId]
    );

    if (truckResult.rows.length === 0) {
      return res.status(404).json({ error: 'Caminhão não encontrado' });
    }

    const currentRoute = truckResult.rows[0].current_route;
    
    if (!currentRoute) {
      return res.status(400).json({ error: 'Caminhão não possui rota ativa' });
    }

    // Get route points
    const routeResult = await pool.query(
      'SELECT points FROM routes WHERE name = $1',
      [currentRoute]
    );

    if (routeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Rota não encontrada' });
    }

    let points = routeResult.rows[0].points || [];
    
    // Update point status
    points = points.map((point: any) => 
      point.id === pointId ? { ...point, completed } : point
    );

    // Update route in database
    await pool.query(
      'UPDATE routes SET points = $1 WHERE name = $2',
      [JSON.stringify(points), currentRoute]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating route point:', error);
    res.status(500).json({ error: 'Erro ao atualizar ponto da rota' });
  }
});

// Get driver routes/schedules
router.get('/driver/:driverId/schedules', async (req, res) => {
  try {
    const { driverId } = req.params;
    
    const result = await pool.query(`
      SELECT s.*, t.name as truck_name, t.plate as truck_plate
      FROM schedules s
      LEFT JOIN trucks t ON s.truck_id = t.id
      WHERE s.driver_id = $1 AND s.status IN ('scheduled', 'in-progress')
      ORDER BY s.scheduled_date ASC, s.scheduled_time ASC
    `, [driverId]);

    const schedules = result.rows.map(row => ({
      id: row.id,
      truck: {
        id: row.truck_id,
        name: row.truck_name,
        plate: row.truck_plate
      },
      route: row.route,
      scheduledDate: row.scheduled_date,
      scheduledTime: row.scheduled_time,
      status: row.status,
      notes: row.notes
    }));

    res.json(schedules);
  } catch (error) {
    console.error('Error fetching driver schedules:', error);
    res.status(500).json({ error: 'Erro ao buscar agendamentos do motorista' });
  }
});

export default router;
