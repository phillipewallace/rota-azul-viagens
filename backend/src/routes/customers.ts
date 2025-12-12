import { Router, Request, Response } from 'express';
import pool from '../config/database';

const router = Router();

// GET /customers - Listar todos os clientes
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT 
        id,
        customer_name as "customerName",
        address,
        cep,
        lat,
        lng,
        restrooms_qty as "restroomsQty",
        cleanings_qty as "cleaningsQty",
        contact_name as "contactName",
        contact_phone as "contactPhone",
        notes,
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM customers
      ORDER BY customer_name ASC
    `);

    console.log(`[GET /customers] Retornando ${result.rows.length} clientes`);
    res.json(result.rows);
  } catch (error) {
    console.error('[GET /customers] Erro:', error);
    res.status(500).json({ error: 'Erro ao buscar clientes' });
  }
});

// PUT /customers - Salvar todos os clientes (upsert)
router.put('/', async (req: Request, res: Response) => {
  const { customers } = req.body;

  if (!Array.isArray(customers)) {
    res.status(400).json({ error: 'Lista de clientes inválida' });
    return;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Obter IDs dos clientes enviados
    const sentIds = customers.map(c => c.id).filter(Boolean);

    // Deletar clientes que não estão na lista (foram removidos no frontend)
    if (sentIds.length > 0) {
      await client.query(
        `DELETE FROM customers WHERE id NOT IN (${sentIds.map((_, i) => `$${i + 1}`).join(',')})`,
        sentIds
      );
    } else {
      // Se não há clientes, deletar todos
      await client.query('DELETE FROM customers');
    }

    // Upsert para cada cliente
    for (const customer of customers) {
      await client.query(`
        INSERT INTO customers (
          id, customer_name, address, cep, lat, lng,
          restrooms_qty, cleanings_qty, contact_name, contact_phone, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (id) DO UPDATE SET
          customer_name = EXCLUDED.customer_name,
          address = EXCLUDED.address,
          cep = EXCLUDED.cep,
          lat = EXCLUDED.lat,
          lng = EXCLUDED.lng,
          restrooms_qty = EXCLUDED.restrooms_qty,
          cleanings_qty = EXCLUDED.cleanings_qty,
          contact_name = EXCLUDED.contact_name,
          contact_phone = EXCLUDED.contact_phone,
          notes = EXCLUDED.notes,
          updated_at = NOW()
      `, [
        customer.id,
        customer.customerName || null,
        customer.address || null,
        customer.cep || null,
        customer.lat || null,
        customer.lng || null,
        customer.restroomsQty || null,
        customer.cleaningsQty || null,
        customer.contactName || null,
        customer.contactPhone || null,
        customer.notes || null
      ]);
    }

    await client.query('COMMIT');

    // Retornar lista atualizada
    const result = await pool.query(`
      SELECT 
        id,
        customer_name as "customerName",
        address,
        cep,
        lat,
        lng,
        restrooms_qty as "restroomsQty",
        cleanings_qty as "cleaningsQty",
        contact_name as "contactName",
        contact_phone as "contactPhone",
        notes,
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM customers
      ORDER BY customer_name ASC
    `);

    console.log(`[PUT /customers] Salvos ${result.rows.length} clientes`);
    res.json({ success: true, customers: result.rows });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[PUT /customers] Erro:', error);
    res.status(500).json({ error: 'Erro ao salvar clientes' });
  } finally {
    client.release();
  }
});

export default router;
