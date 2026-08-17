import { Router } from 'express';
import { pool } from '../config/database';
import { requireAuth } from '../middleware/requireAuth';
import bcrypt from 'bcrypt';

const router = Router();

// Login via CPF (Publico para o App de Funcionários)
router.post('/login', async (req, res) => {
    const { cpf, password } = req.body;
    try {
        const cleanCpf = String(cpf).replace(/\D/g, '');
        const r = await pool.query('SELECT * FROM erp_funcionarios WHERE cpf = $1 AND active = true', [cleanCpf]);
        const func = r.rows[0];
        if (!func) return res.status(401).json({ error: 'Funcionário não encontrado ou inativo' });
        
        const valid = await bcrypt.compare(password, func.password_hash);
        if (!valid) return res.status(401).json({ error: 'Senha incorreta' });
        
        // Aqui geraria um token JWT simplificado ou usaria o padrão do sistema
        res.json({ 
            id: func.id, 
            nome: func.nome, 
            tipo: func.tipo, 
            firstLogin: func.first_login,
            token: 'dummy-token-funcionario' // Implementar real se necessário
        });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

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
        const cleanCpf = String(cpf).replace(/\D/g, '');
        const hash = await bcrypt.hash(password || cleanCpf, 10);
        const r = await pool.query(
            `INSERT INTO erp_funcionarios (nome, cpf, telefone, email, tipo, password_hash) 
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, nome, cpf`,
            [nome, cleanCpf, telefone, email, tipo, hash]
        );
        res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
