import { pool } from './backend/src/config/database';

async function fixSchema() {
    try {
        console.log('Iniciando correção de esquema...');
        await pool.query('ALTER TABLE erp_quote_items ADD COLUMN IF NOT EXISTS is_sanitario BOOLEAN DEFAULT FALSE');
        console.log('Coluna is_sanitario adicionada com sucesso à tabela erp_quote_items.');
        process.exit(0);
    } catch (error) {
        console.error('Erro ao corrigir esquema:', error);
        process.exit(1);
    }
}

fixSchema();
