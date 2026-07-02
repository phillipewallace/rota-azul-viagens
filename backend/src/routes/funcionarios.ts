/**
 * Funcionários — cadastro compartilhado entre o sistema principal (gestão bruta)
 * e o módulo de Ponto Digital (leitura + escalas).
 *
 * Regras:
 *  - GET requer apenas autenticação (qualquer usuário logado pode listar).
 *  - POST/PUT/DELETE exige role admin/manager.
 *  - `password_hash` NUNCA é retornado nas respostas.
 */
import express from 'express';
import bcrypt from 'bcrypt';
import { pool } from '../config/database';
import { requireAuth, AuthedRequest } from '../middleware/requireAuth';

const router = express.Router();
const BCRYPT_ROUNDS = 10;

// Cargos são gerenciados dinamicamente na tabela `cargos` (Configurações).
async function isCargoAllowed(cargo: string): Promise<boolean> {
  const r = await pool.query('SELECT 1 FROM cargos WHERE nome = $1 LIMIT 1', [cargo]);
  return r.rowCount ? r.rowCount > 0 : false;
}

function stripSecret<T extends Record<string, any>>(row: T): Omit<T, 'password_hash'> {
  const { password_hash, ...rest } = row as any;
  return rest;
}

function canWrite(req: AuthedRequest) {
  const role = (req.user?.role || '').toLowerCase();
  return role === 'admin' || role === 'manager' || req.user?.username === 'phillipe.sodre';
}

router.use(requireAuth);

// -------------------- LIST --------------------
router.get('/', async (req, res) => {
  try {
    const { status, departamento, q } = req.query as Record<string, string>;
    const where: string[] = [];
    const values: any[] = [];
    let i = 1;
    if (status && status !== 'all') { where.push(`f.status = $${i++}`); values.push(status); }
    if (departamento && departamento !== 'all') { where.push(`f.departamento = $${i++}`); values.push(departamento); }
    if (q) { where.push(`(f.nome ILIKE $${i} OR f.matricula ILIKE $${i} OR f.cargo ILIKE $${i})`); values.push(`%${q}%`); i++; }

    const sql = `
      SELECT f.*, j.nome AS jornada_nome
      FROM funcionarios f
      LEFT JOIN ponto_jornadas j ON j.id = f.jornada_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY f.nome ASC
    `;
    const r = await pool.query(sql, values);
    res.json(r.rows.map(stripSecret));
  } catch (e: any) {
    console.error('[FUNC LIST]', e);
    res.status(500).json({ error: e.message });
  }
});

// -------------------- GET one --------------------
router.get('/:id', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT f.*, j.nome AS jornada_nome FROM funcionarios f
       LEFT JOIN ponto_jornadas j ON j.id = f.jornada_id
       WHERE f.id = $1`,
      [req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Não encontrado' });
    res.json(stripSecret(r.rows[0]));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// -------------------- CREATE --------------------
router.post('/', async (req: AuthedRequest, res) => {
  if (!canWrite(req)) return res.status(403).json({ error: 'Acesso negado' });
  try {
    const {
      nome, matricula, cpf, pis, rg, email, telefone, cargo, departamento,
      admissao, status = 'ativo', jornada_id, salario_base, observacoes, user_id,
      password,
    } = req.body || {};

    if (!nome || !matricula) return res.status(400).json({ error: 'nome e matricula são obrigatórios' });
    if (cargo && !(await isCargoAllowed(cargo))) return res.status(400).json({ error: 'Cargo inválido' });

    let password_hash: string | null = null;
    if (password) {
      if (String(password).length < 4) return res.status(400).json({ error: 'Senha deve ter ao menos 4 caracteres' });
      if (!cpf) return res.status(400).json({ error: 'CPF é obrigatório quando há senha (usado como login)' });
      password_hash = await bcrypt.hash(String(password), BCRYPT_ROUNDS);
    }

    const r = await pool.query(
      `INSERT INTO funcionarios
       (nome, matricula, cpf, pis, rg, email, telefone, cargo, departamento,
        admissao, status, jornada_id, salario_base, observacoes, user_id, password_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING *`,
      [nome, matricula, cpf || null, pis || null, rg || null, email || null, telefone || null,
       cargo || null, departamento || null, admissao || null, status,
       jornada_id || null, salario_base ?? null, observacoes || null, user_id || null, password_hash]
    );
    res.status(201).json(stripSecret(r.rows[0]));
  } catch (e: any) {
    if (String(e.message).includes('duplicate')) return res.status(409).json({ error: 'Matrícula já existe' });
    console.error('[FUNC CREATE]', e);
    res.status(500).json({ error: e.message });
  }
});

// -------------------- UPDATE --------------------
router.put('/:id', async (req: AuthedRequest, res) => {
  if (!canWrite(req)) return res.status(403).json({ error: 'Acesso negado' });
  try {
    const allowed = ['nome','matricula','cpf','pis','rg','email','telefone','cargo','departamento',
                     'admissao','desligamento','status','jornada_id','salario_base','observacoes','user_id','banco_horas_min'];
    const fields: string[] = [];
    const values: any[] = [];
    let i = 1;

    if (req.body.cargo !== undefined && req.body.cargo && !(await isCargoAllowed(req.body.cargo))) {
      return res.status(400).json({ error: 'Cargo inválido' });
    }

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        fields.push(`${key} = $${i++}`);
        values.push(req.body[key] === '' ? null : req.body[key]);
      }
    }

    // Senha opcional — só atualiza se vier preenchida
    if (req.body.password !== undefined && req.body.password !== '' && req.body.password !== null) {
      if (String(req.body.password).length < 4) {
        return res.status(400).json({ error: 'Senha deve ter ao menos 4 caracteres' });
      }
      const hashed = await bcrypt.hash(String(req.body.password), BCRYPT_ROUNDS);
      fields.push(`password_hash = $${i++}`);
      values.push(hashed);
    }

    if (!fields.length) return res.status(400).json({ error: 'Nada para atualizar' });
    values.push(req.params.id);
    const sql = `UPDATE funcionarios SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`;
    const r = await pool.query(sql, values);
    if (!r.rows.length) return res.status(404).json({ error: 'Não encontrado' });
    res.json(stripSecret(r.rows[0]));
  } catch (e: any) {
    console.error('[FUNC UPDATE]', e);
    res.status(500).json({ error: e.message });
  }
});

// -------------------- DELETE --------------------
router.delete('/:id', async (req: AuthedRequest, res) => {
  if (!canWrite(req)) return res.status(403).json({ error: 'Acesso negado' });
  try {
    await pool.query('DELETE FROM funcionarios WHERE id = $1', [req.params.id]);
    res.status(204).end();
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
