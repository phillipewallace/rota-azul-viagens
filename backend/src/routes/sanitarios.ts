import { Router } from 'express';
import { pool } from '../config/database';

const router = Router();

/**
 * GET /api/sanitarios — lista todos com status atual
 * query: ?status=...&q=numero
 */
router.get('/', async (req: any, res: any) => {
  try {
    const { status, q } = req.query;
    const conds: string[] = [];
    const params: any[] = [];
    if (status) {
      params.push(status);
      conds.push(`status = $${params.length}`);
    }
    if (q) {
      params.push(`%${q}%`);
      conds.push(`numero ILIKE $${params.length}`);
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const r = await pool.query(
      `SELECT * FROM sanitarios ${where} ORDER BY numero ASC`,
      params
    );
    res.json(r.rows);
  } catch (e: any) {
    console.error('[SANITARIOS] list err:', e);
    res.status(500).json({ error: e?.message || 'erro' });
  }
});

/**
 * POST /api/sanitarios — cria/atualiza por numero
 */
router.post('/', async (req: any, res: any) => {
  try {
    const { numero, modelo, status, notes } = req.body || {};
    if (!numero) return res.status(400).json({ error: 'numero obrigatório' });
    const r = await pool.query(
      `INSERT INTO sanitarios (numero, modelo, status, notes)
       VALUES ($1, $2, COALESCE($3,'disponivel'), $4)
       ON CONFLICT (numero) DO UPDATE SET
         modelo = COALESCE(EXCLUDED.modelo, sanitarios.modelo),
         notes = COALESCE(EXCLUDED.notes, sanitarios.notes),
         updated_at = NOW()
       RETURNING *`,
      [numero, modelo || null, status || null, notes || null]
    );
    res.json(r.rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'erro' });
  }
});

/**
 * GET /api/sanitarios/:numero — detalhes + histórico
 */
router.get('/:numero', async (req: any, res: any) => {
  try {
    const { numero } = req.params;
    const s = await pool.query(`SELECT * FROM sanitarios WHERE numero = $1`, [numero]);
    if (!s.rows[0]) return res.status(404).json({ error: 'não encontrado' });
    const hist = await pool.query(
      `SELECT * FROM sanitario_movimentacoes
        WHERE sanitario_id = $1
        ORDER BY occurred_at DESC`,
      [s.rows[0].id]
    );
    res.json({ ...s.rows[0], historico: hist.rows });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'erro' });
  }
});

/**
 * Helper interno: registra movimentação e atualiza status do sanitário.
 * Chamado pelos endpoints abaixo (entrega/recolhimento/manutencao).
 */
async function registrarMovimentacao(opts: {
  numero: string;
  operationType: 'entrega' | 'recolhimento' | 'manutencao' | 'transferencia';
  routeId?: string;
  routePointId?: string;
  customerName?: string;
  address?: string;
  lat?: number;
  lng?: number;
  driverId?: string;
  driverName?: string;
  truckId?: string;
  notes?: string;
}) {
  // Garante que o sanitário existe (auto-cria se vier um número novo da rota)
  let s = await pool.query(`SELECT id FROM sanitarios WHERE numero = $1`, [opts.numero]);
  if (!s.rows[0]) {
    s = await pool.query(
      `INSERT INTO sanitarios (numero, status) VALUES ($1, 'disponivel') RETURNING id`,
      [opts.numero]
    );
  }
  const sanId = s.rows[0].id;

  // Atualiza estado atual conforme a operação
  if (opts.operationType === 'entrega') {
    await pool.query(
      `UPDATE sanitarios SET
         status = 'em_cliente',
         current_route_point_id = $2::uuid,
         current_customer_name = $3,
         current_address = $4,
         current_lat = $5,
         current_lng = $6,
         installed_at = NOW(),
         updated_at = NOW()
       WHERE id = $1`,
      [sanId, opts.routePointId || null, opts.customerName || null, opts.address || null, opts.lat ?? null, opts.lng ?? null]
    );
  } else if (opts.operationType === 'recolhimento') {
    await pool.query(
      `UPDATE sanitarios SET
         status = 'disponivel',
         current_route_point_id = NULL,
         current_customer_name = NULL,
         current_address = NULL,
         current_lat = NULL,
         current_lng = NULL,
         installed_at = NULL,
         updated_at = NOW()
       WHERE id = $1`,
      [sanId]
    );
  } else if (opts.operationType === 'manutencao') {
    await pool.query(
      `UPDATE sanitarios SET status = 'manutencao', updated_at = NOW() WHERE id = $1`,
      [sanId]
    );
  }

  await pool.query(
    `INSERT INTO sanitario_movimentacoes
       (sanitario_id, sanitario_numero, operation_type, route_id, route_point_id,
        customer_name, address, lat, lng, driver_id, driver_name, truck_id, notes)
     VALUES ($1,$2,$3,$4::uuid,$5::uuid,$6,$7,$8,$9,$10::uuid,$11,$12::uuid,$13)`,
    [
      sanId, opts.numero, opts.operationType,
      opts.routeId || null, opts.routePointId || null,
      opts.customerName || null, opts.address || null, opts.lat ?? null, opts.lng ?? null,
      opts.driverId || null, opts.driverName || null, opts.truckId || null,
      opts.notes || null,
    ]
  );

  return sanId;
}

/**
 * POST /api/sanitarios/movimentar
 * Body: { numeros: string[], operationType, routeId, routePointId, ... }
 *
 * Usado pelo mobile no momento da entrega/recolhimento/manutenção.
 */
router.post('/movimentar', async (req: any, res: any) => {
  try {
    const { numeros, operationType, routeId, routePointId, customerName, address, lat, lng,
            driverId, driverName, truckId, notes } = req.body || {};
    if (!Array.isArray(numeros) || numeros.length === 0) {
      return res.status(400).json({ error: 'numeros obrigatório (array)' });
    }
    if (!['entrega', 'recolhimento', 'manutencao', 'transferencia'].includes(operationType)) {
      return res.status(400).json({ error: 'operationType inválido' });
    }

    const ids: string[] = [];
    for (const numero of numeros) {
      const id = await registrarMovimentacao({
        numero: String(numero).trim(),
        operationType,
        routeId, routePointId, customerName, address, lat, lng,
        driverId, driverName, truckId, notes,
      });
      ids.push(id);
    }

    // Salva também no route_points qual numeração foi usada
    if (routePointId) {
      const col = operationType === 'recolhimento' ? 'sanitario_recolhidos' : 'sanitario_numbers';
      await pool.query(
        `UPDATE route_points
            SET ${col} = COALESCE(${col}, ARRAY[]::text[]) ||
                         (SELECT ARRAY(SELECT unnest($2::text[]) EXCEPT SELECT unnest(COALESCE(${col}, ARRAY[]::text[]))))
          WHERE id = $1::uuid`,
        [routePointId, numeros.map((n: any) => String(n).trim())]
      );
    }

    res.json({ ok: true, count: ids.length });
  } catch (e: any) {
    console.error('[SANITARIOS] movimentar err:', e);
    res.status(500).json({ error: e?.message || 'erro' });
  }
});

export default router;
