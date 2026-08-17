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
        
        res.json({ 
            id: func.id, 
            nome: func.nome, 
            tipo: func.tipo, 
            firstLogin: func.first_login,
            token: 'dummy-token-funcionario' 
        });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.use(requireAuth);

router.get('/', async (req, res) => {
    try {
        const r = await pool.query('SELECT id, nome, cpf, telefone, email, tipo, active, first_login FROM erp_funcionarios ORDER BY nome ASC');
        res.json(r.rows);
    } catch (e: any) { 
        console.error('[ERROR] Erro ao listar funcionários:', e);
        res.status(500).json({ error: e.message }); 
    }
});

router.post('/', async (req, res) => {
    const { nome, cpf, telefone, email, tipo } = req.body;
    try {
        const cleanCpf = String(cpf).replace(/\D/g, '');
        // Senha padrão 1234
        const hash = await bcrypt.hash('1234', 10);
        const r = await pool.query(
            `INSERT INTO erp_funcionarios (nome, cpf, telefone, email, tipo, password_hash, first_login) 
             VALUES ($1, $2, $3, $4, $5, $6, TRUE) RETURNING id, nome, cpf`,
            [nome, cleanCpf, telefone, email, tipo, hash]
        );
        res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Edição de funcionário
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { nome, telefone, email, tipo, active } = req.body;
    try {
        await pool.query(
            `UPDATE erp_funcionarios SET nome = $1, telefone = $2, email = $3, tipo = $4, active = $5, updated_at = NOW() WHERE id = $6`,
            [nome, telefone, email, tipo, active, id]
        );
        res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Exclusão (Lógica/Física)
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // Exclusão física por enquanto conforme pedido de "excluir" e "inativar"
        await pool.query('DELETE FROM erp_funcionarios WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;