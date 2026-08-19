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
        const funcionarioId = (req as any).user?.funcionarioId || (req as any).user?.funcionario_id;
        logger.info(TAG, `Buscando OS para func_id: ${funcionarioId}${history ? ' (Histórico)' : ''}`);
        
        let statusFilter = "";
        let params: any[] = [];
        
        if (history === 'true') {
            statusFilter = "o.status = 'fechada' AND (o.funcionario_id = $1 OR o.entregue_por_id = $1 OR o.recolhido_por_id = $1)";
            params.push(funcionarioId);
        } else {
            // Fila Global: OS abertas ou despachadas aparecem para todos. 
            // OS em andamento aparecem apenas para quem as assumiu ou quem está entregando/recolhendo.
            statusFilter = `(
                o.status IN ('aberta', 'despachada') 
                OR (o.status IN ('entregue', 'recolhimento_solicitado') AND (o.funcionario_id = $1 OR o.entregue_por_id = $1 OR o.recolhido_por_id = $1))
            )`;
            params.push(funcionarioId);
        }

        let query = `
            SELECT o.*, o.entregue_por_nome AS "entreguePorNome", o.recolhido_por_nome AS "recolhidoPorNome",
                   cu.customer_name as "customerName", cu.address as "customerAddress"
            FROM erp_service_orders o
            LEFT JOIN customers cu ON cu.id = o.customer_id
            WHERE ${statusFilter}
              AND o.use_new_flow = TRUE
            ORDER BY o.data_entrega ASC
        `;
        
        const r = await pool.query(query, params);
        res.json(Array.isArray(r.rows) ? r.rows : []);
    } catch (e: any) { 
        return sendError(res, e, `[${TAG}] Erro ao listar OS`);
    }
});

// Assumir uma OS da fila global
router.post('/os/:id/assumir', async (req, res) => {
    const { id } = req.params;
    const funcionarioId = (req as any).user?.funcionarioId || (req as any).user?.funcionario_id;
    const funcionarioNome = (req as any).user?.nome || (req as any).user?.username;

    try {
        await pool.query(
            "UPDATE erp_service_orders SET funcionario_id = $1, status = 'despachada', updated_at = NOW() WHERE id = $2 AND (funcionario_id IS NULL OR status = 'aberta')",
            [funcionarioId, id]
        );
        logger.info(TAG, `Funcionario ${funcionarioNome} assumiu OS ${id}`);
        res.json({ ok: true });
    } catch (e: any) {
        return sendError(res, e, `[${TAG}] Erro ao assumir OS`);
    }
});

