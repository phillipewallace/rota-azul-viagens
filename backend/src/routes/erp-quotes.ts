import { Router } from 'express';
import { pool } from '../config/database';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();
router.use(requireAuth);

const QUOTE_SELECT = `
  q.id, q.numero, q.company_id AS "companyId", q.customer_id AS "customerId",
  q.customer_snapshot AS "customerSnapshot", q.company_snapshot AS "companySnapshot",
  q.modalidade, q.tipo_locacao AS "tipoLocacao",
  q.data_emissao AS "dataEmissao", q.validade_dias AS "validadeDias",
  q.data_entrega AS "dataEntrega", q.limpezas_semanais AS "limpezasSemanais",
  q.observacoes, q.condicoes_pagamento AS "condicoesPagamento",
  q.desconto_pct AS "descontoPct", q.frete, q.subtotal, q.total,
  q.status, q.pdf_gerado_em AS "pdfGeradoEm",
  q.created_at AS "createdAt", q.updated_at AS "updatedAt",
  c.razao_social AS "companyRazaoSocial", c.cnpj AS "companyCnpj",
  cu.customer_name AS "customerName", cu.document AS "customerDocument"
`;

function calcTotals(items: any[], descontoPct = 0, frete = 0) {
  const subtotal = items.reduce((acc, it) => acc + Number(it.quantidade || 0) * Number(it.valorUnitario || 0), 0);
  const desconto = subtotal * (Number(descontoPct) || 0) / 100;
  const total = Math.max(0, subtotal - desconto + Number(frete || 0));
  return { subtotal: +subtotal.toFixed(2), total: +total.toFixed(2) };
}

async function loadItems(quoteId: string) {
  const r = await pool.query(
    `SELECT id, produto, descricao, quantidade, valor_unitario AS "valorUnitario",
            valor_total AS "valorTotal", ordem
       FROM erp_quote_items WHERE quote_id = $1 ORDER BY ordem ASC, id ASC`,
    [quoteId]
  );
  return r.rows;
}

