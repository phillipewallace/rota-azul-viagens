import { Router } from 'express';
import { pool } from '../config/database';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();
router.use(requireAuth);

const MAX_COMPANIES = 3;

router.get('/', async (_req, res) => {
  try {
    const r = await pool.query(`
      SELECT id, razao_social AS "razaoSocial", nome_fantasia AS "nomeFantasia",
             cnpj, inscricao_estadual AS "inscricaoEstadual",
             endereco, cidade, estado, cep, telefone, email, logo_url AS "logoUrl",
             assinatura_url AS "assinaturaUrl",
             ativo, created_at AS "createdAt"
        FROM erp_companies
       ORDER BY created_at ASC`);
    res.json(r.rows);
  } catch (e: any) {
    console.error('[ERP companies GET]', e);
    res.status(500).json({ error: e.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const c = req.body || {};
    if (!c.razaoSocial || !c.cnpj) {
      return res.status(400).json({ error: 'razaoSocial e cnpj são obrigatórios' });
    }
    const count = await pool.query('SELECT COUNT(*)::int AS n FROM erp_companies');
    if ((count.rows[0]?.n || 0) >= MAX_COMPANIES) {
      return res.status(400).json({ error: `Limite de ${MAX_COMPANIES} empresas atingido` });
    }
    const r = await pool.query(
      `INSERT INTO erp_companies
        (razao_social, nome_fantasia, cnpj, inscricao_estadual,
         endereco, cidade, estado, cep, telefone, email, logo_url, assinatura_url, ativo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,COALESCE($13,TRUE))
       RETURNING *`,
      [c.razaoSocial, c.nomeFantasia || null, String(c.cnpj).replace(/\D/g, ''),
       c.inscricaoEstadual || null, c.endereco || null, c.cidade || null,
       c.estado || null, c.cep || null, c.telefone || null, c.email || null,
       c.logoUrl || null, c.assinaturaUrl || null, c.ativo]
    );
    res.json(r.rows[0]);
  } catch (e: any) {
    console.error('[ERP companies POST]', e);
    if (String(e.message).includes('duplicate key')) {
      return res.status(400).json({ error: 'CNPJ já cadastrado' });
    }
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const c = req.body || {};
    const r = await pool.query(
      `UPDATE erp_companies SET
         razao_social = COALESCE($2, razao_social),
         nome_fantasia = $3,
         cnpj = COALESCE($4, cnpj),
         inscricao_estadual = $5,
         endereco = $6, cidade = $7, estado = $8, cep = $9,
         telefone = $10, email = $11, logo_url = $12,
         assinatura_url = $13,
         ativo = COALESCE($14, ativo),
         updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [req.params.id, c.razaoSocial, c.nomeFantasia || null,
       c.cnpj ? String(c.cnpj).replace(/\D/g, '') : null,
       c.inscricaoEstadual || null, c.endereco || null, c.cidade || null,
       c.estado || null, c.cep || null, c.telefone || null, c.email || null,
       c.logoUrl || null, c.assinaturaUrl || null, c.ativo]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'não encontrado' });
    res.json(r.rows[0]);
  } catch (e: any) {
    console.error('[ERP companies PUT]', e);
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const r = await pool.query('DELETE FROM erp_companies WHERE id = $1 RETURNING id', [req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ error: 'não encontrado' });
    res.json({ ok: true });
  } catch (e: any) {
    console.error('[ERP companies DELETE]', e);
    res.status(500).json({ error: e.message });
  }
});

export default router;
