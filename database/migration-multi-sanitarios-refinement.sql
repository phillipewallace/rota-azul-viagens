import { pool } from '../config/database';
import { logger } from '../utils/logger';

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 1. Garantir que erp_os_sanitarios tem a coluna 'status' para rastreio
    // (Pode ser útil, mas a OS em si já tem o fluxo)
    
    // 2. Garantir que a tabela erp_os_sanitarios existe e está correta
    await client.query(`
      CREATE TABLE IF NOT EXISTS erp_os_sanitarios (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        os_id uuid REFERENCES erp_service_orders(id) ON DELETE CASCADE,
        sanitario_id uuid REFERENCES sanitarios(id) ON DELETE CASCADE,
        alocado_em timestamp with time zone DEFAULT NOW(),
        devolvido_em timestamp with time zone,
        UNIQUE(os_id, sanitario_id)
      )
    `);

    // 3. Adicionar coluna observacoes em erp_os_sanitarios se não existir (para relatos por item)
    await client.query(`
      ALTER TABLE erp_os_sanitarios 
      ADD COLUMN IF NOT EXISTS observacoes text
    `);

    await client.query('COMMIT');
    console.log('Migração multi-sanitários concluída com sucesso.');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Erro na migração:', e);
    process.exit(1);
  } finally {
    client.release();
  }
}

migrate();