router.get('/', async (req, res) => {
  try {
    const { status, customerId } = req.query as any;
    const conds: string[] = [];
    const params: any[] = [];
    if (status) { params.push(status); conds.push(`q.status = $${params.length}`); }
    if (customerId) { params.push(customerId); conds.push(`q.customer_id = $${params.length}`); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const r = await pool.query(
      `SELECT ${QUOTE_SELECT}
         FROM erp_quotes q
         LEFT JOIN erp_companies c ON c.id = q.company_id
         LEFT JOIN customers cu ON cu.id = q.customer_id
         ${where}
         ORDER BY q.created_at DESC LIMIT 500`,
      params
    );
    res.json(r.rows);
  } catch (e: any) {
    console.error('[erp-quotes GET]', e);
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT ${QUOTE_SELECT}
         FROM erp_quotes q
         LEFT JOIN erp_companies c ON c.id = q.company_id
         LEFT JOIN customers cu ON cu.id = q.customer_id
         WHERE q.id = $1`, [req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'não encontrado' });
    const quote = r.rows[0];
    quote.items = await loadItems(req.params.id);
    res.json(quote);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', async (req, res) => {
  const c = req.body || {};
  const items = Array.isArray(c.items) ? c.items : [];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const numRes = await client.query(`SELECT erp_next_doc_number('ORC') AS num`);
    const numero = numRes.rows[0].num;
    const { subtotal, total } = calcTotals(items, c.descontoPct, c.frete);

    // snapshots
    let companySnap: any = null, customerSnap: any = null;
    if (c.companyId) {
      const cc = await client.query('SELECT * FROM erp_companies WHERE id=$1', [c.companyId]);
      companySnap = cc.rows[0] || null;
    }
    if (c.customerId) {
      const cu = await client.query('SELECT * FROM customers WHERE id=$1', [c.customerId]);
      customerSnap = cu.rows[0] || null;
    }

    const ins = await client.query(
      `INSERT INTO erp_quotes
         (numero, company_id, customer_id, company_snapshot, customer_snapshot,
          modalidade, tipo_locacao, data_emissao, validade_dias, observacoes, condicoes_pagamento,
          desconto_pct, frete, subtotal, total, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8,CURRENT_DATE),$9,$10,$11,$12,$13,$14,$15,COALESCE($16,'rascunho'))
       RETURNING id`,
      [numero, c.companyId || null, c.customerId || null, companySnap, customerSnap,
       c.modalidade || 'mensal', c.tipoLocacao || null, c.dataEmissao || null, c.validadeDias || 15,
       c.observacoes || null, c.condicoesPagamento || null,
       c.descontoPct || 0, c.frete || 0, subtotal, total, c.status]
    );
    const quoteId = ins.rows[0].id;

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const linha = +(Number(it.quantidade || 0) * Number(it.valorUnitario || 0)).toFixed(2);
      await client.query(
        `INSERT INTO erp_quote_items (quote_id, produto, descricao, quantidade, valor_unitario, valor_total, ordem)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [quoteId, it.produto || 'Item', it.descricao || null,
         it.quantidade || 1, it.valorUnitario || 0, linha, i]
      );
    }
    await client.query('COMMIT');
    res.json({ id: quoteId, numero });
  } catch (e: any) {
    await client.query('ROLLBACK');
    console.error('[erp-quotes POST]', e);
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

router.put('/:id', async (req, res) => {
  const c = req.body || {};
  const items = Array.isArray(c.items) ? c.items : null;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query('SELECT * FROM erp_quotes WHERE id=$1', [req.params.id]);
    if (!existing.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'não encontrado' }); }

    let subtotal = existing.rows[0].subtotal;
    let total = existing.rows[0].total;
    if (items) {
      const t = calcTotals(items, c.descontoPct ?? existing.rows[0].desconto_pct, c.frete ?? existing.rows[0].frete);
      subtotal = t.subtotal; total = t.total;
    }

    await client.query(
      `UPDATE erp_quotes SET
         company_id = COALESCE($2, company_id),
         customer_id = COALESCE($3, customer_id),
         modalidade = COALESCE($4, modalidade),
         tipo_locacao = COALESCE($14, tipo_locacao),
         data_emissao = COALESCE($5, data_emissao),
         validade_dias = COALESCE($6, validade_dias),
         observacoes = $7,
         condicoes_pagamento = $8,
         desconto_pct = COALESCE($9, desconto_pct),
         frete = COALESCE($10, frete),
         subtotal = $11, total = $12,
         status = COALESCE($13, status),
         updated_at = NOW()
       WHERE id = $1`,
      [req.params.id, c.companyId || null, c.customerId || null,
       c.modalidade || null, c.dataEmissao || null, c.validadeDias || null,
       c.observacoes || null, c.condicoesPagamento || null,
       c.descontoPct, c.frete, subtotal, total, c.status || null, c.tipoLocacao || null]
    );

    if (items) {
      await client.query('DELETE FROM erp_quote_items WHERE quote_id=$1', [req.params.id]);
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const linha = +(Number(it.quantidade || 0) * Number(it.valorUnitario || 0)).toFixed(2);
        await client.query(
          `INSERT INTO erp_quote_items (quote_id, produto, descricao, quantidade, valor_unitario, valor_total, ordem)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [req.params.id, it.produto || 'Item', it.descricao || null,
           it.quantidade || 1, it.valorUnitario || 0, linha, i]
        );
      }
    }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e: any) {
    await client.query('ROLLBACK');
    console.error('[erp-quotes PUT]', e);
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

router.delete('/:id', async (req, res) => {
  try {
    const r = await pool.query('DELETE FROM erp_quotes WHERE id=$1 RETURNING id', [req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ error: 'não encontrado' });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// converter orçamento em OS — reserva sanitários "disponivel" se modalidade diária e produto = sanitario
router.post('/:id/convert-to-os', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const q = await client.query('SELECT * FROM erp_quotes WHERE id=$1', [req.params.id]);
    if (!q.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'não encontrado' }); }
    const quote = q.rows[0];
    const items = await loadItems(req.params.id);

    // calcula quantidade de sanitários referenciados nos itens
    const qtdSanit = items
      .filter((it: any) => /sanit/i.test(it.produto || '') || /sanit/i.test(it.descricao || ''))
      .reduce((acc: number, it: any) => acc + Math.ceil(Number(it.quantidade || 0)), 0);

    const numRes = await client.query(`SELECT erp_next_doc_number('OS') AS num`);
    const numero = numRes.rows[0].num;

    const diasReq = req.body?.dias || quote.validade_dias || 1;
    const fimPrevista = quote.modalidade === 'diaria'
      ? `(CURRENT_DATE + INTERVAL '${parseInt(diasReq) || 1} day')::date`
      : 'NULL';

    const osIns = await client.query(
      `INSERT INTO erp_service_orders
         (numero, quote_id, company_id, customer_id, customer_snapshot,
          modalidade, tipo_locacao, data_inicio, data_fim_prevista, status, valor_total, observacoes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,CURRENT_DATE, ${fimPrevista}, 'aberta', $8, $9)
       RETURNING id, numero`,
      [numero, quote.id, quote.company_id, quote.customer_id, quote.customer_snapshot,
       quote.modalidade, quote.tipo_locacao, quote.total, quote.observacoes]
    );
    const osId = osIns.rows[0].id;

    // reservar sanitários disponíveis
    if (qtdSanit > 0) {
      const av = await client.query(
        `SELECT id FROM sanitarios WHERE status='disponivel' ORDER BY numero::text ASC LIMIT $1 FOR UPDATE`,
        [qtdSanit]
      );
      for (const row of av.rows) {
        await client.query(
          `INSERT INTO erp_os_sanitarios (os_id, sanitario_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
          [osId, row.id]
        );
        await client.query(`UPDATE sanitarios SET status='em_os' WHERE id=$1`, [row.id]);
      }
    }

    await client.query(`UPDATE erp_quotes SET status='convertido', updated_at=NOW() WHERE id=$1`, [quote.id]);
    await client.query('COMMIT');
    res.json({ ok: true, osId, osNumero: numero, sanitariosReservados: qtdSanit });
  } catch (e: any) {
    await client.query('ROLLBACK');
    console.error('[erp-quotes convert]', e);
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

export default router;
