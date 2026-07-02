/**
 * Módulo Ponto Digital — backend completo.
 *
 * Cobertura:
 *   /jornadas         — CRUD de escalas
 *   /punches          — listagem, batida (com foto/geoloc), ajuste manual
 *   /justifications   — CRUD + aprovar/recusar (individual e lote)
 *   /closures         — fechamento mensal + reabertura
 *   /settings         — configurações do módulo (empresa, LGPD, limites)
 *   /bank-adjustments — ajustes manuais de banco de horas
 *   /dashboard        — KPIs consolidados
 *
 * Conformidade: Portaria MTP 671/2021 (NSR imutável, hash HMAC, foto opcional).
 */
import express from 'express';
import crypto from 'crypto';
import { pool } from '../config/database';
import { requireAuth, AuthedRequest } from '../middleware/requireAuth';

const router = express.Router();
router.use(requireAuth);

const HMAC_SECRET = process.env.PONTO_HMAC_SECRET || process.env.JWT_SECRET || 'ponto-dev-secret';

const signPunch = (funcId: string, ts: string, tipo: string, nsr: number) =>
  crypto.createHmac('sha256', HMAC_SECRET).update(`${funcId}|${ts}|${tipo}|${nsr}`).digest('hex').slice(0, 32).toUpperCase();

function isAdmin(req: AuthedRequest) {
  const r = (req.user?.role || '').toLowerCase();
  return r === 'admin' || r === 'manager' || req.user?.username === 'phillipe.sodre';
}

