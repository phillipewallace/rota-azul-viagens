
-- Script SQL Completo para o Sistema Rota Azul Viagens
-- Execute este script no seu PostgreSQL para criar toda a estrutura

-- Limpar tabelas existentes (CUIDADO!)
DROP TABLE IF EXISTS truck_tracking CASCADE;
DROP TABLE IF EXISTS trips CASCADE;
DROP TABLE IF EXISTS maintenance_records CASCADE;
DROP TABLE IF EXISTS route_points CASCADE;
DROP TABLE IF EXISTS routes CASCADE;
DROP TABLE IF EXISTS trucks CASCADE;
DROP TABLE IF EXISTS drivers CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS performance_reports CASCADE;

-- Remover funções e triggers existentes
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS get_dashboard_stats() CASCADE;

-- Criar extensão para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================
-- TABELAS PRINCIPAIS
-- ==============================================

-- Tabela de usuários (futuro sistema de login)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de motoristas
CREATE TABLE drivers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    license_number VARCHAR(50) UNIQUE NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255),
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'on-route', 'off-duty')),
    current_route VARCHAR(255),
    total_trips INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de rotas (simplificada com pontos em JSONB)
CREATE TABLE routes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    points JSONB NOT NULL DEFAULT '[]',
    total_distance DECIMAL(10, 2) DEFAULT 0,
    estimated_time VARCHAR(50),
    optimized_order JSONB DEFAULT '[]',
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de caminhões
CREATE TABLE trucks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    plate VARCHAR(20) UNIQUE NOT NULL,
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
CREATE TABLE trips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    route_id UUID NOT NULL REFERENCES routes(id),
    truck_id UUID NOT NULL REFERENCES trucks(id),
    driver_id UUID NOT NULL REFERENCES drivers(id),
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    distance_km DECIMAL(10, 2) DEFAULT 0,
    actual_distance DECIMAL(10, 2),
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in-progress', 'completed', 'cancelled')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de rastreamento em tempo real
CREATE TABLE truck_tracking (
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
CREATE TABLE maintenance_records (
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

-- Tabela de agendamentos/programação
CREATE TABLE schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    truck_id UUID REFERENCES trucks(id),
    driver_id UUID REFERENCES drivers(id),
    route VARCHAR(255) NOT NULL,
    scheduled_date DATE NOT NULL,
    scheduled_time TIME NOT NULL,
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in-progress', 'completed', 'cancelled')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de relatórios de desempenho
CREATE TABLE performance_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_date DATE NOT NULL,
    total_trips INTEGER DEFAULT 0,
    total_distance DECIMAL(10, 2) DEFAULT 0,
    total_fuel_cost DECIMAL(10, 2) DEFAULT 0,
    average_delivery_time INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================
-- ÍNDICES PARA PERFORMANCE
-- ==============================================

CREATE INDEX idx_trucks_status ON trucks(status);
CREATE INDEX idx_trucks_driver ON trucks(driver_id);
CREATE INDEX idx_trucks_plate ON trucks(plate);
CREATE INDEX idx_trucks_location ON trucks(location_lat, location_lng);

CREATE INDEX idx_drivers_status ON drivers(status);
CREATE INDEX idx_drivers_license ON drivers(license_number);

CREATE INDEX idx_routes_status ON routes(status);
CREATE INDEX idx_routes_name ON routes(name);

CREATE INDEX idx_trips_status ON trips(status);
CREATE INDEX idx_trips_truck ON trips(truck_id);
CREATE INDEX idx_trips_route ON trips(route_id);
CREATE INDEX idx_trips_driver ON trips(driver_id);
CREATE INDEX idx_trips_date ON trips(created_at);

CREATE INDEX idx_tracking_truck ON truck_tracking(truck_id);
CREATE INDEX idx_tracking_timestamp ON truck_tracking(timestamp);

CREATE INDEX idx_maintenance_truck ON maintenance_records(truck_id);
CREATE INDEX idx_maintenance_status ON maintenance_records(status);
CREATE INDEX idx_maintenance_date ON maintenance_records(scheduled_date);

CREATE INDEX idx_schedules_truck ON schedules(truck_id);
CREATE INDEX idx_schedules_driver ON schedules(driver_id);
CREATE INDEX idx_schedules_date ON schedules(scheduled_date);

CREATE INDEX idx_performance_date ON performance_reports(report_date);

-- ==============================================
-- FUNÇÕES E TRIGGERS
-- ==============================================

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para atualizar updated_at automaticamente
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_drivers_updated_at BEFORE UPDATE ON drivers 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trucks_updated_at BEFORE UPDATE ON trucks 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_routes_updated_at BEFORE UPDATE ON routes 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trips_updated_at BEFORE UPDATE ON trips 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_maintenance_updated_at BEFORE UPDATE ON maintenance_records 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_schedules_updated_at BEFORE UPDATE ON schedules 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==============================================
-- VIEWS PARA RELATÓRIOS
-- ==============================================

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

-- ==============================================
-- FUNÇÃO PARA DASHBOARD
-- ==============================================

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
        'totalDrivers', (SELECT COUNT(*) FROM drivers),
        'availableDrivers', (SELECT COUNT(*) FROM drivers WHERE status = 'available'),
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
            SELECT COALESCE(json_agg(
                json_build_object(
                    'truckName', t.name,
                    'maintenanceType', m.maintenance_type,
                    'scheduledDate', TO_CHAR(m.scheduled_date, 'DD/MM/YYYY'),
                    'daysRemaining', (m.scheduled_date - CURRENT_DATE)
                )
            ), '[]'::json)
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

-- ==============================================
-- DADOS DE EXEMPLO (OPCIONAL)
-- ==============================================

-- Inserir motoristas de exemplo
INSERT INTO drivers (name, license_number, phone, email, status) VALUES
('João Silva Santos', 'SP123456789', '(11) 99999-1111', 'joao.silva@email.com', 'available'),
('Maria Oliveira Costa', 'SP987654321', '(11) 99999-2222', 'maria.oliveira@email.com', 'available'),
('Pedro Santos Ferreira', 'SP456789123', '(11) 99999-3333', 'pedro.santos@email.com', 'available'),
('Ana Paula Rodrigues', 'SP789123456', '(11) 99999-4444', 'ana.paula@email.com', 'available'),
('Carlos Eduardo Lima', 'SP321654987', '(11) 99999-5555', 'carlos.eduardo@email.com', 'available')
ON CONFLICT (license_number) DO NOTHING;

-- Inserir caminhões de exemplo
INSERT INTO trucks (name, plate, model, year, mileage, status) VALUES
('Caminhão Alpha', 'ABC-1234', 'Volvo FH 460', 2020, 125000, 'available'),
('Caminhão Beta', 'DEF-5678', 'Scania R 450', 2019, 98000, 'available'),
('Caminhão Gamma', 'GHI-9012', 'Mercedes Actros', 2021, 45000, 'available'),
('Caminhão Delta', 'JKL-3456', 'Iveco Stralis', 2018, 156000, 'maintenance'),
('Caminhão Echo', 'MNO-7890', 'MAN TGX', 2022, 28000, 'available')
ON CONFLICT (plate) DO NOTHING;

-- Inserir rotas de exemplo
INSERT INTO routes (name, description, total_distance, estimated_time, status, points) VALUES
(
    'Rota SP-RJ Express',
    'Rota rápida São Paulo - Rio de Janeiro via Dutra',
    430.5,
    '6h 30min',
    'active',
    '[
        {"id": "1", "address": "São Paulo, SP - Terminal Rodoviário", "lat": -23.5558, "lng": -46.6396, "order": 1, "type": "origin", "completed": false},
        {"id": "2", "address": "Guarulhos, SP - Posto de Combustível", "lat": -23.4538, "lng": -46.5333, "order": 2, "type": "waypoint", "completed": false},
        {"id": "3", "address": "Rio de Janeiro, RJ - Terminal de Cargas", "lat": -22.9068, "lng": -43.1729, "order": 3, "type": "destination", "completed": false}
    ]'::jsonb
),
(
    'Rota SP-BH Econômica',
    'São Paulo - Belo Horizonte via BR-381',
    586.2,
    '7h 45min',
    'active',
    '[
        {"id": "1", "address": "São Paulo, SP - Centro de Distribuição", "lat": -23.5505, "lng": -46.6333, "order": 1, "type": "origin", "completed": false},
        {"id": "2", "address": "Poços de Caldas, MG - Parada Técnica", "lat": -21.7889, "lng": -46.5625, "order": 2, "type": "waypoint", "completed": false},
        {"id": "3", "address": "Belo Horizonte, MG - Terminal BH", "lat": -19.9208, "lng": -43.9378, "order": 3, "type": "destination", "completed": false}
    ]'::jsonb
),
(
    'Rota SP-Curitiba Regional',
    'São Paulo - Curitiba via BR-116',
    408.7,
    '5h 20min',
    'active',
    '[
        {"id": "1", "address": "São Paulo, SP - Base Operacional", "lat": -23.5505, "lng": -46.6333, "order": 1, "type": "origin", "completed": false},
        {"id": "2", "address": "Registro, SP - Posto BR", "lat": -24.4886, "lng": -47.8436, "order": 2, "type": "waypoint", "completed": false},
        {"id": "3", "address": "Curitiba, PR - Terminal Sul", "lat": -25.4244, "lng": -49.2654, "order": 3, "type": "destination", "completed": false}
    ]'::jsonb
)
ON CONFLICT DO NOTHING;

