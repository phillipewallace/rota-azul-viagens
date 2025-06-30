
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
