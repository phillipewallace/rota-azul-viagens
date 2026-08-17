import { Router } from 'express';
import { pool } from '../config/database';
import { requireAuth } from '../middleware/requireAuth';
import bcrypt from 'bcrypt';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
    try {
        const r = await pool.query('SELECT id, nome, cpf, telefone, email, tipo, active, first_login FROM erp_funcionarios ORDER BY nome ASC');
        res.json(r.rows);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
    const { nome, cpf, telefone, email, tipo, password } = req.body;
    try {
        const hash = await bcrypt.hash(password || cpf.replace(/\D/g, ''), 10);
        const r = await pool.query(
            `INSERT INTO erp_funcionarios (nome, cpf, telefone, email, tipo, password_hash) 
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, nome, cpf`,
            [nome, cpf, telefone, email, tipo, hash]
        );
        res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
