
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

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

// Sistema de logs configurável
const LOG_LEVEL = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'ERROR' : 'INFO');
const logLevels = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };

const log = (level: string, message: string, ...args: any[]) => {
  if (logLevels[level] <= logLevels[LOG_LEVEL]) {
    const timestamp = new Date().toISOString();
    const prefix = level === 'ERROR' ? '❌' : level === 'WARN' ? '⚠️' : level === 'INFO' ? '✅' : '🔍';
    console.log(`${timestamp}: ${prefix} [DATABASE] ${message}`, ...args);
  }
};

// Sistema automático de migração
const runMigrations = async () => {
  const client = await pool.connect();
  
  try {
    log('INFO', 'Iniciando verificação e criação de tabelas...');

    // Criar extensões necessárias
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await client.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    
    // Verificar se truck_locations existe
    const truckLocationsCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'truck_locations'
      );
    `);
    
    if (!truckLocationsCheck.rows[0].exists) {
      log('WARN', 'Tabela truck_locations não encontrada. Criando...');
      
      // Criar tabela truck_locations
      await client.query(`
        CREATE TABLE IF NOT EXISTS truck_locations (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            truck_id UUID NOT NULL REFERENCES trucks(id) ON DELETE CASCADE,
            driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
            route_id UUID REFERENCES routes(id) ON DELETE SET NULL,
            latitude DECIMAL(10, 8) NOT NULL,
            longitude DECIMAL(11, 8) NOT NULL,
            accuracy DECIMAL(8, 2),
            speed DECIMAL(8, 2),
            heading DECIMAL(6, 2),
            altitude DECIMAL(8, 2),
            timestamp TIMESTAMPTZ,
            device_info JSONB,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Criar índices para performance
      await client.query(`CREATE INDEX IF NOT EXISTS idx_truck_locations_truck_id ON truck_locations(truck_id);`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_truck_locations_driver_id ON truck_locations(driver_id);`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_truck_locations_route_id ON truck_locations(route_id);`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_truck_locations_created_at ON truck_locations(created_at DESC);`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_truck_locations_timestamp ON truck_locations(timestamp DESC);`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_truck_locations_truck_date ON truck_locations(truck_id, created_at DESC);`);

      // Trigger para atualizar updated_at
      await client.query(`
        CREATE OR REPLACE FUNCTION update_truck_locations_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = CURRENT_TIMESTAMP;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `);

      await client.query(`
        CREATE TRIGGER trigger_truck_locations_updated_at
            BEFORE UPDATE ON truck_locations
            FOR EACH ROW
            EXECUTE FUNCTION update_truck_locations_updated_at();
      `);

      log('INFO', 'Tabela truck_locations criada com sucesso');
    } else {
      log('DEBUG', 'Tabela truck_locations já existe');
    }

    // Adicionar colunas de localização na tabela trucks se não existirem
    await client.query(`
      ALTER TABLE trucks 
      ADD COLUMN IF NOT EXISTS location_lat DECIMAL(10, 8),
      ADD COLUMN IF NOT EXISTS location_lng DECIMAL(11, 8);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_trucks_location ON trucks(location_lat, location_lng) 
      WHERE location_lat IS NOT NULL AND location_lng IS NOT NULL;
    `);

    log('INFO', 'Sistema de migração concluído com sucesso');

  } catch (error) {
    log('ERROR', 'Erro durante migração:', error);
    throw error;
  } finally {
    client.release();
  }
};

export const setupDatabase = async () => {
  try {
    log('INFO', `Conectando ao banco de dados: ${process.env.DB_NAME || 'alchemy_rotas'}`);
    
    // Testa a conexão
    const client = await pool.connect();
    log('INFO', `Conectado ao banco de dados '${process.env.DB_NAME || 'alchemy_rotas'}'`);
    
    client.release();
    
    // Executar migrações automáticas
    await runMigrations();
    
    log('INFO', 'Configuração do banco de dados completa');
  } catch (err) {
    log('ERROR', 'Erro ao configurar o banco de dados:', err);
    log('ERROR', 'Verifique se o PostgreSQL está rodando e as credenciais estão corretas');
    log('ERROR', 'Para criar o banco, execute: CREATE DATABASE alchemy_rotas;');
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
      AND table_name IN ('users', 'drivers', 'trucks', 'routes', 'schedules', 'maintenance_records', 'truck_locations')
    `);
    
    log('INFO', `Tabelas encontradas: ${tablesCheck.rows.map(r => r.table_name).join(', ')}`);
    
    if (tablesCheck.rows.length < 7) {
      log('WARN', 'Algumas tabelas estão faltando. Executando migrações...');
      await runMigrations();
    }
    
    client.release();
  } catch (err) {
    log('ERROR', 'Erro ao verificar tabelas:', err);
  }
};

// Export setupDatabase as createTables for compatibility
export const createTables = setupDatabase;

export { pool };