-- Inserir algumas manutenções agendadas
INSERT INTO maintenance_records (truck_id, maintenance_type, description, scheduled_date, cost, status) 
SELECT 
    t.id,
    'Revisão Preventiva',
    'Revisão completa de 10.000 km',
    CURRENT_DATE + INTERVAL '7 days',
    1500.00,
    'scheduled'
FROM trucks t 
WHERE t.plate = 'ABC-1234'
LIMIT 1;

INSERT INTO maintenance_records (truck_id, maintenance_type, description, scheduled_date, cost, status) 
SELECT 
    t.id,
    'Troca de Óleo',
    'Troca de óleo do motor e filtros',
    CURRENT_DATE + INTERVAL '15 days',
    450.00,
    'scheduled'
FROM trucks t 
WHERE t.plate = 'DEF-5678'
LIMIT 1;

-- Inserir alguns agendamentos
INSERT INTO schedules (truck_id, driver_id, route, scheduled_date, scheduled_time, status)
SELECT 
    t.id,
    d.id,
    'Rota SP-RJ Express',
    CURRENT_DATE + INTERVAL '1 day',
    '08:00:00',
    'scheduled'
FROM trucks t, drivers d 
WHERE t.plate = 'ABC-1234' AND d.license_number = 'SP123456789'
LIMIT 1;

-- ==============================================
-- COMENTÁRIOS FINAIS
-- ==============================================

-- Este script cria toda a estrutura necessária para o sistema Rota Azul Viagens
-- Inclui todas as tabelas, índices, triggers, views e funções necessárias
-- Os dados de exemplo podem ser removidos em produção

-- Para verificar se tudo foi criado corretamente, execute:
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- Para testar a função de dashboard:
-- SELECT get_dashboard_stats();

COMMIT;
