import { Router } from 'express';
import { pool } from '../config/database';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();
router.use(requireAuth);

router.get('/tipos', async (req, res) => {
    try {
        const r = await pool.query('SELECT * FROM erp_sanitario_tipos ORDER BY nome ASC');
        res.json(r.rows);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/:id/historico-completo', async (req, res) => {
    try {
        const { id } = req.params;
        const movs = await pool.query(
            `SELECT m.*, f.nome as funcionario_nome
             FROM sanitario_movimentacoes m
             LEFT JOIN erp_funcionarios f ON f.id = m.driver_id::uuid
             WHERE m.sanitario_id = $1 ORDER BY m.occurred_at DESC`, [id]
        );
        const fotos = await pool.query(
            'SELECT f.*, func.nome as funcionario_nome FROM erp_sanitario_fotos f LEFT JOIN erp_funcionarios func ON func.id = f.funcionario_id WHERE sanitario_id = $1 ORDER BY created_at DESC', [id]
        );
        res.json({ movimentacoes: movs.rows, fotos: fotos.rows });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Adicionar sanitário manual ao estoque (App Funcionário)
router.post('/estoque-manual', async (req, res) => {
    const { numero, categoria, tipo_locacao_alvo, estado_atual, fotos, funcionario_id } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const r = await client.query(
            `INSERT INTO sanitarios (numero, status, categoria, tipo_locacao_alvo, estado_atual) 
             VALUES ($1, 'disponivel', $2, $3, $4) 
             ON CONFLICT (numero) DO UPDATE SET 
                categoria = EXCLUDED.categoria, 
                tipo_locacao_alvo = EXCLUDED.tipo_locacao_alvo, 
                estado_atual = EXCLUDED.estado_atual,
                updated_at = NOW()
             RETURNING id`,
            [numero.toUpperCase(), categoria, tipo_locacao_alvo, estado_atual]
        );
        const sid = r.rows[0].id;
        
        if (fotos && Array.isArray(fotos)) {
            for (const url of fotos) {
                await client.query(
                    'INSERT INTO erp_sanitario_fotos (sanitario_id, url, tipo_evento, estado_conservacao, funcionario_id) VALUES ($1, $2, $3, $4, $5)',
                    [sid, url, 'registro_estoque', estado_atual, funcionario_id]
                );
            }
        }
        
        await client.query('COMMIT');
        res.json({ ok: true, id: sid });
    } catch (e: any) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: e.message });
    } finally { client.release(); }
});

export default router;
