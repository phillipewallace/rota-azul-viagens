/**
 * Gestão de usuários — acessível APENAS ao usuário `phillipe.sodre`.
 * Lista, cria, edita e remove logins de funcionários.
 */
import express from 'express';
import { pool } from '../config/database';
import { requireAuth, AuthedRequest } from '../middleware/requireAuth';

const router = express.Router();

const ADMIN_USERNAME = 'phillipe.sodre';

function requireSuperAdmin(req: AuthedRequest, res: express.Response, next: express.NextFunction) {
  if (!req.user || req.user.username !== ADMIN_USERNAME) {
    return res.status(403).json({ error: 'Acesso negado' });
  }
  next();
}

router.use(requireAuth, requireSuperAdmin);

// Listar usuários
router.get('/', async (_req, res) => {
  try {
    const r = await pool.query(
      'SELECT id, username, name, email, role, active, created_at, updated_at FROM users ORDER BY username ASC'
    );
    res.json(r.rows);
  } catch (e: any) {
    console.error('[USERS LIST]', e);
    res.status(500).json({ error: e.message });
  }
});

// Criar usuário
router.post('/', async (req, res) => {
  try {
    const { username, password, name, email, role = 'user', active = true } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'username e password obrigatórios' });

    const exists = await pool.query('SELECT 1 FROM users WHERE username = $1', [username]);
    if (exists.rows.length) return res.status(409).json({ error: 'Usuário já existe' });

    const r = await pool.query(
      `INSERT INTO users (username, password, name, email, role, active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, username, name, email, role, active, created_at`,
      [username, password, name || null, email || null, role, active]
    );
    res.status(201).json(r.rows[0]);
  } catch (e: any) {
    console.error('[USERS CREATE]', e);
    res.status(500).json({ error: e.message });
  }
});

// Atualizar usuário
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { password, name, email, role, active } = req.body || {};

    const fields: string[] = [];
    const values: any[] = [];
    let i = 1;
    if (password !== undefined && password !== '') { fields.push(`password = $${i++}`); values.push(password); }
    if (name !== undefined) { fields.push(`name = $${i++}`); values.push(name); }
    if (email !== undefined) { fields.push(`email = $${i++}`); values.push(email); }
    if (role !== undefined) { fields.push(`role = $${i++}`); values.push(role); }
    if (active !== undefined) { fields.push(`active = $${i++}`); values.push(active); }
    fields.push(`updated_at = CURRENT_TIMESTAMP`);

    if (!fields.length) return res.status(400).json({ error: 'Nada para atualizar' });
    values.push(id);

    const r = await pool.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${i} RETURNING id, username, name, email, role, active, updated_at`,
      values
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.json(r.rows[0]);
  } catch (e: any) {
    console.error('[USERS UPDATE]', e);
    res.status(500).json({ error: e.message });
  }
});

// Remover usuário
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const me = (req as AuthedRequest).user;
    const target = await pool.query('SELECT username FROM users WHERE id = $1', [id]);
    if (!target.rows.length) return res.status(404).json({ error: 'Usuário não encontrado' });
    if (target.rows[0].username === ADMIN_USERNAME) {
      return res.status(400).json({ error: 'Não é possível remover o super-admin' });
    }
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (e: any) {
    console.error('[USERS DELETE]', e);
    res.status(500).json({ error: e.message });
  }
});

export default router;
