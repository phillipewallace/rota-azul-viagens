
import { Router } from 'express';
import { pool } from '../config/database';

const router = Router();

// Get all trucks with driver and route information
router.get('/', async (req, res) => {
  try {
    console.log('🚛 Fetching all trucks...');
    
    const query = `
      SELECT 
        t.id,
        t.name,
        t.plate,
        t.model,
        t.year,
        t.status,
        t.current_route,
        t.driver,
        t.last_maintenance,
        t.mileage,
        t.location_lat,
        t.location_lng,
        d.name as driver_name,
        r.name as current_route_name
      FROM trucks t
      LEFT JOIN drivers d ON t.current_driver_id = d.id
      LEFT JOIN routes r ON t.current_route_id = r.id
      ORDER BY t.created_at DESC
    `;
    
    const result = await pool.query(query);
    
    const trucks = result.rows.map(truck => ({
      id: truck.id,
      name: truck.name,
      plate: truck.plate,
      model: truck.model,
      year: truck.year,
      status: truck.status,
      currentRoute: truck.current_route || truck.current_route_name,
      currentRouteName: truck.current_route_name,
      driver: truck.driver || truck.driver_name,
      driverName: truck.driver_name,
      lastMaintenance: truck.last_maintenance,
      mileage: truck.mileage || 0,
      location: truck.location_lat && truck.location_lng ? {
        lat: parseFloat(truck.location_lat),
        lng: parseFloat(truck.location_lng)
      } : null
    }));

    console.log(`✅ Found ${trucks.length} trucks`);
    res.json(trucks);
  } catch (error) {
    console.error('❌ Error fetching trucks:', error);
    res.status(500).json({ error: 'Erro ao buscar caminhões' });
  }
});

// Link route to truck
router.post('/link-route', async (req, res) => {
  try {
    const { truckId, routeId } = req.body;
    
    console.log(`🔗 Linking route ${routeId} to truck ${truckId}`);
    
    if (!truckId || !routeId) {
      return res.status(400).json({ error: 'Truck ID and Route ID are required' });
    }
    
    // Update truck with route
    const result = await pool.query(
      'UPDATE trucks SET current_route_id = $1, current_route = $2, status = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *',
      [routeId, routeId, 'in-route', truckId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Caminhão não encontrado' });
    }
    
    console.log('✅ Route linked successfully');
    res.json({ success: true, message: 'Rota vinculada com sucesso' });
  } catch (error) {
    console.error('❌ Error linking route:', error);
    res.status(500).json({ error: 'Erro ao vincular rota' });
  }
});

// Get single truck by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT 
        t.*,
        d.name as driver_name,
        r.name as route_name
      FROM trucks t
      LEFT JOIN drivers d ON t.current_driver_id = d.id
      LEFT JOIN routes r ON t.current_route_id = r.id
      WHERE t.id = $1
    `;
    
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Caminhão não encontrado' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error fetching truck:', error);
    res.status(500).json({ error: 'Erro ao buscar caminhão' });
  }
});

// Create new truck
router.post('/', async (req, res) => {
  try {
    console.log('🚛 Creating new truck...', req.body);
    
    const { name, plate, model, year, status, driver, currentRoute, mileage, lastMaintenance } = req.body;
    
    // Validate required fields
    if (!name || !plate || !model || !year) {
      return res.status(400).json({ error: 'Campos obrigatórios: nome, placa, modelo e ano' });
    }
    
    const query = `
      INSERT INTO trucks (name, plate, model, year, status, driver, current_route, mileage, last_maintenance)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    
    const result = await pool.query(query, [
      name,
      plate.toUpperCase(),
      model,
      year,
      status || 'available',
      driver === 'none' || !driver ? null : driver,
      currentRoute === 'none' || !currentRoute ? null : currentRoute,
      mileage || 0,
      lastMaintenance || null
    ]);
    
    console.log('✅ Truck created:', result.rows[0].name);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error creating truck:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Placa já cadastrada' });
    }
    res.status(500).json({ error: 'Erro ao criar caminhão' });
  }
});

// Update truck
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🚛 Updating truck:', id, req.body);
    
    const { name, plate, model, year, status, driver, currentRoute, mileage, lastMaintenance } = req.body;
    
    // Validate required fields
    if (!name || !plate || !model || !year) {
      return res.status(400).json({ error: 'Campos obrigatórios: nome, placa, modelo e ano' });
    }
    
    const query = `
      UPDATE trucks 
      SET name = $1, plate = $2, model = $3, year = $4, status = $5, 
          driver = $6, current_route = $7, mileage = $8, last_maintenance = $9,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $10
      RETURNING *
    `;
    
    const result = await pool.query(query, [
      name,
      plate.toUpperCase(),
      model,
      year,
      status,
      driver === 'none' || !driver ? null : driver,
      currentRoute === 'none' || !currentRoute ? null : currentRoute,
      mileage || 0,
      lastMaintenance || null,
      id
    ]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Caminhão não encontrado' });
    }
    
    console.log('✅ Truck updated:', result.rows[0].name);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error updating truck:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Placa já cadastrada' });
    }
    res.status(500).json({ error: 'Erro ao atualizar caminhão' });
  }
});

// Update truck location
router.put('/:id/location', async (req, res) => {
  try {
    const { id } = req.params;
    const { lat, lng } = req.body;
    
    // Update truck location
    await pool.query(
      'UPDATE trucks SET location_lat = $1, location_lng = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
      [lat, lng, id]
    );
    
    // Insert location history
    await pool.query(
      'INSERT INTO truck_location_history (truck_id, lat, lng) VALUES ($1, $2, $3)',
      [id, lat, lng]
    );
    
    console.log(`📍 Location updated for truck ${id}: ${lat}, ${lng}`);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error updating truck location:', error);
    res.status(500).json({ error: 'Erro ao atualizar localização' });
  }
});

// Delete truck
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query('DELETE FROM trucks WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Caminhão não encontrado' });
    }
    
    console.log('✅ Truck deleted:', result.rows[0].name);
    res.json({ message: 'Caminhão excluído com sucesso' });
  } catch (error) {
    console.error('❌ Error deleting truck:', error);
    res.status(500).json({ error: 'Erro ao excluir caminhão' });
  }
});

export default router;
