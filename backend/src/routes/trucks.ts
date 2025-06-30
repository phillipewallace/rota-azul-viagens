import { Router } from 'express';
import { pool } from '../config/database';

const router = Router();

// Get all trucks
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, plate, model, year, status, current_route, driver, 
             last_maintenance, mileage, location_lat, location_lng
      FROM trucks
      ORDER BY name
    `);

    const trucks = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      plate: row.plate,
      model: row.model,
      year: row.year,
      status: row.status,
      currentRoute: row.current_route,
      driver: row.driver,
      lastMaintenance: row.last_maintenance,
      mileage: row.mileage,
      location: row.location_lat && row.location_lng ? {
        lat: parseFloat(row.location_lat),
        lng: parseFloat(row.location_lng)
      } : undefined
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
    const { name, plate, model, year, driver } = req.body;

    const result = await pool.query(`
      INSERT INTO trucks (name, plate, model, year, driver)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [name, plate, model, year, driver]);

    res.json(result.rows[0]);
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
          driver = COALESCE($6, driver),
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
      currentRoute: truck.current_route,
      driver: truck.driver,
      lastMaintenance: truck.last_maintenance,
      mileage: truck.mileage,
      location: truck.location_lat && truck.location_lng ? {
        lat: parseFloat(truck.location_lat),
        lng: parseFloat(truck.location_lng)
      } : undefined
    });
  } catch (error) {
    console.error('Error updating truck:', error);
    res.status(500).json({ error: 'Erro ao atualizar caminhão' });
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
