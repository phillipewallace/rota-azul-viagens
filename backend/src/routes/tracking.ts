import { Router } from 'express';
import { pool } from '../config/database';

const router = Router();

/**
 * POST /api/tracking/location
 * Recebe ping de localização do app mobile (rastreamento em background)
 * Body: { routeId, truckId?, driverId?, lat, lng, speed?, timestamp? }
 */
router.post('/location', async (req: any, res: any) => {
  try {
    const { routeId, truckId, driverId, lat, lng, speed, timestamp } = req.body || {};
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({ error: 'lat/lng obrigatórios' });
    }
    const recordedAt = timestamp ? new Date(timestamp) : new Date();
    await pool.query(
      `INSERT INTO tracking_locations (route_id, truck_id, driver_id, lat, lng, speed, recorded_at)
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7)`,
      [routeId || null, truckId || null, driverId || null, lat, lng, speed ?? null, recordedAt]
    );
    res.json({ ok: true });
  } catch (e: any) {
    console.error('[TRACKING] erro:', e);
    res.status(500).json({ error: e?.message || 'erro' });
  }
});

/**
 * GET /api/tracking/route/:routeId
 * Retorna o trajeto registrado para uma rota
 */
router.get('/route/:routeId', async (req: any, res: any) => {
  try {
    const { routeId } = req.params;
    const r = await pool.query(
      `SELECT lat, lng, speed, recorded_at
         FROM tracking_locations
        WHERE route_id = $1::uuid
        ORDER BY recorded_at ASC`,
      [routeId]
    );
    res.json({ points: r.rows });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'erro' });
  }
});

/**
 * GET /api/tracking/truck/:truckId/latest
 * Última localização conhecida de um caminhão
 */
router.get('/truck/:truckId/latest', async (req: any, res: any) => {
  try {
    const { truckId } = req.params;
    const r = await pool.query(
      `SELECT lat, lng, speed, recorded_at, route_id
         FROM tracking_locations
        WHERE truck_id = $1::uuid
        ORDER BY recorded_at DESC
        LIMIT 1`,
      [truckId]
    );
    res.json(r.rows[0] || null);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'erro' });
  }
});

export default router;