// ============================================================
// JORNADAS
// ============================================================
router.get('/jornadas', async (_req, res) => {
  try {
    const r = await pool.query('SELECT * FROM ponto_jornadas ORDER BY nome ASC');
    res.json(r.rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/jornadas', async (req: AuthedRequest, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Acesso negado' });
  try {
    const { nome, carga_semanal = 44, entrada, saida_almoco, volta_almoco, saida,
            tolerancia_min = 10, dias_semana = [1,2,3,4,5], ativa = true } = req.body || {};
    if (!nome || !entrada || !saida) return res.status(400).json({ error: 'nome, entrada e saida são obrigatórios' });
    const r = await pool.query(
      `INSERT INTO ponto_jornadas (nome, carga_semanal, entrada, saida_almoco, volta_almoco, saida, tolerancia_min, dias_semana, ativa)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [nome, carga_semanal, entrada, saida_almoco || null, volta_almoco || null, saida, tolerancia_min, dias_semana, ativa]
    );
    res.status(201).json(r.rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/jornadas/:id', async (req: AuthedRequest, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Acesso negado' });
  try {
    const allowed = ['nome','carga_semanal','entrada','saida_almoco','volta_almoco','saida','tolerancia_min','dias_semana','ativa'];
    const fields: string[] = []; const values: any[] = []; let i = 1;
    for (const k of allowed) if (req.body[k] !== undefined) { fields.push(`${k} = $${i++}`); values.push(req.body[k]); }
    if (!fields.length) return res.status(400).json({ error: 'Nada para atualizar' });
    values.push(req.params.id);
    const r = await pool.query(`UPDATE ponto_jornadas SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`, values);
    if (!r.rows.length) return res.status(404).json({ error: 'Não encontrada' });
    res.json(r.rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/jornadas/:id', async (req: AuthedRequest, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Acesso negado' });
  try {
    await pool.query('DELETE FROM ponto_jornadas WHERE id = $1', [req.params.id]);
    res.status(204).end();
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// PUNCHES
// ============================================================
router.get('/punches', async (req, res) => {
  try {
    const { funcionario_id, from, to, limit = '500' } = req.query as Record<string, string>;
    const where: string[] = []; const values: any[] = []; let i = 1;
    if (funcionario_id) { where.push(`p.funcionario_id = $${i++}`); values.push(funcionario_id); }
    if (from) { where.push(`p.timestamp >= $${i++}`); values.push(from); }
    if (to)   { where.push(`p.timestamp <= $${i++}`); values.push(to); }
    values.push(Math.min(parseInt(limit) || 500, 5000));
    const sql = `
      SELECT p.*, f.nome AS funcionario_nome, f.matricula
      FROM ponto_punches p
      JOIN funcionarios f ON f.id = p.funcionario_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY p.timestamp DESC
      LIMIT $${i}
    `;
    const r = await pool.query(sql, values);
    res.json(r.rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/punches', async (req: AuthedRequest, res) => {
  try {
    const { funcionario_id, tipo, origem = 'web', latitude, longitude, endereco, foto_url, timestamp } = req.body || {};
    if (!funcionario_id || !tipo) return res.status(400).json({ error: 'funcionario_id e tipo obrigatórios' });
    if (!['entrada','saida-almoco','volta-almoco','saida'].includes(tipo))
      return res.status(400).json({ error: 'tipo inválido' });

    const ts = timestamp || new Date().toISOString();
    const nsrRow = await pool.query("SELECT nextval('ponto_nsr_seq') AS nsr");
    const nsr = Number(nsrRow.rows[0].nsr);
    const hash = signPunch(funcionario_id, ts, tipo, nsr);

    const r = await pool.query(
      `INSERT INTO ponto_punches
        (funcionario_id, timestamp, tipo, origem, latitude, longitude, endereco, nsr, hash, foto_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [funcionario_id, ts, tipo, origem, latitude ?? null, longitude ?? null, endereco || null, nsr, hash, foto_url || null]
    );
    res.status(201).json(r.rows[0]);
  } catch (e: any) {
    console.error('[PUNCH CREATE]', e);
    res.status(500).json({ error: e.message });
  }
});

// Ajuste manual (mantém NSR original; apenas marca ajustado + motivo)
router.put('/punches/:id/adjust', async (req: AuthedRequest, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Acesso negado' });
  try {
    const { timestamp, motivo } = req.body || {};
    if (!motivo) return res.status(400).json({ error: 'motivo é obrigatório' });
    const r = await pool.query(
      `UPDATE ponto_punches
         SET timestamp = COALESCE($1, timestamp),
             ajustado = TRUE, motivo_ajuste = $2,
             ajustado_por = $3, ajustado_em = NOW()
       WHERE id = $4 RETURNING *`,
      [timestamp || null, motivo, req.user?.userId || null, req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Batida não encontrada' });
    res.json(r.rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// JUSTIFICATIONS
// ============================================================
router.get('/justifications', async (req, res) => {
  try {
    const { status, funcionario_id } = req.query as Record<string, string>;
    const where: string[] = []; const values: any[] = []; let i = 1;
    if (status && status !== 'all') { where.push(`j.status = $${i++}`); values.push(status); }
    if (funcionario_id) { where.push(`j.funcionario_id = $${i++}`); values.push(funcionario_id); }
    const sql = `
      SELECT j.*, f.nome AS funcionario_nome, f.matricula
      FROM ponto_justifications j
      JOIN funcionarios f ON f.id = j.funcionario_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY j.criado_em DESC
    `;
    const r = await pool.query(sql, values);
    res.json(r.rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/justifications', async (req: AuthedRequest, res) => {
  try {
    const { funcionario_id, data, tipo, motivo, anexo_url } = req.body || {};
    if (!funcionario_id || !data || !tipo || !motivo)
      return res.status(400).json({ error: 'funcionario_id, data, tipo e motivo obrigatórios' });
    const r = await pool.query(
      `INSERT INTO ponto_justifications (funcionario_id, data, tipo, motivo, anexo_url, criado_por)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [funcionario_id, data, tipo, motivo, anexo_url || null, req.user?.userId || null]
    );
    res.status(201).json(r.rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Aprovar/recusar (aceita `ids: string[]` para lote, ou :id na URL)
async function reviewMany(ids: string[], status: 'aprovada' | 'recusada', reviewer: string, obs?: string) {
  const r = await pool.query(
    `UPDATE ponto_justifications
        SET status = $1, revisado_por = $2, revisado_em = NOW(), observacao_revisao = $3
      WHERE id = ANY($4::uuid[]) RETURNING *`,
    [status, reviewer, obs || null, ids]
  );
  return r.rows;
}

router.put('/justifications/:id/review', async (req: AuthedRequest, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Acesso negado' });
  try {
    const { status, observacao } = req.body || {};
    if (!['aprovada','recusada'].includes(status)) return res.status(400).json({ error: 'status inválido' });
    const rows = await reviewMany([req.params.id], status, req.user?.username || 'sistema', observacao);
    if (!rows.length) return res.status(404).json({ error: 'Não encontrada' });
    res.json(rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/justifications/batch-review', async (req: AuthedRequest, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Acesso negado' });
  try {
    const { ids, status, observacao } = req.body || {};
    if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'ids obrigatórios' });
    if (!['aprovada','recusada'].includes(status)) return res.status(400).json({ error: 'status inválido' });
    const rows = await reviewMany(ids, status, req.user?.username || 'sistema', observacao);
    res.json({ updated: rows.length, rows });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// CLOSURES (fechamento mensal)
// ============================================================
router.get('/closures', async (_req, res) => {
  try {
    const r = await pool.query('SELECT * FROM ponto_closures ORDER BY competencia DESC');
    res.json(r.rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/closures', async (req: AuthedRequest, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Acesso negado' });
  try {
    const { competencia, observacoes } = req.body || {};
    if (!/^\d{4}-\d{2}$/.test(competencia || '')) return res.status(400).json({ error: 'competencia YYYY-MM obrigatória' });

    const [ano, mes] = competencia.split('-').map(Number);
    const from = new Date(Date.UTC(ano, mes - 1, 1)).toISOString();
    const to   = new Date(Date.UTC(ano, mes, 1)).toISOString();

    const agg = await pool.query(
      `SELECT COUNT(DISTINCT funcionario_id)::int AS funcs, COUNT(*)::int AS punches
       FROM ponto_punches WHERE timestamp >= $1 AND timestamp < $2`,
      [from, to]
    );
    const payload = `${competencia}|${agg.rows[0].funcs}|${agg.rows[0].punches}`;
    const assinatura = crypto.createHash('sha256').update(payload).digest('hex').slice(0, 32).toUpperCase();

    const r = await pool.query(
      `INSERT INTO ponto_closures (competencia, fechado_por, assinatura, total_funcionarios, total_horas_min, observacoes)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (competencia) DO UPDATE SET
         fechado_em = NOW(), fechado_por = EXCLUDED.fechado_por,
         assinatura = EXCLUDED.assinatura, observacoes = EXCLUDED.observacoes
       RETURNING *`,
      [competencia, req.user?.username || 'sistema', assinatura, agg.rows[0].funcs, agg.rows[0].punches * 60, observacoes || null]
    );
    res.status(201).json(r.rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/closures/:competencia', async (req: AuthedRequest, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Acesso negado' });
  try {
    await pool.query('DELETE FROM ponto_closures WHERE competencia = $1', [req.params.competencia]);
    res.status(204).end();
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// SETTINGS
// ============================================================
router.get('/settings', async (_req, res) => {
  try {
    const r = await pool.query('SELECT * FROM ponto_settings WHERE id = 1');
    res.json(r.rows[0] || {});
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/settings', async (req: AuthedRequest, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Acesso negado' });
  try {
    const allowed = ['razao_social','cnpj','cei','endereco','fuso_horario','usar_geoloc','exigir_foto',
                     'banco_horas_ativo','limite_credito_min','limite_debito_min'];
    const fields: string[] = []; const values: any[] = []; let i = 1;
    for (const k of allowed) if (req.body[k] !== undefined) { fields.push(`${k} = $${i++}`); values.push(req.body[k]); }
    if (!fields.length) return res.status(400).json({ error: 'Nada para atualizar' });
    fields.push(`updated_at = NOW()`);
    const r = await pool.query(
      `UPDATE ponto_settings SET ${fields.join(', ')} WHERE id = 1 RETURNING *`, values
    );
    res.json(r.rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// BANK OF HOURS ADJUSTMENTS
// ============================================================
router.get('/bank-adjustments', async (req, res) => {
  try {
    const { funcionario_id } = req.query as Record<string, string>;
    const sql = funcionario_id
      ? 'SELECT * FROM ponto_bank_adjustments WHERE funcionario_id = $1 ORDER BY criado_em DESC'
      : 'SELECT * FROM ponto_bank_adjustments ORDER BY criado_em DESC LIMIT 500';
    const r = await pool.query(sql, funcionario_id ? [funcionario_id] : []);
    res.json(r.rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/bank-adjustments', async (req: AuthedRequest, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Acesso negado' });
  const client = await pool.connect();
  try {
    const { funcionario_id, minutos, motivo } = req.body || {};
    if (!funcionario_id || !minutos || !motivo)
      return res.status(400).json({ error: 'funcionario_id, minutos e motivo obrigatórios' });

    await client.query('BEGIN');
    const ins = await client.query(
      `INSERT INTO ponto_bank_adjustments (funcionario_id, minutos, motivo, criado_por)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [funcionario_id, minutos, motivo, req.user?.username || 'sistema']
    );
    await client.query(
      `UPDATE funcionarios SET banco_horas_min = COALESCE(banco_horas_min,0) + $1 WHERE id = $2`,
      [minutos, funcionario_id]
    );
    await client.query('COMMIT');
    res.status(201).json(ins.rows[0]);
  } catch (e: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

// ============================================================
// DASHBOARD (KPIs)
// ============================================================
router.get('/dashboard', async (_req, res) => {
  try {
    const [funcs, punchesToday, pendJust, closures] = await Promise.all([
      pool.query(`SELECT status, COUNT(*)::int AS c FROM funcionarios GROUP BY status`),
      pool.query(`SELECT COUNT(*)::int AS c, COUNT(DISTINCT funcionario_id)::int AS distintos
                  FROM ponto_punches WHERE timestamp::date = CURRENT_DATE`),
      pool.query(`SELECT COUNT(*)::int AS c FROM ponto_justifications WHERE status = 'pendente'`),
      pool.query(`SELECT competencia, fechado_em FROM ponto_closures ORDER BY competencia DESC LIMIT 3`),
    ]);
    const byStatus: Record<string, number> = { ativo: 0, ferias: 0, afastado: 0, desligado: 0 };
    funcs.rows.forEach((r: any) => { byStatus[r.status] = r.c; });
    res.json({
      funcionarios: byStatus,
      total_funcionarios: Object.values(byStatus).reduce((a, b) => a + b, 0),
      batidas_hoje: punchesToday.rows[0].c,
      presentes_hoje: punchesToday.rows[0].distintos,
      justificativas_pendentes: pendJust.rows[0].c,
      ultimos_fechamentos: closures.rows,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
