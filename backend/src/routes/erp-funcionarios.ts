import { Router } from 'express';
import { pool } from '../config/database';
import { requireAuth } from '../middleware/requireAuth';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const router = Router();

// Login via CPF (Publico para o App de Funcionários)
router.post('/login', async (req, res) => {
    console.log(`[AUTH-DEBUG] Login access hit: ${req.method} ${req.path}`);
    const { cpf, password } = req.body;
    try {
        const cleanCpf = String(cpf).replace(/\D/g, '');
        console.log(`[AUTH] Tentativa de login CPF: ${cleanCpf}`);
        const r = await pool.query('SELECT * FROM erp_funcionarios WHERE cpf = $1 AND active = true', [cleanCpf]);
        const func = r.rows[0];
        if (!func) {
            console.log(`[AUTH] Funcionário não encontrado ou inativo: ${cleanCpf}`);
            return res.status(401).json({ error: 'Funcionário não encontrado ou inativo' });
        }
        
        const valid = await bcrypt.compare(String(password), func.password_hash);
        if (!valid) {
            console.log(`[AUTH] Senha incorreta para CPF: ${cleanCpf}`);
            return res.status(401).json({ error: 'Senha incorreta' });
        }
        
        const token = jwt.sign(
            { 
                userId: func.id, 
                username: func.cpf, 
                role: 'funcionario',
                funcionario_id: func.id 
            }, 
            process.env.JWT_SECRET || 'dev-only-insecure-secret',
            { expiresIn: '30d' }
        );

        res.json({ 
            id: func.id, 
            nome: func.nome, 
            tipo: func.tipo, 
            firstLogin: func.first_login,
            token 
        });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});


// Middlewares abaixo exigem autenticação
router.use((req, res, next) => {
    // Rota de login deve ser pública
    // Se o roteamento for app.use('/api/erp/funcionarios', erpFuncionariosRoutes), 
    // req.path será '/login' quando a URL for /api/erp/funcionarios/login
    console.log(`[AUTH-DEBUG] req.path: ${req.path}, req.originalUrl: ${req.originalUrl}`);
    if (req.path === '/login' || req.path.endsWith('/login')) { 
        return next(); 
    }
    return requireAuth(req, res, next);
});

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

// Exclusão Híbrida (Inativação ou Exclusão Real)
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    const { permanent } = req.query;
    try {
        if (permanent === 'true') {
            await pool.query('DELETE FROM erp_funcionarios WHERE id = $1', [id]);
            return res.json({ success: true, message: 'Funcionário removido permanentemente' });
        } else {
            await pool.query('UPDATE erp_funcionarios SET active = false, updated_at = NOW() WHERE id = $1', [id]);
            return res.json({ success: true, message: 'Funcionário inativado com sucesso' });
        }
    } catch (e: any) { 
        if (e.code === '23503') {
            return res.status(400).json({ error: 'Não é possível excluir permanentemente: este funcionário possui registros vinculados (OS/Fotos). Recomenda-se apenas Inativar.' });
        }
        res.status(500).json({ error: e.message }); 
    }
});

export default router;