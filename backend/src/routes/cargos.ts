/**
 * Cargos — lista dinâmica de cargos usados no cadastro de funcionários.
 * GET: qualquer usuário autenticado.
 * POST/DELETE: admin/manager (mesma regra de funcionarios).
 * DELETE: bloqueado (409) se algum funcionário ainda usa o cargo.
 */
import express from 'express';
import { pool } from '../config/database';
import { requireAuth, AuthedRequest } from '../middleware/requireAuth';

const router = express.Router();
router.use(requireAuth);

function canWrite(req: AuthedRequest) {
  const role = (req.user?.role || '').toLowerCase();
  return role === 'admin' || role === 'manager' || req.user?.username === 'phillipe.sodre';
}

function normalize(nome: unknown): string {
  const s = String(nome ?? '').trim();
  return s;
}

router.get('/', async (_req, res) => {
  try {
    const r = await pool.query('SELECT id, nome FROM cargos ORDER BY nome ASC');
    res.json(r.rows);
  } catch (e: any) {
    console.error('[CARGOS LIST]', e);
    res.status(500).json({ error: e.message });
  }
});

router.post('/', async (req: AuthedRequest, res) => {
  if (!canWrite(req)) return res.status(403).json({ error: 'Acesso negado' });
  try {
    const nome = normalize(req.body?.nome);
    if (!nome) return res.status(400).json({ error: 'Nome do cargo é obrigatório' });
    if (nome.length > 40) return res.status(400).json({ error: 'Nome deve ter até 40 caracteres' });
    if (!/^[\p{L}\p{N}\s\-\/]+$/u.test(nome)) {
      return res.status(400).json({ error: 'Nome contém caracteres inválidos' });
    }
    const r = await pool.query(
      'INSERT INTO cargos (nome) VALUES ($1) RETURNING id, nome',
      [nome]
    );
    res.status(201).json(r.rows[0]);
  } catch (e: any) {
    if (String(e.code) === '23505') return res.status(409).json({ error: 'Cargo já cadastrado' });
    console.error('[CARGOS CREATE]', e);
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', async (req: AuthedRequest, res) => {
  if (!canWrite(req)) return res.status(403).json({ error: 'Acesso negado' });
  try {
    const found = await pool.query('SELECT nome FROM cargos WHERE id = $1', [req.params.id]);
    if (!found.rows.length) return res.status(404).json({ error: 'Cargo não encontrado' });
    const nome = found.rows[0].nome;

    const usage = await pool.query(
      'SELECT COUNT(*)::int AS n FROM funcionarios WHERE cargo = $1',
      [nome]
    );
    if (usage.rows[0].n > 0) {
      return res.status(409).json({
        error: `Não é possível remover: ${usage.rows[0].n} funcionário(s) usam este cargo.`,
      });
    }

    await pool.query('DELETE FROM cargos WHERE id = $1', [req.params.id]);
    res.status(204).end();
  } catch (e: any) {
    console.error('[CARGOS DELETE]', e);
    res.status(500).json({ error: e.message });
  }
});

export default router;
