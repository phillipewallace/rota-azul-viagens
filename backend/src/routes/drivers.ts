
import { Router } from 'express';
import { pool } from '../config/database';

const router = Router();

// Get all drivers
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, phone, email, license, status, current_route, total_trips
      FROM drivers
      ORDER BY name
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching drivers:', error);
    res.status(500).json({ error: 'Erro ao buscar motoristas' });
  }
});

// Create new driver
router.post('/', async (req, res) => {
  try {
    const { name, license, phone, email, status, currentRoute } = req.body;

    const result = await pool.query(`
      INSERT INTO drivers (name, license, phone, email, status, current_route, total_trips)
      VALUES ($1, $2, $3, $4, $5, $6, 0)
      RETURNING *
    `, [name, license, phone, email, status || 'available', currentRoute]);

    const driver = result.rows[0];
    res.json({
      id: driver.id,
      name: driver.name,
      phone: driver.phone,
      email: driver.email,
      license: driver.license,
      status: driver.status,
      currentRoute: driver.current_route,
      totalTrips: driver.total_trips
    });
  } catch (error) {
    console.error('Error creating driver:', error);
    res.status(500).json({ error: 'Erro ao criar motorista' });
  }
});

// Update driver
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, license, phone, email, status, currentRoute } = req.body;

    const result = await pool.query(`
      UPDATE drivers 
      SET name = COALESCE($1, name),
          license = COALESCE($2, license),
          phone = COALESCE($3, phone),
          email = COALESCE($4, email),
          status = COALESCE($5, status),
          current_route = COALESCE($6, current_route)
      WHERE id = $7
      RETURNING *
    `, [name, license, phone, email, status, currentRoute, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Motorista não encontrado' });
    }

    const driver = result.rows[0];
    res.json({
      id: driver.id,
      name: driver.name,
      phone: driver.phone,
      email: driver.email,
      license: driver.license,
      status: driver.status,
      currentRoute: driver.current_route,
      totalTrips: driver.total_trips
    });
  } catch (error) {
    console.error('Error updating driver:', error);
    res.status(500).json({ error: 'Erro ao atualizar motorista' });
  }
});

// Delete driver
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query('DELETE FROM drivers WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Motorista não encontrado' });
    }

    res.json({ success: true, id: result.rows[0].id });
  } catch (error) {
    console.error('Error deleting driver:', error);
    res.status(500).json({ error: 'Erro ao deletar motorista' });
  }
});

export default router;
