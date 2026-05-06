import { Router } from 'express';
import { pool } from '../config/database';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();

/**
 * GET /api/sanitarios — lista todos com status atual
 * query: ?status=...&q=numero
 */
router.get('/', requireAuth, async (req: any, res: any) => {
  try {
    const { status, q, truckId } = req.query;
    const conds: string[] = [];
    const params: any[] = [];
    if (status) {
      params.push(status);
      conds.push(`s.status = $${params.length}`);
    }
    if (q) {
      params.push(`%${q}%`);
      conds.push(`(s.numero ILIKE $${params.length} OR s.current_customer_name ILIKE $${params.length} OR s.current_address ILIKE $${params.length})`);
    }
    if (truckId) {
      params.push(truckId);
      conds.push(`lm.truck_id = $${params.length}`);
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const r = await pool.query(
      `SELECT s.*, lm.truck_id AS current_truck_id, t.name AS current_truck_name, t.plate AS current_truck_plate
         FROM sanitarios s
         LEFT JOIN LATERAL (
           SELECT truck_id FROM sanitario_movimentacoes m
            WHERE m.sanitario_id = s.id AND m.truck_id IS NOT NULL
            ORDER BY occurred_at DESC LIMIT 1
         ) lm ON TRUE
         LEFT JOIN trucks t ON t.id = lm.truck_id
         ${where}
         ORDER BY s.numero ASC`,
      params
    );
    res.json(r.rows);
  } catch (e: any) {
    console.error('[SANITARIOS] list err:', e);
    res.status(500).json({ error: e?.message || 'erro' });
  }
});

/** GET /api/sanitarios/meta/trucks — lista de caminhões para filtro */
router.get('/meta/trucks', requireAuth, async (_req: any, res: any) => {
  try {
    const r = await pool.query(`SELECT id, name, plate FROM trucks ORDER BY name ASC`);
    res.json(r.rows);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'erro' });
  }
});

/**
 * POST /api/sanitarios — cria/atualiza por numero
 */
router.post('/', requireAuth, async (req: any, res: any) => {
  try {
    const { numero, modelo, status, notes } = req.body || {};
    if (!numero || !String(numero).trim()) return res.status(400).json({ error: 'numero obrigatório' });
    const r = await pool.query(
      `INSERT INTO sanitarios (numero, modelo, status, notes)
       VALUES ($1, $2, COALESCE($3,'disponivel'), $4)
       ON CONFLICT (numero) DO UPDATE SET
         modelo = COALESCE(EXCLUDED.modelo, sanitarios.modelo),
         notes = COALESCE(EXCLUDED.notes, sanitarios.notes),
         updated_at = NOW()
       RETURNING *`,
      [String(numero).trim(), modelo || null, status || null, notes || null]
    );
    res.json(r.rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'erro' });
  }
});

/**
 * GET /api/sanitarios/:numero — detalhes + histórico
 */
router.get('/:numero', requireAuth, async (req: any, res: any) => {
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
 * Helper interno (já em transação): registra movimentação e atualiza status.
 */
async function registrarMovimentacao(client: any, opts: {
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
  // Garante que o sanitário existe (auto-cria se vier um número novo)
  let s = await client.query(`SELECT id FROM sanitarios WHERE numero = $1 FOR UPDATE`, [opts.numero]);
  if (!s.rows[0]) {
    const initialStatus = opts.operationType === 'entrega' ? 'em_cliente'
                        : opts.operationType === 'manutencao' ? 'manutencao'
                        : 'disponivel';
    s = await client.query(
      `INSERT INTO sanitarios (numero, status) VALUES ($1, $2) RETURNING id`,
      [opts.numero, initialStatus]
    );
  }
  const sanId = s.rows[0].id;

  if (opts.operationType === 'entrega' || opts.operationType === 'transferencia') {
    await client.query(
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
    await client.query(
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
    await client.query(
      `UPDATE sanitarios SET status = 'manutencao', updated_at = NOW() WHERE id = $1`,
      [sanId]
    );
  }

  await client.query(
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
 * POST /api/sanitarios/movimentar — atômico
 */
router.post('/movimentar', requireAuth, async (req: any, res: any) => {
  const client = await pool.connect();
  try {
    const { numeros, operationType, routeId, routePointId, customerName, address, lat, lng,
            driverId, driverName, truckId, notes } = req.body || {};
    if (!Array.isArray(numeros) || numeros.length === 0) {
      return res.status(400).json({ error: 'numeros obrigatório (array)' });
    }
    if (!['entrega', 'recolhimento', 'manutencao', 'transferencia'].includes(operationType)) {
      return res.status(400).json({ error: 'operationType inválido' });
    }

    // dedup + trim
    const cleanNums = Array.from(new Set(numeros.map((n: any) => String(n).trim()).filter(Boolean)));
    if (!cleanNums.length) return res.status(400).json({ error: 'numeros inválidos' });

    await client.query('BEGIN');

    const ids: string[] = [];
    for (const numero of cleanNums) {
      const id = await registrarMovimentacao(client, {
        numero,
        operationType,
        routeId, routePointId, customerName, address, lat, lng,
        driverId, driverName, truckId, notes,
      });
      ids.push(id);
    }

    if (routePointId) {
      const col = operationType === 'recolhimento' ? 'sanitario_recolhidos' : 'sanitario_numbers';
      await client.query(
        `UPDATE route_points
            SET ${col} = ARRAY(
              SELECT DISTINCT unnest(COALESCE(${col}, ARRAY[]::text[]) || $2::text[])
            )
          WHERE id = $1::uuid`,
        [routePointId, cleanNums]
      );
    }

    await client.query('COMMIT');
    res.json({ ok: true, count: ids.length, numeros: cleanNums });
  } catch (e: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[SANITARIOS] movimentar err:', e);
    res.status(500).json({ error: e?.message || 'erro' });
  } finally {
    client.release();
  }
});

export default router;
