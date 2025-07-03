import { Router } from 'express';
import { pool } from '../config/database';

const router = Router();

// Get all trucks
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.id, t.name, t.plate, t.model, t.year, t.status, 
             t.current_route_id, t.driver_id, t.last_maintenance, 
             t.mileage, t.location_lat, t.location_lng,
             d.name as driver_name,
             r.name as route_name
      FROM trucks t
      LEFT JOIN drivers d ON t.driver_id::text = d.id::text
      LEFT JOIN routes r ON t.current_route_id::text = r.id::text
      ORDER BY t.name
    `);

    const trucks = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      plate: row.plate,
      model: row.model,
      year: row.year,
      status: row.status,
      currentRoute: row.current_route_id,
      currentRouteName: row.route_name,
      driver: row.driver_id,
      driverName: row.driver_name,
      lastMaintenance: row.last_maintenance,
      mileage: row.mileage,
      location: row.location_lat && row.location_lng ? {
        lat: parseFloat(row.location_lat),
        lng: parseFloat(row.location_lng)
      } : null
    }));

    res.json(trucks);
  } catch (error) {
    console.error('Error fetching trucks:', error);
    res.status(500).json({ error: 'Erro ao buscar caminhões' });
  }
});

// Create new truck
router.post('/', async (req, res) => {
  try {
    const { name, plate, model, year, driver, mileage, lastMaintenance } = req.body;

    const result = await pool.query(`
      INSERT INTO trucks (name, plate, model, year, driver_id, mileage, last_maintenance)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [name, plate, model, year, driver || null, mileage || 0, lastMaintenance || null]);

    const truck = result.rows[0];
    res.json({
      id: truck.id,
      name: truck.name,
      plate: truck.plate,
      model: truck.model,
      year: truck.year,
      status: truck.status,
      currentRoute: truck.current_route_id,
      driver: truck.driver_id,
      lastMaintenance: truck.last_maintenance,
      mileage: truck.mileage,
      location: truck.location_lat && truck.location_lng ? {
        lat: parseFloat(truck.location_lat),
        lng: parseFloat(truck.location_lng)
      } : null
    });
  } catch (error) {
    console.error('Error creating truck:', error);
    res.status(500).json({ error: 'Erro ao criar caminhão' });
  }
});

// Update truck
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, plate, model, year, status, driver, mileage, lastMaintenance } = req.body;

    const result = await pool.query(`
      UPDATE trucks 
      SET name = COALESCE($1, name),
          plate = COALESCE($2, plate),
          model = COALESCE($3, model),
          year = COALESCE($4, year),
          status = COALESCE($5, status),
          driver_id = COALESCE($6, driver_id),
          mileage = COALESCE($7, mileage),
          last_maintenance = COALESCE($8, last_maintenance)
      WHERE id = $9
      RETURNING *
    `, [name, plate, model, year, status, driver, mileage, lastMaintenance, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Caminhão não encontrado' });
    }

    const truck = result.rows[0];
    res.json({
      id: truck.id,
      name: truck.name,
      plate: truck.plate,
      model: truck.model,
      year: truck.year,
      status: truck.status,
      currentRoute: truck.current_route_id,
      driver: truck.driver_id,
      lastMaintenance: truck.last_maintenance,
      mileage: truck.mileage,
      location: truck.location_lat && truck.location_lng ? {
        lat: parseFloat(truck.location_lat),
        lng: parseFloat(truck.location_lng)
      } : null
    });
  } catch (error) {
    console.error('Error updating truck:', error);
    res.status(500).json({ error: 'Erro ao atualizar caminhão' });
  }
});

// Link route to truck
router.post('/link-route', async (req, res) => {
  try {
    const { truckId, routeId } = req.body;

    // Update truck with route
    const truckResult = await pool.query(`
      UPDATE trucks 
      SET current_route_id = $1, status = 'in-route', route_started_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `, [routeId, truckId]);

    if (truckResult.rows.length === 0) {
      return res.status(404).json({ error: 'Caminhão não encontrado' });
    }

    // Insert into truck_routes table
    await pool.query(`
      INSERT INTO truck_routes (truck_id, route_id, status, assigned_at)
      VALUES ($1, $2, 'assigned', CURRENT_TIMESTAMP)
      ON CONFLICT (truck_id, route_id) DO UPDATE SET
        status = 'assigned',
        assigned_at = CURRENT_TIMESTAMP
    `, [truckId, routeId]);

    res.json({ success: true, message: 'Rota vinculada com sucesso' });
  } catch (error) {
    console.error('Error linking route to truck:', error);
    res.status(500).json({ error: 'Erro ao vincular rota' });
  }
});

// Finish route
router.post('/finish-route', async (req, res) => {
  try {
    const { truckId } = req.body;

    // Update truck status and remove current route
    await pool.query(`
      UPDATE trucks 
      SET current_route_id = NULL, status = 'available', route_started_at = NULL
      WHERE id = $1
    `, [truckId]);

    // Update route status to completed
    await pool.query(`
      UPDATE truck_routes
      SET status = 'completed', completed_at = CURRENT_TIMESTAMP
      WHERE truck_id = $1 AND status = 'assigned'
    `, [truckId]);

    res.json({ success: true, message: 'Rota finalizada com sucesso' });
  } catch (error) {
    console.error('Error finishing route:', error);
    res.status(500).json({ error: 'Erro ao finalizar rota' });
  }
});

// Delete truck
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query('DELETE FROM trucks WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Caminhão não encontrado' });
    }

    res.json({ success: true, id: result.rows[0].id });
  } catch (error) {
    console.error('Error deleting truck:', error);
    res.status(500).json({ error: 'Erro ao deletar caminhão' });
  }
});

// Update truck location
router.put('/:id/location', async (req, res) => {
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

export default router;
