import { Router } from 'express';
import { pool } from '../config/database';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();
router.use(requireAuth);

// Tipos de sanitários dinâmicos
router.get('/tipos', async (req, res) => {
    try {
        const r = await pool.query('SELECT * FROM erp_sanitario_tipos ORDER BY nome ASC');
        res.json(r.rows);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Histórico detalhado de um sanitário
router.get('/:id/historico-completo', async (req, res) => {
    try {
        const { id } = req.params;
        const movs = await pool.query(
            `SELECT m.*, f.nome as funcionario_nome
             FROM sanitario_movimentacoes m
             LEFT JOIN erp_funcionarios f ON f.id = m.driver_id::uuid -- fallback para driver_id se for uuid
             WHERE m.sanitario_id = $1 ORDER BY m.occurred_at DESC`, [id]
        );
        const fotos = await pool.query(
            'SELECT * FROM erp_sanitario_fotos WHERE sanitario_id = $1 ORDER BY created_at DESC', [id]
        );
        res.json({ movimentacoes: movs.rows, fotos: fotos.rows });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
