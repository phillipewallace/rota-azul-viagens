import { Router } from 'express';
import { pool } from '../config/database';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();
router.use(requireAuth);

// Lista (com flag de atraso para diárias)
router.get('/', async (req, res) => {
  try {
    const { status, overdue } = req.query as any;
    const conds: string[] = [];
    const params: any[] = [];
    if (status) { params.push(status); conds.push(`o.status = $${params.length}`); }
    if (overdue === 'true') {
      conds.push(`o.status = 'aberta' AND o.modalidade='diaria' AND o.data_fim_prevista IS NOT NULL AND o.data_fim_prevista < CURRENT_DATE`);
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const r = await pool.query(`
      SELECT o.id, o.numero, o.quote_id AS "quoteId", o.company_id AS "companyId",
             o.customer_id AS "customerId", o.modalidade, o.tipo_locacao AS "tipoLocacao",
             o.data_inicio AS "dataInicio", o.data_fim_prevista AS "dataFimPrevista",
             o.data_fechamento AS "dataFechamento", o.status,
             o.data_entrega AS "dataEntrega", o.data_recolhimento AS "dataRecolhimento",
             o.limpezas_semanais AS "limpezasSemanais",
             o.endereco_entrega AS "enderecoEntrega",
             o.valor_total AS "valorTotal", o.observacoes,
             COALESCE(o.qtd_reservada,0) AS "qtdReservada",
             o.created_at AS "createdAt",
             cu.customer_name AS "customerName", cu.address AS "customerAddress",
             cu.lat AS "customerLat", cu.lng AS "customerLng",
             c.razao_social AS "companyRazaoSocial",
             (o.status='aberta' AND o.modalidade='diaria'
              AND o.data_fim_prevista IS NOT NULL
              AND o.data_fim_prevista < CURRENT_DATE) AS "emAtraso",
             COALESCE(o.qtd_reservada,0)::int AS "sanitariosAlocados",
             COALESCE((SELECT COUNT(*) FROM erp_os_sanitarios s
                        JOIN sanitarios sa ON sa.id=s.sanitario_id
                        WHERE s.os_id=o.id AND s.devolvido_em IS NULL AND sa.status='em_cliente'),0)::int AS "sanitariosEntregues"
        FROM erp_service_orders o
        LEFT JOIN customers cu ON cu.id = o.customer_id
        LEFT JOIN erp_companies c ON c.id = o.company_id
        ${where}
        ORDER BY o.created_at DESC LIMIT 500`, params);
    res.json(r.rows);
  } catch (e: any) {
    console.error('[erp-service-orders GET]', e);
    res.status(500).json({ error: e.message });
  }
});

// OS com entrega próxima (hoje ou amanhã) ainda em aberto — para notificações
router.get('/notifications/upcoming', async (_req, res) => {
  try {
    const r = await pool.query(`
      SELECT o.id, o.numero, o.data_entrega AS "dataEntrega", o.tipo_locacao AS "tipoLocacao",
             o.endereco_entrega AS "enderecoEntrega", cu.customer_name AS "customerName",
             (o.data_entrega = CURRENT_DATE) AS "hoje",
             (o.data_entrega = CURRENT_DATE + 1) AS "amanha"
        FROM erp_service_orders o
        LEFT JOIN customers cu ON cu.id = o.customer_id
       WHERE o.status='aberta'
         AND o.data_entrega IS NOT NULL
         AND o.data_entrega BETWEEN CURRENT_DATE AND CURRENT_DATE + 1
         AND COALESCE((SELECT COUNT(*) FROM erp_os_sanitarios s
                        JOIN sanitarios sa ON sa.id=s.sanitario_id
                       WHERE s.os_id=o.id AND s.devolvido_em IS NULL AND sa.status='em_cliente'),0) = 0
       ORDER BY o.data_entrega ASC`);
    res.json(r.rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/overdue/count', async (_req, res) => {
  try {
    const r = await pool.query(`
      SELECT COUNT(*)::int AS qtd
        FROM erp_service_orders
       WHERE status='aberta' AND modalidade='diaria'
         AND data_fim_prevista IS NOT NULL
         AND data_fim_prevista < CURRENT_DATE`);
    res.json({ overdue: r.rows[0].qtd });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Resumo financeiro: receita por período, status, tipo de locação
router.get('/financial/summary', async (req, res) => {
  try {
    const { from, to, status, tipoLocacao } = req.query as any;
    const conds: string[] = [];
    const params: any[] = [];
    if (from) { params.push(from); conds.push(`o.data_inicio >= $${params.length}`); }
    if (to)   { params.push(to);   conds.push(`o.data_inicio <= $${params.length}`); }
    if (status) { params.push(status); conds.push(`o.status = $${params.length}`); }
    if (tipoLocacao) { params.push(tipoLocacao); conds.push(`o.tipo_locacao = $${params.length}`); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const rows = await pool.query(
      `SELECT o.id, o.numero, o.modalidade, o.tipo_locacao AS "tipoLocacao",
              o.status, o.data_inicio AS "dataInicio", o.data_fim_prevista AS "dataFimPrevista",
              o.data_fechamento AS "dataFechamento", o.valor_total AS "valorTotal",
              cu.customer_name AS "customerName", c.razao_social AS "companyRazaoSocial",
              (o.status='aberta' AND o.modalidade='diaria'
               AND o.data_fim_prevista IS NOT NULL
               AND o.data_fim_prevista < CURRENT_DATE) AS "emAtraso"
         FROM erp_service_orders o
         LEFT JOIN customers cu ON cu.id = o.customer_id
         LEFT JOIN erp_companies c ON c.id = o.company_id
         ${where}
         ORDER BY o.data_inicio DESC LIMIT 2000`,
      params
    );
    const tot = rows.rows.reduce((a, r) => a + Number(r.valorTotal || 0), 0);
    const totFechadas = rows.rows.filter(r => r.status === 'fechada').reduce((a, r) => a + Number(r.valorTotal || 0), 0);
    const totAbertas = rows.rows.filter(r => r.status === 'aberta').reduce((a, r) => a + Number(r.valorTotal || 0), 0);
    res.json({
      rows: rows.rows,
      totals: {
        total: +tot.toFixed(2),
        fechadas: +totFechadas.toFixed(2),
        abertas: +totAbertas.toFixed(2),
        count: rows.rows.length,
      },
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Relatório financeiro COMPLETO: OS + itens (via quote) + sanitários + manutenções + breakdowns
router.get('/financial/complete', async (req, res) => {
  try {
    const { from, to } = req.query as any;
    const conds: string[] = [];
    const params: any[] = [];
    if (from) { params.push(from); conds.push(`o.data_inicio >= $${params.length}`); }
    if (to)   { params.push(to);   conds.push(`o.data_inicio <= $${params.length}`); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    const os = await pool.query(
      `SELECT o.id, o.numero, o.modalidade, o.tipo_locacao AS "tipoLocacao",
              o.status, o.data_inicio AS "dataInicio", o.data_fim_prevista AS "dataFimPrevista",
              o.data_fechamento AS "dataFechamento", o.valor_total AS "valorTotal",
              o.observacoes, o.quote_id AS "quoteId",
              cu.customer_name AS "customerName", cu.document AS "customerDocument",
              c.razao_social AS "companyRazaoSocial", c.cnpj AS "companyCnpj",
              (o.status='aberta' AND o.modalidade='diaria'
               AND o.data_fim_prevista IS NOT NULL
               AND o.data_fim_prevista < CURRENT_DATE) AS "emAtraso",
              COALESCE((SELECT COUNT(*) FROM erp_os_sanitarios s WHERE s.os_id=o.id),0)::int AS "totalSanitarios",
              COALESCE((SELECT COUNT(*) FROM erp_os_sanitarios s WHERE s.os_id=o.id AND s.devolvido_em IS NULL),0)::int AS "sanitariosAtivos"
         FROM erp_service_orders o
         LEFT JOIN customers cu ON cu.id = o.customer_id
         LEFT JOIN erp_companies c ON c.id = o.company_id
         ${where}
         ORDER BY o.data_inicio DESC LIMIT 5000`,
      params
    );

    // Itens dos orçamentos vinculados
    const quoteIds = os.rows.map(r => r.quoteId).filter(Boolean);
    let items: any[] = [];
    if (quoteIds.length) {
      const it = await pool.query(
        `SELECT qi.quote_id AS "quoteId", q.numero AS "quoteNumero",
                o.numero AS "osNumero",
                qi.produto, qi.descricao, qi.quantidade,
                qi.valor_unitario AS "valorUnitario", qi.valor_total AS "valorTotal"
           FROM erp_quote_items qi
           JOIN erp_quotes q ON q.id = qi.quote_id
           LEFT JOIN erp_service_orders o ON o.quote_id = q.id
          WHERE qi.quote_id = ANY($1::uuid[])
          ORDER BY o.numero, qi.ordem`,
        [quoteIds]
      );
      items = it.rows;
    }

    // Sanitários alocados por OS
    const osIds = os.rows.map(r => r.id);
    let sanitarios: any[] = [];
    if (osIds.length) {
      const sn = await pool.query(
        `SELECT o.numero AS "osNumero", s.numero AS "sanitarioNumero",
                eos.alocado_em AS "alocadoEm", eos.devolvido_em AS "devolvidoEm"
           FROM erp_os_sanitarios eos
           JOIN erp_service_orders o ON o.id = eos.os_id
           JOIN sanitarios s ON s.id = eos.sanitario_id
          WHERE eos.os_id = ANY($1::uuid[])
          ORDER BY o.numero, s.numero`,
        [osIds]
      );
      sanitarios = sn.rows;
    }

    // Manutenções no mesmo período (impacto financeiro)
    const maintConds: string[] = [];
    const maintParams: any[] = [];
    if (from) { maintParams.push(from); maintConds.push(`m.maintenance_date >= $${maintParams.length}`); }
    if (to)   { maintParams.push(to);   maintConds.push(`m.maintenance_date <= $${maintParams.length}`); }
    const mwhere = maintConds.length ? `WHERE ${maintConds.join(' AND ')}` : '';
    const maint = await pool.query(
      `SELECT m.id, m.maintenance_date AS "maintenanceDate",
              COALESCE(m.maintenance_type, m.type) AS "tipo",
              m.description, m.cost, m.status, m.performed_by AS "performedBy",
              t.name AS "truckName", t.plate AS "truckPlate"
         FROM maintenance_records m
         LEFT JOIN trucks t ON t.id = m.truck_id
         ${mwhere}
         ORDER BY m.maintenance_date DESC LIMIT 5000`,
      maintParams
    );

    // Breakdowns
    const bd = (key: string) => {
      const m: Record<string, { count: number; total: number }> = {};
      for (const r of os.rows) {
        const k = (r[key] || '—') as string;
        if (!m[k]) m[k] = { count: 0, total: 0 };
        m[k].count++;
        m[k].total += Number(r.valorTotal || 0);
      }
      return Object.entries(m).map(([k, v]) => ({ key: k, count: v.count, total: +v.total.toFixed(2) }));
    };

    const totReceita = os.rows.reduce((a, r) => a + Number(r.valorTotal || 0), 0);
    const totFechadas = os.rows.filter(r => r.status === 'fechada').reduce((a, r) => a + Number(r.valorTotal || 0), 0);
    const totAbertas = os.rows.filter(r => r.status === 'aberta').reduce((a, r) => a + Number(r.valorTotal || 0), 0);
    const totAtraso = os.rows.filter(r => r.emAtraso).reduce((a, r) => a + Number(r.valorTotal || 0), 0);
    const totManutencao = maint.rows.reduce((a, r) => a + Number(r.cost || 0), 0);

    res.json({
      periodo: { from: from || null, to: to || null },
      os: os.rows,
      items,
      sanitarios,
      manutencoes: maint.rows,
      breakdowns: {
        porStatus: bd('status'),
        porModalidade: bd('modalidade'),
        porTipoLocacao: bd('tipoLocacao'),
        porEmpresa: bd('companyRazaoSocial'),
      },
      totais: {
        receitaTotal: +totReceita.toFixed(2),
        receitaFechadas: +totFechadas.toFixed(2),
        receitaAbertas: +totAbertas.toFixed(2),
        receitaEmAtraso: +totAtraso.toFixed(2),
        custoManutencao: +totManutencao.toFixed(2),
        resultadoLiquido: +(totFechadas - totManutencao).toFixed(2),
        qtdOs: os.rows.length,
        qtdManutencoes: maint.rows.length,
      },
    });
  } catch (e: any) {
    console.error('[financial/complete]', e);
    res.status(500).json({ error: e.message });
  }
});

// Histórico de movimentação de sanitários (entrega/recolhimento/manutenção)
router.get('/movements/history', async (req, res) => {
  try {
    const { from, to, sanitarioNumero, type, limit } = req.query as any;
    const conds: string[] = [];
    const params: any[] = [];
    if (from) { params.push(from); conds.push(`m.occurred_at >= $${params.length}`); }
    if (to)   { params.push(to);   conds.push(`m.occurred_at <= ($${params.length}::timestamptz + INTERVAL '1 day')`); }
    if (sanitarioNumero) { params.push(`%${sanitarioNumero}%`); conds.push(`m.sanitario_numero ILIKE $${params.length}`); }
    if (type) { params.push(type); conds.push(`m.operation_type = $${params.length}`); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const lim = Math.min(parseInt(limit) || 500, 2000);
    const r = await pool.query(
      `SELECT m.id, m.sanitario_id AS "sanitarioId", m.sanitario_numero AS "sanitarioNumero",
              m.operation_type AS "operationType", m.customer_name AS "customerName",
              m.address, m.driver_name AS "driverName", m.occurred_at AS "occurredAt", m.notes,
              m.route_id AS "routeId"
         FROM sanitario_movimentacoes m
         ${where}
         ORDER BY m.occurred_at DESC LIMIT ${lim}`,
      params
    );
    res.json(r.rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});


router.get('/:id', async (req, res) => {
  try {
    const o = await pool.query(`
      SELECT o.*, cu.customer_name AS customer_name_join, cu.address AS customer_address_join,
             c.razao_social, c.cnpj, c.inscricao_estadual,
             c.endereco AS company_endereco, c.cidade AS company_cidade, c.estado AS company_estado,
             c.telefone AS company_telefone, c.email AS company_email
        FROM erp_service_orders o
        LEFT JOIN customers cu ON cu.id = o.customer_id
        LEFT JOIN erp_companies c ON c.id = o.company_id
       WHERE o.id=$1`, [req.params.id]);
    if (!o.rows[0]) return res.status(404).json({ error: 'não encontrado' });
    const sans = await pool.query(`
      SELECT s.id, s.numero, s.status, eos.alocado_em AS "alocadoEm", eos.devolvido_em AS "devolvidoEm"
        FROM erp_os_sanitarios eos
        JOIN sanitarios s ON s.id = eos.sanitario_id
       WHERE eos.os_id=$1
       ORDER BY s.numero ASC`, [req.params.id]);
    // itens vindos do orçamento vinculado
    let items: any[] = [];
    let companySnapshot: any = null;
    const row = o.rows[0];
    if (row.quote_id) {
      const it = await pool.query(
        `SELECT produto, descricao, quantidade, valor_unitario AS "valorUnitario", valor_total AS "valorTotal", ordem
           FROM erp_quote_items WHERE quote_id=$1 ORDER BY ordem ASC, id ASC`, [row.quote_id]);
      items = it.rows;
      const qs = await pool.query(`SELECT company_snapshot FROM erp_quotes WHERE id=$1`, [row.quote_id]);
      companySnapshot = qs.rows[0]?.company_snapshot || null;
    }
    if (!companySnapshot && row.razao_social) {
      companySnapshot = {
        razao_social: row.razao_social, cnpj: row.cnpj,
        inscricao_estadual: row.inscricao_estadual, inscricao_municipal: row.inscricao_municipal,
        endereco: row.company_endereco, cidade: row.company_cidade, estado: row.company_estado,
        telefone: row.company_telefone, email: row.company_email,
      };
    }
    res.json({ ...row, sanitarios: sans.rows, items, companySnapshot });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Cria OS manualmente
router.post('/', async (req, res) => {
  const c = req.body || {};
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const numRes = await client.query(`SELECT erp_next_doc_number('OS') AS num`);
    const numero = numRes.rows[0].num;
    let snap: any = null;
    if (c.customerId) {
      const cu = await client.query('SELECT * FROM customers WHERE id=$1', [c.customerId]);
      snap = cu.rows[0] || null;
    }
    const r = await client.query(
      `INSERT INTO erp_service_orders
         (numero, company_id, customer_id, customer_snapshot,
          modalidade, tipo_locacao, data_inicio, data_fim_prevista, status, valor_total, observacoes)
       VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7,CURRENT_DATE),$8,'aberta',$9,$10) RETURNING id`,
      [numero, c.companyId || null, c.customerId || null, snap,
       c.modalidade || 'diaria', c.tipoLocacao || null, c.dataInicio || null, c.dataFimPrevista || null,
       c.valorTotal || 0, c.observacoes || null]
    );
    const osId = r.rows[0].id;
    const qtdSanit = Number(c.qtdSanitarios) || 0;
    if (qtdSanit > 0) {
      const av = await client.query(
        `SELECT id FROM sanitarios WHERE status='disponivel' ORDER BY numero::text ASC LIMIT $1 FOR UPDATE`,
        [qtdSanit]
      );
      for (const row of av.rows) {
        await client.query(`INSERT INTO erp_os_sanitarios (os_id, sanitario_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [osId, row.id]);
        await client.query(`UPDATE sanitarios SET status='em_os' WHERE id=$1`, [row.id]);
      }
    }
    await client.query('COMMIT');
    res.json({ id: osId, numero });
  } catch (e: any) {
    await client.query('ROLLBACK');
    console.error('[erp-service-orders POST]', e);
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

// Fecha a OS.
// - tipo_locacao='evento': fechamento implica recolhimento automático
//   dos sanitários ainda 'em_cliente' (libera estoque + registra movimentação).
//   Requer body.descricao para a baixa.
// - Demais modalidades: apenas marca como fechada;
//   a baixa dos sanitários continua sendo feita manualmente em /sanitarios.
router.post('/:id/close', async (req: any, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const o = await client.query(
      `SELECT id, status, tipo_locacao, numero
         FROM erp_service_orders WHERE id=$1 FOR UPDATE`, [req.params.id]);
    if (!o.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'não encontrado' }); }
    if (o.rows[0].status === 'fechada') { await client.query('ROLLBACK'); return res.json({ ok: true, already: true }); }
    const osRow = o.rows[0];
    const isEvento = (osRow.tipo_locacao || '').toLowerCase() === 'evento';
    const descricao = String(req.body?.descricao || '').trim();

    if (isEvento) {
      if (!descricao) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'descricao obrigatória para fechar OS de evento (recolhimento)' });
      }
      const sans = await client.query(
        `SELECT eos.id AS link_id, s.id AS san_id, s.numero,
                s.current_address, s.current_lat, s.current_lng
           FROM erp_os_sanitarios eos
           JOIN sanitarios s ON s.id = eos.sanitario_id
          WHERE eos.os_id=$1 AND eos.devolvido_em IS NULL AND s.status='em_cliente'`,
        [req.params.id]
      );
      for (const row of sans.rows) {
        await client.query(
          `UPDATE sanitarios SET status='disponivel',
              current_customer_name=NULL, current_address=NULL,
              current_lat=NULL, current_lng=NULL, updated_at=NOW()
            WHERE id=$1`, [row.san_id]);
        await client.query(
          `INSERT INTO sanitario_movimentacoes
            (sanitario_id, sanitario_numero, operation_type, address, lat, lng, notes)
           VALUES ($1,$2,'recolhimento',$3,$4,$5,$6)`,
          [row.san_id, row.numero, row.current_address || null,
           row.current_lat ?? null, row.current_lng ?? null,
           `Recolhimento automático no fechamento da OS ${osRow.numero}: ${descricao}`]);
        await client.query(
          `UPDATE erp_os_sanitarios SET devolvido_em=NOW() WHERE id=$1`, [row.link_id]);
      }
    }

    await client.query(
      `UPDATE erp_service_orders
          SET status='fechada', data_fechamento=CURRENT_DATE, updated_at=NOW()
        WHERE id=$1`, [req.params.id]);
    await client.query('COMMIT');
    res.json({ ok: true, recolhidos: isEvento });
  } catch (e: any) {
    await client.query('ROLLBACK');
    console.error('[erp-service-orders close]', e);
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

router.delete('/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const sans = await client.query(
      `SELECT sanitario_id FROM erp_os_sanitarios WHERE os_id=$1 AND devolvido_em IS NULL`,
      [req.params.id]
    );
    for (const row of sans.rows) {
      await client.query(`UPDATE sanitarios SET status='disponivel' WHERE id=$1 AND status='em_os'`, [row.sanitario_id]);
    }
    await client.query(`DELETE FROM erp_service_orders WHERE id=$1`, [req.params.id]);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

// Vincular números reais de sanitários a uma OS (entrega).
// Insere o vínculo, marca o sanitário como em_cliente e registra movimentação.
router.post('/:id/deliver', async (req: any, res) => {
  const client = await pool.connect();
  try {
    const { sanitarioNumeros, address, notes } = req.body || {};
    if (!Array.isArray(sanitarioNumeros) || !sanitarioNumeros.length) {
      return res.status(400).json({ error: 'sanitarioNumeros obrigatório' });
    }
    await client.query('BEGIN');
    const osR = await client.query(
      `SELECT o.*, cu.customer_name, cu.address AS customer_address,
              cu.lat AS customer_lat, cu.lng AS customer_lng
         FROM erp_service_orders o
         LEFT JOIN customers cu ON cu.id=o.customer_id
        WHERE o.id=$1 FOR UPDATE OF o`, [req.params.id]);
    if (!osR.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'OS não encontrada' }); }
    const os = osR.rows[0];
    const finalAddress = (address || os.endereco_entrega || os.customer_address || '').trim();

    const nums = Array.from(new Set(sanitarioNumeros.map((n: any) => String(n).trim()).filter(Boolean)));
    const delivered: string[] = [];

    for (const numero of nums) {
      let s = await client.query(`SELECT id, status FROM sanitarios WHERE numero=$1 FOR UPDATE`, [numero]);
      if (!s.rows[0]) {
        s = await client.query(`INSERT INTO sanitarios (numero, status) VALUES ($1,'em_cliente') RETURNING id, status`, [numero]);
      }
      const sanId = s.rows[0].id;
      const alreadyInOs = await client.query(
        `SELECT 1 FROM erp_os_sanitarios WHERE os_id=$1 AND sanitario_id=$2 AND devolvido_em IS NULL`,
        [req.params.id, sanId]);
      if (!alreadyInOs.rows[0]) {
        await client.query(
          `INSERT INTO erp_os_sanitarios (os_id, sanitario_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
          [req.params.id, sanId]);
      }
      await client.query(
        `UPDATE sanitarios SET status='em_cliente',
            current_customer_name=$2, current_address=$3,
            current_lat=$4, current_lng=$5, installed_at=NOW(), updated_at=NOW()
          WHERE id=$1`,
        [sanId, os.customer_name || null, finalAddress || null, os.customer_lat ?? null, os.customer_lng ?? null]);
      await client.query(
        `INSERT INTO sanitario_movimentacoes
          (sanitario_id, sanitario_numero, operation_type, customer_name, address, lat, lng, notes)
         VALUES ($1,$2,'entrega',$3,$4,$5,$6,$7)`,
        [sanId, numero, os.customer_name || null, finalAddress || null, os.customer_lat ?? null, os.customer_lng ?? null,
         notes ? `OS ${os.numero}: ${notes}` : `Entrega vinculada à OS ${os.numero}`]);
      delivered.push(numero);
    }

    if (address) {
      await client.query(`UPDATE erp_service_orders SET endereco_entrega=$1, updated_at=NOW() WHERE id=$2`,
        [address, req.params.id]);
    }
    if (!os.data_entrega) {
      await client.query(`UPDATE erp_service_orders SET data_entrega=CURRENT_DATE, updated_at=NOW() WHERE id=$1`, [req.params.id]);
    }
    await client.query('COMMIT');
    res.json({ ok: true, delivered });
  } catch (e: any) {
    await client.query('ROLLBACK');
    console.error('[erp-service-orders deliver]', e);
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

export default router;
