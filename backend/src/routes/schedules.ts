
import { Router } from 'express';
import { pool } from '../config/database';

const router = Router();

// Get all schedules
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.*, t.name as truck_name, t.plate as truck_plate,
             d.name as driver_name, r.name as route_name
      FROM schedules s
      LEFT JOIN trucks t ON s.truck_id::text = t.id::text
      LEFT JOIN drivers d ON s.driver_id::text = d.id::text
      LEFT JOIN routes r ON s.route_name = r.name
      ORDER BY s.scheduled_date DESC, s.scheduled_time DESC
    `);

    const schedules = result.rows.map(row => ({
      id: row.id,
      truckId: row.truck_id,
      truck: row.truck_name,
      route: row.route_name,
      driverId: row.driver_id,
      driver: row.driver_name,
      scheduledDate: row.scheduled_date,
      scheduledTime: row.scheduled_time,
      status: row.status,
      notes: row.notes
    }));

    res.json(schedules);
  } catch (error) {
    console.error('Error fetching schedules:', error);
    res.status(500).json({ error: 'Erro ao buscar agendamentos' });
  }
});

// Create new schedule
router.post('/', async (req, res) => {
  try {
    const { truckId, truck, route, driverId, driver, scheduledDate, scheduledTime, status, notes } = req.body;

    const result = await pool.query(`
      INSERT INTO schedules (truck_id, route_name, driver_id, scheduled_date, scheduled_time, status, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [truckId, route, driverId, scheduledDate, scheduledTime, status || 'scheduled', notes]);

    res.json({
      id: result.rows[0].id,
      truckId: result.rows[0].truck_id,
      truck,
      route,
      driverId: result.rows[0].driver_id,
      driver,
      scheduledDate: result.rows[0].scheduled_date,
      scheduledTime: result.rows[0].scheduled_time,
      status: result.rows[0].status,
      notes: result.rows[0].notes
    });
  } catch (error) {
    console.error('Error creating schedule:', error);
    res.status(500).json({ error: 'Erro ao criar agendamento' });
  }
});

// Update schedule
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { truckId, route, driverId, scheduledDate, scheduledTime, status, notes } = req.body;

    const result = await pool.query(`
      UPDATE schedules 
      SET truck_id = COALESCE($1, truck_id),
          route_name = COALESCE($2, route_name),
          driver_id = COALESCE($3, driver_id),
          scheduled_date = COALESCE($4, scheduled_date),
          scheduled_time = COALESCE($5, scheduled_time),
          status = COALESCE($6, status),
          notes = COALESCE($7, notes)
      WHERE id = $8
      RETURNING *
    `, [truckId, route, driverId, scheduledDate, scheduledTime, status, notes, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Agendamento não encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating schedule:', error);
    res.status(500).json({ error: 'Erro ao atualizar agendamento' });
  }
});

// Delete schedule
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query('DELETE FROM schedules WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Agendamento não encontrado' });
    }

    res.json({ success: true, id: result.rows[0].id });
  } catch (error) {
    console.error('Error deleting schedule:', error);
    res.status(500).json({ error: 'Erro ao deletar agendamento' });
  }
});

export default router;
