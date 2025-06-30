
import { Pool, Client } from 'pg';
import * as dotenv from 'dotenv';

// Carrega as variáveis de ambiente primeiro
dotenv.config();

// Configuração para conectar ao PostgreSQL sem especificar um banco (para criar o banco)
const createDbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: 'postgres' // Conecta ao banco padrão 'postgres' para criar outros bancos
};

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
    console.log(`🔄 Configurando banco de dados: ${process.env.DB_NAME}`);
    
    // Primeiro, cria o banco se não existir
    const client = new Client(createDbConfig);
    await client.connect();
    console.log('✅ Conectado ao PostgreSQL (postgres)');
    
    try {
      await client.query(`CREATE DATABASE "${process.env.DB_NAME}"`);
      console.log(`✅ Banco de dados '${process.env.DB_NAME}' criado com sucesso`);
    } catch (err: any) {
      if (err.code === '42P04') {
        console.log(`✅ Banco de dados '${process.env.DB_NAME}' já existe`);
      } else {
        console.error('❌ Erro ao criar banco:', err.message);
        throw err;
      }
    }
    
    await client.end();

    // Agora conecta ao banco da aplicação e cria as tabelas
    const appClient = await pool.connect();
    console.log(`✅ Conectado ao banco de dados '${process.env.DB_NAME}'`);
    
    // Cria extensão para UUIDs
    await appClient.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    
    // Cria as tabelas se não existirem
    await appClient.query(`
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

    await appClient.query(`
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

    await appClient.query(`
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

    await appClient.query(`
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

    await appClient.query(`
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

    appClient.release();
    console.log('✅ Tabelas do banco de dados verificadas/criadas');
  } catch (err) {
    console.error('❌ Erro ao configurar o banco de dados:', err);
    throw err;
  }
};

export { pool };