// Registrar Entrega Individual (Suporte a múltiplos itens ou serviço único)
router.post('/os/:id/entregar-item', async (req, res) => {
    const { id } = req.params;
    const { 
        sanitario_numero, 
        fotos, 
        funcionario_id, 
        funcionario_nome, 
        categoria, 
        tipo_locacao_alvo, 
        estado_atual,
        item_index,
        is_last_item,
        is_generic_service, // Novo flag para serviço sem sanitário
        observacoes // Novo campo para relato do serviço
    } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        let sid = null;

        if (!is_generic_service) {
            const numClean = sanitario_numero?.trim().toUpperCase();
            if (!numClean) throw new Error('Número do sanitário é obrigatório');

            // 1. Garantir que o sanitário existe ou cadastrar na hora
            let s = await client.query('SELECT id FROM sanitarios WHERE numero = $1', [numClean]);
            if (!s.rows.length) {
                logger.info(TAG, `Auto-registrando novo sanitário: ${numClean}`);
                const nr = await client.query(
                    `INSERT INTO sanitarios (numero, status, categoria, tipo_locacao_alvo, estado_atual) 
                     VALUES ($1, 'em_cliente', $2, $3, $4) RETURNING id`,
                    [numClean, categoria || 'comum', tipo_locacao_alvo || 'obra', estado_atual || 'bom']
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
                'INSERT INTO erp_os_sanitarios (os_id, sanitario_id, alocado_em) VALUES ($1, $2, NOW()) ON CONFLICT (os_id, sanitario_id) DO NOTHING',
                [id, sid]
            );
        }

        // 3. Registrar fotos e relato
        if (fotos && Array.isArray(fotos)) {
            for (const url of fotos) {
                await client.query(
                    'INSERT INTO erp_sanitario_fotos (sanitario_id, os_id, url, tipo_evento, funcionario_id, observacoes) VALUES ($1, $2, $3, $4, $5, $6)',
                    [sid, id, url, is_generic_service ? 'servico' : 'entrega', funcionario_id, observacoes || null]
                );
            }
        } else if (observacoes) {
             // Caso tenha relato mas sem foto (não esperado por este requisito, mas seguro)
             await client.query(
                'INSERT INTO erp_sanitario_fotos (sanitario_id, os_id, url, tipo_evento, funcionario_id, observacoes) VALUES ($1, $2, $3, $4, $5, $6)',
                [sid, id, 'N/A', 'entrega', funcionario_id, observacoes]
            );
        }

        // 4. Se for o último item ou solicitado (ou serviço genérico), marcar OS como entregue
        if (is_last_item || is_generic_service) {
            await client.query(
                "UPDATE erp_service_orders SET status = 'entregue', entregue_por_id = $2, entregue_por_nome = $3, updated_at = NOW() WHERE id = $1", 
                [id, funcionario_id, funcionario_nome]
            );
        }

        await client.query('COMMIT');
        res.json({ ok: true, sanitario_id: sid });
    } catch (e: any) {
        await client.query('ROLLBACK');
        logger.error(TAG, `Erro entregar-item OS ${id}: ${e.message}`);
        res.status(500).json({ error: e.message });
    } finally { client.release(); }
});

// Registrar Recolhimento Individual
router.post('/os/:id/recolher-item', async (req, res) => {
    const { id } = req.params;
    const { 
        sanitario_id, 
        fotos, 
        funcionario_id, 
        funcionario_nome, 
        estado_atual, 
        observacoes,
        is_last_item 
    } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Registrar fotos e estado para este sanitário específico
        if (fotos && Array.isArray(fotos)) {
            for (const url of fotos) {
                await client.query(
                    'INSERT INTO erp_sanitario_fotos (sanitario_id, os_id, url, tipo_evento, estado_conservacao, observacoes, funcionario_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                    [sanitario_id, id, url, 'recolhimento', estado_atual, observacoes, funcionario_id]
                );
            }
        }

        // 2. Atualizar sanitário para disponível e atualizar estado
        await client.query(
            "UPDATE sanitarios SET status = 'disponivel', estado_atual = $2, updated_at = NOW() WHERE id = $1",
            [sanitario_id, estado_atual]
        );

        // 3. Marcar devolução na OS
        await client.query(
            "UPDATE erp_os_sanitarios SET devolvido_em = NOW() WHERE os_id = $1 AND sanitario_id = $2",
            [id, sanitario_id]
        );

        // 4. Se for o último, fechar a OS
        if (is_last_item) {
            await client.query(
                "UPDATE erp_service_orders SET status = 'fechada', recolhido_por_id = $2, recolhido_por_nome = $3, data_fechamento = NOW(), updated_at = NOW() WHERE id = $1", 
                [id, funcionario_id, funcionario_nome]
            );
        }

        await client.query('COMMIT');
        res.json({ ok: true });
    } catch (e: any) {
        await client.query('ROLLBACK');
        logger.error(TAG, `Erro recolher-item OS ${id}: ${e.message}`);
        res.status(500).json({ error: e.message });
    } finally { client.release(); }
});

// Listar sanitários vinculados a uma OS (para recolhimento itemizado)
router.get('/os/:id/sanitarios', async (req, res) => {
    try {
        const { id } = req.params;
        const r = await pool.query(`
            SELECT s.id, s.numero, s.categoria, s.estado_atual, os.alocado_em, os.devolvido_em
            FROM erp_os_sanitarios os
            JOIN sanitarios s ON s.id = os.sanitario_id
            WHERE os.os_id = $1
        `, [id]);
        res.json(r.rows);
    } catch (e: any) {
        sendError(res, e, `Erro ao listar sanitários da OS ${req.params.id}`);
    }
});

export default router;
