
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

// Pool principal para o banco da aplicação
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'alchemy_rotas',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export const setupDatabase = async () => {
  try {
    console.log(`🔄 Conectando ao banco de dados: ${process.env.DB_NAME || 'alchemy_rotas'}`);
    
    // Testa a conexão
    const client = await pool.connect();
    console.log(`✅ Conectado ao banco de dados '${process.env.DB_NAME || 'alchemy_rotas'}'`);
    
    // Verifica se as extensões estão instaladas
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await client.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

    console.log('✅ Extensões do PostgreSQL verificadas');

    // 🛡️ Garantir colunas críticas (auto-migração defensiva — evita 500 se a
    // migration de sanitários ainda não rodou). Idempotente.
    const ensureCols: Array<[string, string, string]> = [
      ['route_points', 'sanitario_numbers', 'TEXT[]'],
      ['route_points', 'sanitario_recolhidos', 'TEXT[]'],
      ['route_points', 'point_category', 'TEXT'],
      ['route_points', 'operation_type', 'TEXT'],
      ['route_points', 'recolhido_qty', 'INTEGER'],
      ['route_points', 'auto_removed', 'BOOLEAN DEFAULT FALSE'],
      ['routes', 'optimization_mode', "TEXT DEFAULT 'optimized'"],
    ];
    for (const [table, col, type] of ensureCols) {
      try {
        await client.query(`ALTER TABLE public.${table} ADD COLUMN IF NOT EXISTS ${col} ${type}`);
      } catch (e) {
        console.warn(`⚠️ Não foi possível garantir ${table}.${col}:`, (e as Error).message);
      }
    }
    console.log('✅ Colunas críticas verificadas');

    client.release();
    console.log('✅ Configuração do banco de dados completa');
  } catch (err) {
    console.error('❌ Erro ao configurar o banco de dados:', err);
    console.error('🔍 Verifique se o PostgreSQL está rodando e as credenciais estão corretas');
    console.error('📝 Para criar o banco, execute: CREATE DATABASE alchemy_rotas;');
    throw err;
  }
};

// Função para verificar se as tabelas existem
export const checkTables = async () => {
  try {
    const client = await pool.connect();
    
    const tablesCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'drivers', 'trucks', 'routes', 'schedules', 'maintenance_records')
    `);
    
    console.log(`📊 Tabelas encontradas: ${tablesCheck.rows.map(r => r.table_name).join(', ')}`);
    
    if (tablesCheck.rows.length < 6) {
      console.log('⚠️  Algumas tabelas estão faltando. Execute o arquivo complete-schema-fixed.sql');
    }
    
    client.release();
  } catch (err) {
    console.error('❌ Erro ao verificar tabelas:', err);
  }
};

// Export setupDatabase as createTables for compatibility
export const createTables = setupDatabase;

export { pool };
