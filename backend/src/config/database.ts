
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

// Carrega as variáveis de ambiente primeiro
dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

export const setupDatabase = async () => {
  try {
    // Testa a conexão
    const client = await pool.connect();
    console.log('✅ Conectado ao banco de dados PostgreSQL');
    
    // Verifica se as tabelas existem, se não, cria elas
    await client.query(`
      CREATE TABLE IF NOT EXISTS routes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        points JSONB NOT NULL DEFAULT '[]',
        total_distance DECIMAL(10,2) DEFAULT 0,
        estimated_time VARCHAR(50),
        optimized_order JSONB DEFAULT '[]',
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS trucks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        plate VARCHAR(20) UNIQUE NOT NULL,
        model VARCHAR(255) NOT NULL,
        year INTEGER NOT NULL,
        status VARCHAR(20) DEFAULT 'available',
        current_route VARCHAR(255),
        driver VARCHAR(255),
        last_maintenance DATE,
        mileage INTEGER DEFAULT 0,
        location JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS drivers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        license VARCHAR(50) UNIQUE NOT NULL,
        phone VARCHAR(20),
        email VARCHAR(255),
        status VARCHAR(20) DEFAULT 'available',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS maintenance (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        truck_id UUID REFERENCES trucks(id),
        type VARCHAR(100) NOT NULL,
        description TEXT,
        scheduled_date DATE NOT NULL,
        completed_date DATE,
        cost DECIMAL(10,2),
        status VARCHAR(20) DEFAULT 'scheduled',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    client.release();
    console.log('✅ Tabelas do banco de dados verificadas/criadas');
  } catch (err) {
    console.error('❌ Erro ao conectar com o banco de dados:', err);
  }
};

export { pool };
