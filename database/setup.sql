
-- Script de configuração completa do banco de dados PostgreSQL
-- Execute este script para criar todas as tabelas necessárias

-- Cria extensão para UUIDs se não existir
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabela de usuários (opcional para futuro)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de motoristas
CREATE TABLE IF NOT EXISTS drivers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    license_number VARCHAR(50) UNIQUE NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255),
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'busy', 'off-duty')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de rotas
CREATE TABLE IF NOT EXISTS routes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    total_distance DECIMAL(10, 2),
    estimated_time VARCHAR(50),
    optimized_order JSONB,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de pontos da rota
CREATE TABLE IF NOT EXISTS route_points (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    route_id UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    address TEXT NOT NULL,
    cep VARCHAR(8),
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    point_order INTEGER NOT NULL,
    point_type VARCHAR(20) NOT NULL CHECK (point_type IN ('origin', 'destination', 'waypoint')),
    estimated_arrival TIMESTAMP,
    actual_arrival TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de caminhões
CREATE TABLE IF NOT EXISTS trucks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    plate VARCHAR(10) UNIQUE NOT NULL,
    model VARCHAR(255) NOT NULL,
    year INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'in-route', 'maintenance')),
    current_route_id UUID REFERENCES routes(id),
    driver_id UUID REFERENCES drivers(id),
    last_maintenance DATE,
    mileage INTEGER DEFAULT 0,
    location_lat DECIMAL(10, 8),
    location_lng DECIMAL(11, 8),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de viagens
CREATE TABLE IF NOT EXISTS trips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    route_id UUID NOT NULL REFERENCES routes(id),
    truck_id UUID NOT NULL REFERENCES trucks(id),
    driver_id UUID NOT NULL REFERENCES drivers(id),
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    actual_distance DECIMAL(10, 2),
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in-progress', 'completed', 'cancelled')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de rastreamento em tempo real
CREATE TABLE IF NOT EXISTS truck_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    truck_id UUID NOT NULL REFERENCES trucks(id),
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    speed INTEGER DEFAULT 0,
    heading INTEGER DEFAULT 0,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    trip_id UUID REFERENCES trips(id)
);

-- Tabela de manutenção
CREATE TABLE IF NOT EXISTS maintenance_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    truck_id UUID NOT NULL REFERENCES trucks(id),
    maintenance_type VARCHAR(100) NOT NULL,
    description TEXT,
    scheduled_date DATE NOT NULL,
    completed_date DATE,
    cost DECIMAL(10, 2),
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in-progress', 'completed', 'cancelled')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para otimização
CREATE INDEX IF NOT EXISTS idx_trucks_status ON trucks(status);
CREATE INDEX IF NOT EXISTS idx_trucks_driver ON trucks(driver_id);
CREATE INDEX IF NOT EXISTS idx_trucks_plate ON trucks(plate);
CREATE INDEX IF NOT EXISTS idx_routes_status ON routes(status);
CREATE INDEX IF NOT EXISTS idx_route_points_route ON route_points(route_id);
CREATE INDEX IF NOT EXISTS idx_route_points_order ON route_points(route_id, point_order);
CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);
CREATE INDEX IF NOT EXISTS idx_trips_truck ON trips(truck_id);
CREATE INDEX IF NOT EXISTS idx_trips_route ON trips(route_id);
CREATE INDEX IF NOT EXISTS idx_tracking_truck ON truck_tracking(truck_id);
CREATE INDEX IF NOT EXISTS idx_tracking_timestamp ON truck_tracking(timestamp);
CREATE INDEX IF NOT EXISTS idx_maintenance_truck ON maintenance_records(truck_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_status ON maintenance_records(status);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para atualizar updated_at automaticamente
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_drivers_updated_at ON drivers;
CREATE TRIGGER update_drivers_updated_at BEFORE UPDATE ON drivers 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_trucks_updated_at ON trucks;
CREATE TRIGGER update_trucks_updated_at BEFORE UPDATE ON trucks 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_routes_updated_at ON routes;
CREATE TRIGGER update_routes_updated_at BEFORE UPDATE ON routes 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_trips_updated_at ON trips;
CREATE TRIGGER update_trips_updated_at BEFORE UPDATE ON trips 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_maintenance_updated_at ON maintenance_records;
CREATE TRIGGER update_maintenance_updated_at BEFORE UPDATE ON maintenance_records 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Dados de exemplo para teste (REMOVA EM PRODUÇÃO)
-- Descomente as linhas abaixo apenas para testes iniciais

/*
INSERT INTO drivers (name, license_number, phone, email) VALUES
('João Silva', 'SP123456789', '(11) 99999-1111', 'joao@email.com'),
('Maria Santos', 'SP987654321', '(11) 99999-2222', 'maria@email.com')
ON CONFLICT (license_number) DO NOTHING;

INSERT INTO trucks (name, plate, model, year, mileage, location_lat, location_lng) VALUES
('Caminhão 001', 'ABC-1234', 'Volvo FH', 2020, 85240, -23.5505, -46.6333),
('Caminhão 002', 'DEF-5678', 'Scania R450', 2019, 92180, -23.5605, -46.6433)
ON CONFLICT (plate) DO NOTHING;
*/
