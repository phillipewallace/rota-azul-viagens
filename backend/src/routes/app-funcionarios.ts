import { Router } from 'express';
import { pool } from '../config/database';

const router = Router();

// Endpoint para listar OS pendentes/agendadas para o funcionário (SIMULADO: retorna todas abertas por enquanto)
router.get('/os', async (req, res) => {
    try {
        const r = await pool.query(`
            SELECT o.*, cu.customer_name as "customerName", cu.address as "customerAddress"
            FROM erp_service_orders o
            LEFT JOIN customers cu ON cu.id = o.customer_id
            WHERE o.status IN ('aberta', 'despachada', 'entregue', 'recolhimento_solicitado')
            ORDER BY o.data_entrega ASC
        `);
        res.json(r.rows);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Registrar Entrega (com foto e número)
router.post('/os/:id/entregar', async (req, res) => {
    const { id } = req.params;
    const { sanitario_numero, fotos, funcionario_id, categoria, tipo_locacao_alvo, estado_atual } = req.body;
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

        // 4. Mudar status da OS
        await client.query("UPDATE erp_service_orders SET status = 'entregue', updated_at = NOW() WHERE id = $1", [id]);

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
    const { fotos, funcionario_id, estado_atual, observacoes } = req.body;
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

        // 5. Fechar OS
        await client.query("UPDATE erp_service_orders SET status = 'fechada', data_fechamento = NOW(), updated_at = NOW() WHERE id = $1", [id]);

        await client.query('COMMIT');
        res.json({ ok: true });
    } catch (e: any) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: e.message });
    } finally { client.release(); }
});

export default router;
