import { Router, Request, Response } from 'express';
import { pool } from '../config/database';

const router = Router();

const CUSTOMER_SELECT = `
  id,
  customer_name as "customerName",
  address, cep, lat, lng,
  restrooms_qty as "restroomsQty",
  cleanings_qty as "cleaningsQty",
  contact_name as "contactName",
  contact_phone as "contactPhone",
  notes,
  person_type as "personType",
  document, ie, im, email,
  numero, complemento, bairro, cidade, estado,
  responsavel_nome as "responsavelNome",
  responsavel_cpf as "responsavelCpf",
  tipo_cliente as "tipoCliente",
  created_at as "createdAt",
  updated_at as "updatedAt"
`;

// GET /customers/:id/history
router.get('/:id/history', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const cust = await pool.query(`SELECT customer_name FROM customers WHERE id = $1`, [id]);
    if (!cust.rows[0]) { res.status(404).json({ error: 'cliente não encontrado' }); return; }
    const name = cust.rows[0].customer_name;
    if (!name) { res.json({ current: [], history: [] }); return; }

    const current = await pool.query(
      `SELECT id, numero, status, current_address, installed_at
         FROM sanitarios
        WHERE status = 'em_cliente' AND lower(current_customer_name) = lower($1)
        ORDER BY installed_at DESC NULLS LAST`, [name]);
    const history = await pool.query(
      `SELECT id, sanitario_numero, operation_type, address, driver_name, occurred_at, notes
         FROM sanitario_movimentacoes
        WHERE lower(customer_name) = lower($1)
        ORDER BY occurred_at DESC
        LIMIT 200`, [name]);
    res.json({ current: current.rows, history: history.rows });
  } catch (e: any) {
    console.error('[customers/:id/history]', e);
    res.status(500).json({ error: 'Erro ao buscar histórico' });
  }
});

router.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(`SELECT ${CUSTOMER_SELECT} FROM customers ORDER BY customer_name ASC`);
    res.json(result.rows);
  } catch (error) {
    console.error('[GET /customers] Erro:', error);
    res.status(500).json({ error: 'Erro ao buscar clientes' });
  }
});

router.put('/', async (req: Request, res: Response) => {
  const { customers } = req.body;
  if (!Array.isArray(customers)) { res.status(400).json({ error: 'Lista de clientes inválida' }); return; }

  // Detecta documentos duplicados ENTRE os clientes do payload antes de tocar no banco
  const seen = new Map<string, string>(); // doc -> nome do primeiro
  for (const c of customers) {
    const doc = c.document ? String(c.document).replace(/\D/g, '') : '';
    if (!doc) continue;
    const prev = seen.get(doc);
    if (prev) {
      res.status(409).json({
        error: `Documento duplicado: ${doc} aparece em "${prev}" e "${c.customerName || 'sem nome'}".`,
        duplicateDocument: doc,
        duplicateNames: [prev, c.customerName || 'sem nome'],
      });
      return;
    }
    seen.set(doc, c.customerName || 'sem nome');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const sentIds = customers.map(c => c.id).filter(Boolean);
    if (sentIds.length > 0) {
      await client.query(
        `DELETE FROM customers WHERE id NOT IN (${sentIds.map((_, i) => `$${i + 1}`).join(',')})`,
        sentIds);
    } else {
      await client.query('DELETE FROM customers');
    }
    for (const c of customers) {
      const doc = c.document ? String(c.document).replace(/\D/g, '') : null;
      try {
        await client.query(`
        INSERT INTO customers (
          id, customer_name, address, cep, lat, lng,
          restrooms_qty, cleanings_qty, contact_name, contact_phone, notes,
          person_type, document, ie, im, email,
          numero, complemento, bairro, cidade, estado,
          responsavel_nome, responsavel_cpf, tipo_cliente
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
        ON CONFLICT (id) DO UPDATE SET
          customer_name=EXCLUDED.customer_name, address=EXCLUDED.address, cep=EXCLUDED.cep,
          lat=EXCLUDED.lat, lng=EXCLUDED.lng,
          restrooms_qty=EXCLUDED.restrooms_qty, cleanings_qty=EXCLUDED.cleanings_qty,
          contact_name=EXCLUDED.contact_name, contact_phone=EXCLUDED.contact_phone, notes=EXCLUDED.notes,
          person_type=EXCLUDED.person_type, document=EXCLUDED.document, ie=EXCLUDED.ie, im=EXCLUDED.im,
          email=EXCLUDED.email, numero=EXCLUDED.numero, complemento=EXCLUDED.complemento,
          bairro=EXCLUDED.bairro, cidade=EXCLUDED.cidade, estado=EXCLUDED.estado,
          responsavel_nome=EXCLUDED.responsavel_nome, responsavel_cpf=EXCLUDED.responsavel_cpf,
          tipo_cliente=EXCLUDED.tipo_cliente,
          updated_at=NOW()
      `, [
        c.id, c.customerName || null, c.address || null, c.cep || null,
        c.lat || null, c.lng || null,
        c.restroomsQty || null, c.cleaningsQty || null,
        c.contactName || null, c.contactPhone || null, c.notes || null,
        c.personType || 'PJ', doc, c.ie || null, c.im || null, c.email || null,
        c.numero || null, c.complemento || null, c.bairro || null,
        c.cidade || null, c.estado || null,
        c.responsavelNome || null, c.responsavelCpf || null, c.tipoCliente || null,
      ]);
      } catch (innerErr: any) {
        // 23505 = unique_violation no Postgres
        if (innerErr?.code === '23505') {
          await client.query('ROLLBACK');
          // Descobre qual cliente já existe com esse documento
          let owner = '';
          if (doc) {
            const existing = await pool.query(
              `SELECT customer_name FROM customers WHERE document = $1 AND id <> $2 LIMIT 1`,
              [doc, c.id]
            );
            owner = existing.rows[0]?.customer_name || '';
          }
          res.status(409).json({
            error: doc
              ? `O documento ${doc} (cliente "${c.customerName || 'sem nome'}") já está cadastrado${owner ? ` em "${owner}"` : ''}.`
              : `Registro duplicado em "${c.customerName || 'sem nome'}".`,
            duplicateDocument: doc,
            duplicateOwner: owner,
            conflictingName: c.customerName || null,
          });
          return;
        }
        throw innerErr;
      }
    }
    await client.query('COMMIT');
    const result = await pool.query(`SELECT ${CUSTOMER_SELECT} FROM customers ORDER BY customer_name ASC`);
    res.json({ success: true, customers: result.rows });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[PUT /customers] Erro:', error);
    res.status(500).json({ error: error?.message || 'Erro ao salvar clientes' });
  } finally {
    client.release();
  }
});

export default router;
