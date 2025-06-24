
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

-- Tabela de relatórios de desempenho (nova)
CREATE TABLE IF NOT EXISTS performance_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_date DATE NOT NULL,
    total_trips INTEGER DEFAULT 0,
    total_distance DECIMAL(10, 2) DEFAULT 0,
    total_fuel_cost DECIMAL(10, 2) DEFAULT 0,
    average_delivery_time INTEGER DEFAULT 0, -- em minutos
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
CREATE INDEX IF NOT EXISTS idx_trips_date ON trips(created_at);
CREATE INDEX IF NOT EXISTS idx_tracking_truck ON truck_tracking(truck_id);
CREATE INDEX IF NOT EXISTS idx_tracking_timestamp ON truck_tracking(timestamp);
CREATE INDEX IF NOT EXISTS idx_maintenance_truck ON maintenance_records(truck_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_status ON maintenance_records(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_date ON maintenance_records(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_performance_date ON performance_reports(report_date);

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

-- Views para relatórios
CREATE OR REPLACE VIEW v_truck_status AS
SELECT 
    status,
    COUNT(*) as count
FROM trucks 
GROUP BY status;

CREATE OR REPLACE VIEW v_monthly_performance AS
SELECT 
    TO_CHAR(created_at, 'YYYY-MM') as month,
    COUNT(*) as trips,
    COALESCE(SUM(actual_distance), 0) as total_km
FROM trips 
WHERE status = 'completed'
    AND created_at >= CURRENT_DATE - INTERVAL '12 months'
GROUP BY TO_CHAR(created_at, 'YYYY-MM')
ORDER BY month;

CREATE OR REPLACE VIEW v_route_usage AS
SELECT 
    r.name,
    COUNT(t.id) as usage
FROM routes r
LEFT JOIN trips t ON r.id = t.route_id
WHERE t.status = 'completed'
    AND t.created_at >= CURRENT_DATE - INTERVAL '6 months'
GROUP BY r.id, r.name
ORDER BY usage DESC
LIMIT 10;

-- Função para estatísticas do dashboard
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'totalRoutes', (SELECT COUNT(*) FROM routes),
        'activeRoutes', (SELECT COUNT(*) FROM routes WHERE status = 'active'),
        'totalTrucks', (SELECT COUNT(*) FROM trucks),
        'activeTrucks', (SELECT COUNT(*) FROM trucks WHERE status IN ('available', 'in-route')),
        'totalKm', (
            SELECT COALESCE(SUM(actual_distance), 0) 
            FROM trips 
            WHERE status = 'completed' 
                AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)
        ),
        'completedTrips', (
            SELECT COUNT(*) 
            FROM trips 
            WHERE status = 'completed'
                AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)
        ),
        'pendingTrips', (
            SELECT COUNT(*) 
            FROM trips 
            WHERE status IN ('scheduled', 'in-progress')
        ),
        'upcomingMaintenance', (
            SELECT json_agg(
                json_build_object(
                    'truckName', t.name,
                    'maintenanceType', m.maintenance_type,
                    'scheduledDate', TO_CHAR(m.scheduled_date, 'DD/MM/YYYY'),
                    'daysRemaining', (m.scheduled_date - CURRENT_DATE)
                )
            )
            FROM maintenance_records m
            JOIN trucks t ON m.truck_id = t.id
            WHERE m.status = 'scheduled'
                AND m.scheduled_date >= CURRENT_DATE
                AND m.scheduled_date <= CURRENT_DATE + INTERVAL '30 days'
            ORDER BY m.scheduled_date
            LIMIT 5
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Dados de exemplo para desenvolvimento (REMOVA EM PRODUÇÃO)
-- Descomente as linhas abaixo apenas para testes iniciais

/*
INSERT INTO drivers (name, license_number, phone, email) VALUES
('João Silva', 'SP123456789', '(11) 99999-1111', 'joao@email.com'),
('Maria Santos', 'SP987654321', '(11) 99999-2222', 'maria@email.com'),
('Pedro Costa', 'SP456789123', '(11) 99999-3333', 'pedro@email.com')
ON CONFLICT (license_number) DO NOTHING;

INSERT INTO trucks (name, plate, model, year, mileage, location_lat, location_lng) VALUES
('Caminhão 001', 'ABC-1234', 'Volvo FH', 2020, 85240, -23.5505, -46.6333),
('Caminhão 002', 'DEF-5678', 'Scania R450', 2019, 92180, -23.5605, -46.6433),
('Caminhão 003', 'GHI-9012', 'Mercedes Actros', 2021, 45300, -23.5405, -46.6233)
ON CONFLICT (plate) DO NOTHING;

INSERT INTO routes (name, description, total_distance, estimated_time, status) VALUES
('Rota SP-RJ', 'São Paulo para Rio de Janeiro', 430.5, '6h 30min', 'active'),
('Rota SP-MG', 'São Paulo para Belo Horizonte', 586.2, '7h 45min', 'active'),
('Rota SP-PR', 'São Paulo para Curitiba', 408.7, '5h 20min', 'active')
ON CONFLICT DO NOTHING;

-- Alguns dados de exemplo para viagens
INSERT INTO trips (route_id, truck_id, driver_id, status, actual_distance, created_at) 
SELECT 
    r.id, t.id, d.id, 'completed', 
    r.total_distance + (random() * 50 - 25), -- variação de ±25km
    CURRENT_DATE - (random() * 90)::int * INTERVAL '1 day' -- últimos 90 dias
FROM routes r, trucks t, drivers d 
WHERE r.name = 'Rota SP-RJ' AND t.plate = 'ABC-1234' AND d.license_number = 'SP123456789'
LIMIT 1;
*/
