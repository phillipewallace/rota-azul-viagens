import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

// Pool principal para o banco da aplicação
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
    console.log(`🔄 Conectando ao banco de dados: ${process.env.DB_NAME}`);
    
    // Testa a conexão
    const client = await pool.connect();
    console.log(`✅ Conectado ao banco de dados '${process.env.DB_NAME}'`);
    
    // Cria extensão para UUIDs
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    
    // Cria as tabelas se não existirem
    await client.query(`
      CREATE TABLE IF NOT EXISTS routes (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        plate VARCHAR(20) UNIQUE NOT NULL,
        model VARCHAR(255) NOT NULL,
        year INTEGER NOT NULL,
        status VARCHAR(20) DEFAULT 'available',
        current_route VARCHAR(255),
        driver VARCHAR(255),
        last_maintenance DATE,
        mileage INTEGER DEFAULT 0,
        location_lat DECIMAL(10,8),
        location_lng DECIMAL(11,8),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS drivers (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        license VARCHAR(50) UNIQUE NOT NULL,
        phone VARCHAR(20),
        email VARCHAR(255),
        status VARCHAR(20) DEFAULT 'available',
        current_route VARCHAR(255),
        total_trips INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS maintenance (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        truck_id UUID REFERENCES trucks(id),
        maintenance_type VARCHAR(100) NOT NULL,
        description TEXT,
        scheduled_date DATE NOT NULL,
        completed_date DATE,
        cost DECIMAL(10,2),
        status VARCHAR(20) DEFAULT 'scheduled',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS trips (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        route_id UUID REFERENCES routes(id),
        truck_id UUID REFERENCES trucks(id),
        driver_id UUID REFERENCES drivers(id),
        distance_km DECIMAL(10,2) DEFAULT 0,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    client.release();
    console.log('✅ Tabelas do banco de dados verificadas/criadas');
  } catch (err) {
    console.error('❌ Erro ao configurar o banco de dados:', err);
    throw err;
  }
};

// Export setupDatabase as createTables for compatibility
export const createTables = setupDatabase;

export { pool };
