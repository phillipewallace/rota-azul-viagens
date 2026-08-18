import { Router } from 'express';
import { pool } from '../config/database';
import { requireAuth } from '../middleware/requireAuth';
import { logger } from '../utils/logger';
import { sendError } from '../utils/apiError';

const router = Router();
const TAG = 'APP-FUNC';
router.use(requireAuth);

// Endpoint para listar OS pendentes/agendadas ou histórico
router.get('/os', async (req, res) => {
    try {
        const { history } = req.query;
        const funcionarioId = (req as any).user?.funcionarioId;
        logger.info(TAG, `Buscando OS para func_id: ${funcionarioId}${history ? ' (Histórico)' : ''}`);
        
        let statusFilter = "o.status IN ('aberta', 'despachada', 'entregue', 'recolhimento_solicitado')";
        if (history === 'true') {
            statusFilter = "o.status = 'fechada'";
        }

        let query = `
            SELECT o.*, o.entregue_por_nome AS "entreguePorNome", o.recolhido_por_nome AS "recolhidoPorNome",
                   cu.customer_name as "customerName", cu.address as "customerAddress"
            FROM erp_service_orders o
            LEFT JOIN customers cu ON cu.id = o.customer_id
            WHERE ${statusFilter}
              AND o.use_new_flow = TRUE
        `;
        
        const params: any[] = [];
        if (((req as any).user?.role === 'funcionario' || (req as any).user?.funcionario_id) && funcionarioId) {
            query += ` AND (o.funcionario_id = $1 OR o.entregue_por_id = $1 OR o.recolhido_por_id = $1)`;
            params.push(funcionarioId);
        }

        query += ` ORDER BY o.data_entrega ASC`;
        
        const r = await pool.query(query, params);
        res.json(Array.isArray(r.rows) ? r.rows : []);
    } catch (e: any) { 
        return sendError(res, e, `[${TAG}] Erro ao listar OS`);
    }
});

// Registrar Entrega (com foto e número)
router.post('/os/:id/entregar', async (req, res) => {
    const { id } = req.params;
    const { sanitario_numero, fotos, funcionario_id, funcionario_nome, categoria, tipo_locacao_alvo, estado_atual } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // 1. Garantir que o sanitário existe ou cadastrar na hora
        let s = await client.query('SELECT id FROM sanitarios WHERE numero = $1', [sanitario_numero.toUpperCase()]);
        let sid;
        if (!s.rows.length) {
            const nr = await client.query(
                `INSERT INTO sanitarios (numero, status, categoria, tipo_locacao_alvo, estado_atual) 
                 VALUES ($1, 'em_cliente', $2, $3, $4) RETURNING id`,
                [sanitario_numero.toUpperCase(), categoria || 'comum', tipo_locacao_alvo || 'obra', estado_atual || 'bom']
            );
            sid = nr.rows[0].id;
        } else {
            sid = s.rows[0].id;
            await client.query(
                "UPDATE sanitarios SET status = 'em_cliente', updated_at = NOW() WHERE id = $1",
                [sid]
            );
        }

        // 2. Vincular sanitário à OS
        await client.query(
            'INSERT INTO erp_os_sanitarios (os_id, sanitario_id, alocado_em) VALUES ($1, $2, NOW()) ON CONFLICT DO NOTHING',
            [id, sid]
        );

        // 3. Registrar fotos
        if (fotos && Array.isArray(fotos)) {
            for (const url of fotos) {
                await client.query(
                    'INSERT INTO erp_sanitario_fotos (sanitario_id, os_id, url, tipo_evento, funcionario_id) VALUES ($1, $2, $3, $4, $5)',
                    [sid, id, url, 'entrega', funcionario_id]
                );
            }
        }

        // 4. Mudar status da OS e registrar executor
        await client.query(
            "UPDATE erp_service_orders SET status = 'entregue', entregue_por_id = $2, entregue_por_nome = $3, updated_at = NOW() WHERE id = $1", 
            [id, funcionario_id, funcionario_nome]
        );

        await client.query('COMMIT');
        res.json({ ok: true });
    } catch (e: any) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: e.message });
    } finally { client.release(); }
});

// Registrar Recolhimento (com fotos e estado)
router.post('/os/:id/recolher', async (req, res) => {
    const { id } = req.params;
    const { fotos, funcionario_id, funcionario_nome, estado_atual, observacoes } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Pegar sanitários da OS
        const sans = await client.query('SELECT sanitario_id FROM erp_os_sanitarios WHERE os_id = $1 AND devolvido_em IS NULL', [id]);
        
        for (const row of sans.rows) {
            const sid = row.sanitario_id;
            
            // 2. Registrar fotos e estado
            if (fotos && Array.isArray(fotos)) {
                for (const url of fotos) {
                    await client.query(
                        'INSERT INTO erp_sanitario_fotos (sanitario_id, os_id, url, tipo_evento, estado_conservacao, observacoes, funcionario_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                        [sid, id, url, 'recolhimento', estado_atual, observacoes, funcionario_id]
                    );
                }
            }

            // 3. Atualizar sanitário para disponível e atualizar estado
            await client.query(
                "UPDATE sanitarios SET status = 'disponivel', estado_atual = $2, updated_at = NOW() WHERE id = $1",
                [sid, estado_atual]
            );

            // 4. Marcar devolução na OS
            await client.query(
                "UPDATE erp_os_sanitarios SET devolvido_em = NOW() WHERE os_id = $1 AND sanitario_id = $2",
                [id, sid]
            );
        }

        // 5. Fechar OS e registrar executor
        await client.query(
            "UPDATE erp_service_orders SET status = 'fechada', recolhido_por_id = $2, recolhido_por_nome = $3, data_fechamento = NOW(), updated_at = NOW() WHERE id = $1", 
            [id, funcionario_id, funcionario_nome]
        );

        await client.query('COMMIT');
        res.json({ ok: true });
    } catch (e: any) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: e.message });
    } finally { client.release(); }
});

export default router;
