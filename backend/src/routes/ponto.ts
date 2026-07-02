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
    const { funcionario_id, from, to, limit = '500', include_photo } = req.query as Record<string, string>;
    const where: string[] = []; const values: any[] = []; let i = 1;
    if (funcionario_id) { where.push(`p.funcionario_id = $${i++}`); values.push(funcionario_id); }
    if (from) { where.push(`p.timestamp >= $${i++}`); values.push(from); }
    if (to)   { where.push(`p.timestamp <= $${i++}`); values.push(to); }
    values.push(Math.min(parseInt(limit) || 500, 5000));
    const shouldIncludePhoto = include_photo !== 'false';
    const sql = `
      SELECT
        p.id,
        p.funcionario_id,
        p.timestamp,
        p.tipo,
        p.origem,
        p.latitude,
        p.longitude,
        p.endereco,
        p.nsr,
        p.hash,
        ${shouldIncludePhoto ? 'p.foto_url' : 'NULL::text AS foto_url'},
        p.ajustado,
        p.motivo_ajuste,
        p.ajustado_por,
        p.ajustado_em,
        p.created_at,
        f.nome AS funcionario_nome,
        f.matricula
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
    const { funcionario_id, tipo, origem = 'web', latitude, longitude, endereco, foto_url, foto_base64, timestamp, motivo } = req.body || {};
    if (!funcionario_id || !tipo) return res.status(400).json({ error: 'funcionario_id e tipo são obrigatórios' });
    if (!['entrada','saida-almoco','volta-almoco','saida'].includes(tipo))
      return res.status(400).json({ error: 'Tipo de batida inválido' });
    if (!['web','mobile','manual','importado'].includes(origem))
      return res.status(400).json({ error: 'Origem inválida' });
    if (origem === 'manual' && (!motivo || !String(motivo).trim())) {
      return res.status(400).json({ error: 'Motivo é obrigatório para batidas manuais' });
    }

    // Aceita foto como URL já hospedada OU data URL base64 (mobile).
    const fotoFinal: string | null = foto_url || foto_base64 || null;

    // Regra crítica do app mobile: exige foto + geolocalização.
    if (origem === 'mobile') {
      if (!fotoFinal) return res.status(400).json({ error: 'Foto é obrigatória para bater ponto pelo app' });
      if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        return res.status(400).json({ error: 'Localização é obrigatória para bater ponto pelo app' });
      }
    }

    // Timestamp válido e dentro de janela sensata (não mais que 5 min no futuro; até 2 anos no passado)
    const ts = timestamp ? new Date(timestamp) : new Date();
    if (isNaN(ts.getTime())) return res.status(400).json({ error: 'Data/hora inválida' });
    const now = Date.now();
    if (ts.getTime() > now + 5 * 60_000) return res.status(400).json({ error: 'Data/hora não pode estar no futuro' });
    if (ts.getTime() < now - 2 * 365 * 24 * 3600_000) return res.status(400).json({ error: 'Data/hora muito antiga (>2 anos)' });
    const tsIso = ts.toISOString();

    // Funcionário precisa existir e estar ativo
    const fRes = await pool.query('SELECT id, status FROM funcionarios WHERE id = $1', [funcionario_id]);
    if (!fRes.rows.length) return res.status(404).json({ error: 'Funcionário não encontrado' });
    if (fRes.rows[0].status && fRes.rows[0].status !== 'ativo')
      return res.status(400).json({ error: 'Funcionário inativo — não é possível registrar batida' });

    // Batida manual exige privilégio administrativo
    if (origem === 'manual' && !isAdmin(req)) {
      return res.status(403).json({ error: 'Apenas gestores podem registrar batidas manuais' });
    }

    const nsrRow = await pool.query("SELECT nextval('ponto_nsr_seq') AS nsr");
    const nsr = Number(nsrRow.rows[0].nsr);
    const hash = signPunch(funcionario_id, tsIso, tipo, nsr);
    const ajustado = origem === 'manual';
    const motivoAjuste = ajustado ? String(motivo).trim() : null;

    const r = await pool.query(
      `INSERT INTO ponto_punches
        (funcionario_id, timestamp, tipo, origem, latitude, longitude, endereco, nsr, hash, foto_url, ajustado, motivo_ajuste, ajustado_por, ajustado_em)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13, CASE WHEN $11 THEN NOW() ELSE NULL END) RETURNING *`,
      [funcionario_id, tsIso, tipo, origem, latitude ?? null, longitude ?? null, endereco || null, nsr, hash, fotoFinal, ajustado, motivoAjuste, ajustado ? (req.user?.userId || null) : null]
    );
    res.status(201).json(r.rows[0]);
  } catch (e: any) {
    console.error('[PUNCH CREATE]', e);
    res.status(500).json({ error: e.message || 'Erro interno ao registrar batida' });
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
    const { funcionario_id, data, tipo, motivo, anexo_url, horario } = req.body || {};
    if (!funcionario_id || !data || !tipo || !motivo)
      return res.status(400).json({ error: 'funcionario_id, data, tipo e motivo obrigatórios' });
    if (horario && !/^\d{2}:\d{2}(:\d{2})?$/.test(horario))
      return res.status(400).json({ error: 'horario deve estar no formato HH:mm' });
    const r = await pool.query(
      `INSERT INTO ponto_justifications (funcionario_id, data, tipo, motivo, anexo_url, horario, criado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [funcionario_id, data, tipo, motivo, anexo_url || null, horario || null, req.user?.userId || null]
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

/**
 * Ao aprovar uma justificativa com horário específico, materializa a batida
 * ausente no dia e reatribui os tipos ({entrada, saida-almoco, volta-almoco, saida})
 * em ordem cronológica — o ponto mais cedo vira `entrada`, o mais tarde vira `saida`,
 * e os do meio preenchem intervalo. Isso libera o usuário de escolher qual campo era.
 */
/** Normaliza `data` (Date ou string) para 'YYYY-MM-DD' evitando shift de TZ. */
function toYmd(data: any): string {
  if (!data) return '';
  if (data instanceof Date) {
    const y = data.getUTCFullYear();
    const m = String(data.getUTCMonth() + 1).padStart(2, '0');
    const d = String(data.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(data).slice(0, 10);
}

async function reallocateDayTipos(
  funcionarioId: string,
  dataRaw: any,
  horarioRaw: string | null | undefined,
  reviewer?: string,
) {
  const data = toYmd(dataRaw);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new Error('Data inválida');

  // Se não veio horário, tenta usar a entrada da jornada do funcionário.
  let horario = (horarioRaw || '').slice(0, 5);
  if (!horario) {
    const jr = await pool.query(
      `SELECT j.entrada FROM funcionarios f
         LEFT JOIN ponto_jornadas j ON j.id = f.jornada_id
        WHERE f.id = $1`,
      [funcionarioId],
    );
    horario = (jr.rows[0]?.entrada || '08:00').slice(0, 5);
  }
  if (!/^\d{2}:\d{2}$/.test(horario)) horario = '08:00';

  const [hh, mm] = horario.split(':').map(Number);
  // Timestamp no horário local do servidor (o mesmo usado nas batidas normais).
  const ts = new Date(`${data}T00:00:00`);
  ts.setHours(hh || 0, mm || 0, 0, 0);
  const tsIso = ts.toISOString();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Evita duplicar se já existe uma batida no mesmo horário (± 60s) do dia
    const dup = await client.query(
      `SELECT id FROM ponto_punches
        WHERE funcionario_id = $1 AND timestamp::date = $2::date
          AND ABS(EXTRACT(EPOCH FROM (timestamp - $3::timestamptz))) < 60`,
      [funcionarioId, data, tsIso],
    );

    if (!dup.rows.length) {
      const nsrRow = await client.query("SELECT nextval('ponto_nsr_seq') AS nsr");
      const nsr = Number(nsrRow.rows[0].nsr);
      const hash = signPunch(funcionarioId, tsIso, 'entrada', nsr);
      await client.query(
        `INSERT INTO ponto_punches
          (funcionario_id, timestamp, tipo, origem, nsr, hash,
           ajustado, motivo_ajuste, ajustado_por, ajustado_em)
         VALUES ($1,$2,'entrada','manual',$3,$4,TRUE,$5,$6,NOW())`,
        [funcionarioId, tsIso, nsr, hash, 'Justificativa aprovada', reviewer || null],
      );
    }

    // Reatribui os tipos em ordem cronológica (hierarquia entrada → saída).
    const dayPunches = await client.query(
      `SELECT id FROM ponto_punches
        WHERE funcionario_id = $1 AND timestamp::date = $2::date
        ORDER BY timestamp ASC`,
      [funcionarioId, data],
    );

    const sequences: Record<number, string[]> = {
      1: ['entrada'],
      2: ['entrada', 'saida'],
      3: ['entrada', 'saida-almoco', 'saida'],
      4: ['entrada', 'saida-almoco', 'volta-almoco', 'saida'],
    };
    const n = dayPunches.rows.length;
    const order = sequences[n] || sequences[4];

    for (let i = 0; i < Math.min(n, order.length); i++) {
      await client.query(
        `UPDATE ponto_punches SET tipo = $1 WHERE id = $2`,
        [order[i], dayPunches.rows[i].id],
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function applyApprovedJustifications(rows: any[], reviewer?: string) {
  for (const j of rows) {
    if (j.status !== 'aprovada' || !j.data) continue;
    // Sem horário? Ainda materializa — usa jornada do funcionário como fallback.
    try {
      await reallocateDayTipos(j.funcionario_id, j.data, j.horario, reviewer);
    } catch (e) {
      console.error('[JUSTIFICATION APPLY]', j.id, e);
    }
  }
}

router.put('/justifications/:id/review', async (req: AuthedRequest, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Acesso negado' });
  try {
    const { status, observacao } = req.body || {};
    if (!['aprovada','recusada'].includes(status)) return res.status(400).json({ error: 'status inválido' });
    const rows = await reviewMany([req.params.id], status, req.user?.username || 'sistema', observacao);
    if (!rows.length) return res.status(404).json({ error: 'Não encontrada' });
    if (status === 'aprovada') await applyApprovedJustifications(rows, req.user?.username);
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
    if (status === 'aprovada') await applyApprovedJustifications(rows, req.user?.username);
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
    const r = await pool.query(`
      SELECT s.*,
             c.razao_social AS empresa_razao_social,
             c.nome_fantasia AS empresa_nome_fantasia,
             c.cnpj AS empresa_cnpj,
             c.inscricao_estadual AS empresa_ie,
             c.endereco AS empresa_endereco,
             c.cidade AS empresa_cidade,
             c.estado AS empresa_estado,
             c.cep AS empresa_cep,
             c.telefone AS empresa_telefone,
             c.email AS empresa_email
        FROM ponto_settings s
        LEFT JOIN erp_companies c ON c.id = s.empresa_emissora_id
       WHERE s.id = 1`);
    res.json(r.rows[0] || {});
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/settings', async (req: AuthedRequest, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Acesso negado' });
  try {
    const allowed = ['empresa_emissora_id','razao_social','cnpj','cei','endereco','fuso_horario','usar_geoloc','exigir_foto',
                     'banco_horas_ativo','limite_credito_min','limite_debito_min'];
    const fields: string[] = []; const values: any[] = []; let i = 1;
    for (const k of allowed) if (req.body[k] !== undefined) {
      fields.push(`${k} = $${i++}`);
      values.push(req.body[k] === '' ? null : req.body[k]);
    }
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
