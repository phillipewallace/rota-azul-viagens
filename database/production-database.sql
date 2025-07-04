
-- ============================================
-- AlchemyRotas - Complete Production Database
-- Execute este arquivo em sua VPS PostgreSQL
-- ============================================

-- Criar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- TABELAS PRINCIPAIS
-- ============================================

-- Tabela de usuários (para autenticação)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de motoristas
CREATE TABLE IF NOT EXISTS drivers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    license_number VARCHAR(50) UNIQUE NOT NULL,
    license_category VARCHAR(10) DEFAULT 'B',
    phone VARCHAR(20),
    email VARCHAR(255),
    hire_date DATE DEFAULT CURRENT_DATE,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    current_route VARCHAR(255),
    total_trips INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de rotas
CREATE TABLE IF NOT EXISTS routes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    points JSONB,
    total_distance DECIMAL(10, 2),
    estimated_time VARCHAR(50),
    optimized_order JSONB,
    polyline TEXT,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de pontos das rotas
CREATE TABLE IF NOT EXISTS route_points (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    route_id UUID NOT NULL,
    point_order INTEGER NOT NULL,
    address TEXT NOT NULL,
    lat DECIMAL(10, 8),
    lng DECIMAL(11, 8),
    delivery_type VARCHAR(50),
    estimated_time_minutes INTEGER DEFAULT 30,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de caminhões
CREATE TABLE IF NOT EXISTS trucks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    plate VARCHAR(20) UNIQUE NOT NULL,
    model VARCHAR(255),
    year INTEGER,
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'in-route', 'maintenance', 'inactive')),
    current_driver_id UUID,
    current_route_id UUID,
    current_route VARCHAR(255),
    driver VARCHAR(255),
    last_maintenance DATE,
    mileage INTEGER DEFAULT 0,
    location_lat DECIMAL(10, 8),
    location_lng DECIMAL(11, 8),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de agendamentos
CREATE TABLE IF NOT EXISTS schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    truck_id UUID,
    route_id UUID,
    driver_id UUID,
    route_name VARCHAR(255),
    scheduled_date DATE NOT NULL,
    scheduled_time TIME NOT NULL,
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in-progress', 'completed', 'cancelled')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de viagens (histórico)
CREATE TABLE IF NOT EXISTS trips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    truck_id UUID,
    route_id UUID,
    driver_id UUID,
    distance_km DECIMAL(10, 2),
    duration_minutes INTEGER,
    fuel_consumed DECIMAL(8, 2),
    status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('in-progress', 'completed', 'cancelled')),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de manutenções
CREATE TABLE IF NOT EXISTS maintenance_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    truck_id UUID NOT NULL,
    maintenance_type VARCHAR(100) NOT NULL,
    description TEXT,
    cost DECIMAL(10, 2),
    scheduled_date DATE,
    completed_date DATE,
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in-progress', 'completed', 'cancelled')),
    mechanic_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de histórico de localização
CREATE TABLE IF NOT EXISTS truck_location_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    truck_id UUID NOT NULL,
    lat DECIMAL(10, 8) NOT NULL,
    lng DECIMAL(11, 8) NOT NULL,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    speed DECIMAL(5, 2),
    heading DECIMAL(5, 2)
);

-- Tabela de configurações do sistema
CREATE TABLE IF NOT EXISTS system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    setting_type VARCHAR(50) DEFAULT 'string',
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- CHAVES ESTRANGEIRAS COM CASCATAS INTELIGENTES
-- ============================================

-- Trucks -> Drivers (SET NULL quando motorista é excluído)
ALTER TABLE trucks 
ADD CONSTRAINT trucks_current_driver_id_fkey 
FOREIGN KEY (current_driver_id) 
REFERENCES drivers(id) 
ON DELETE SET NULL 
ON UPDATE CASCADE;

-- Trucks -> Routes (SET NULL quando rota é excluída)
ALTER TABLE trucks 
ADD CONSTRAINT trucks_current_route_id_fkey 
FOREIGN KEY (current_route_id) 
REFERENCES routes(id) 
ON DELETE SET NULL 
ON UPDATE CASCADE;

-- Route Points -> Routes (CASCADE - pontos são específicos da rota)
ALTER TABLE route_points 
ADD CONSTRAINT route_points_route_id_fkey 
FOREIGN KEY (route_id) 
REFERENCES routes(id) 
ON DELETE CASCADE 
ON UPDATE CASCADE;

-- Schedules -> Trucks (CASCADE - se caminhão for excluído, agendamentos também)
ALTER TABLE schedules 
ADD CONSTRAINT schedules_truck_id_fkey 
FOREIGN KEY (truck_id) 
REFERENCES trucks(id) 
ON DELETE CASCADE 
ON UPDATE CASCADE;

-- Schedules -> Drivers (SET NULL quando motorista é excluído)
ALTER TABLE schedules 
ADD CONSTRAINT schedules_driver_id_fkey 
FOREIGN KEY (driver_id) 
REFERENCES drivers(id) 
ON DELETE SET NULL 
ON UPDATE CASCADE;

-- Schedules -> Routes (SET NULL quando rota é excluída)
ALTER TABLE schedules 
ADD CONSTRAINT schedules_route_id_fkey 
FOREIGN KEY (route_id) 
REFERENCES routes(id) 
ON DELETE SET NULL 
ON UPDATE CASCADE;

-- Maintenance -> Trucks (CASCADE - manutenções são específicas do caminhão)
ALTER TABLE maintenance_records 
ADD CONSTRAINT maintenance_records_truck_id_fkey 
FOREIGN KEY (truck_id) 
REFERENCES trucks(id) 
ON DELETE CASCADE 
ON UPDATE CASCADE;

-- Trips -> Trucks (RESTRICT - não pode excluir caminhão com viagens)
ALTER TABLE trips 
ADD CONSTRAINT trips_truck_id_fkey 
FOREIGN KEY (truck_id) 
REFERENCES trucks(id) 
ON DELETE RESTRICT 
ON UPDATE CASCADE;

-- Trips -> Drivers (SET NULL quando motorista é excluído)
ALTER TABLE trips 
ADD CONSTRAINT trips_driver_id_fkey 
FOREIGN KEY (driver_id) 
REFERENCES drivers(id) 
ON DELETE SET NULL 
ON UPDATE CASCADE;

-- Truck Location History -> Trucks (CASCADE)
ALTER TABLE truck_location_history 
ADD CONSTRAINT truck_location_history_truck_id_fkey 
FOREIGN KEY (truck_id) 
REFERENCES trucks(id) 
ON DELETE CASCADE 
ON UPDATE CASCADE;

-- ============================================
-- ÍNDICES PARA PERFORMANCE
-- ============================================

-- Índices para drivers
CREATE INDEX IF NOT EXISTS idx_drivers_status ON drivers(status);
CREATE INDEX IF NOT EXISTS idx_drivers_license ON drivers(license_number);
CREATE INDEX IF NOT EXISTS idx_drivers_created_at ON drivers(created_at);

-- Índices para trucks
CREATE INDEX IF NOT EXISTS idx_trucks_status ON trucks(status);
CREATE INDEX IF NOT EXISTS idx_trucks_current_driver_id ON trucks(current_driver_id);
CREATE INDEX IF NOT EXISTS idx_trucks_current_route_id ON trucks(current_route_id);
CREATE INDEX IF NOT EXISTS idx_trucks_plate ON trucks(plate);

-- Índices para routes
CREATE INDEX IF NOT EXISTS idx_routes_status ON routes(status);
CREATE INDEX IF NOT EXISTS idx_routes_created_at ON routes(created_at);

-- Índices para route_points
CREATE INDEX IF NOT EXISTS idx_route_points_route_id ON route_points(route_id);
CREATE INDEX IF NOT EXISTS idx_route_points_order ON route_points(route_id, point_order);

-- Índices para schedules
CREATE INDEX IF NOT EXISTS idx_schedules_truck_id ON schedules(truck_id);
CREATE INDEX IF NOT EXISTS idx_schedules_driver_id ON schedules(driver_id);
CREATE INDEX IF NOT EXISTS idx_schedules_route_id ON schedules(route_id);
CREATE INDEX IF NOT EXISTS idx_schedules_date ON schedules(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_schedules_status ON schedules(status);

-- Índices para maintenance
CREATE INDEX IF NOT EXISTS idx_maintenance_truck_id ON maintenance_records(truck_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_status ON maintenance_records(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_scheduled_date ON maintenance_records(scheduled_date);

-- Índices para trips
CREATE INDEX IF NOT EXISTS idx_trips_truck_id ON trips(truck_id);
CREATE INDEX IF NOT EXISTS idx_trips_driver_id ON trips(driver_id);
CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);
CREATE INDEX IF NOT EXISTS idx_trips_completed_at ON trips(completed_at);

-- Índices para location history
CREATE INDEX IF NOT EXISTS idx_truck_location_history_truck_id ON truck_location_history(truck_id);
CREATE INDEX IF NOT EXISTS idx_truck_location_history_recorded_at ON truck_location_history(recorded_at);

-- ============================================
-- FUNÇÃO PARA VERIFICAR DEPENDÊNCIAS
-- ============================================

CREATE OR REPLACE FUNCTION check_deletion_dependencies(
    table_name TEXT,
    record_id UUID
) RETURNS JSON AS $$
DECLARE
    result JSON;
    truck_count INTEGER := 0;
    schedule_count INTEGER := 0;
    trip_count INTEGER := 0;
    maintenance_count INTEGER := 0;
    route_point_count INTEGER := 0;
BEGIN
    -- Verificar dependências baseadas na tabela
    IF table_name = 'drivers' THEN
        SELECT COUNT(*) INTO truck_count FROM trucks WHERE current_driver_id = record_id;
        SELECT COUNT(*) INTO schedule_count FROM schedules WHERE driver_id = record_id;
        SELECT COUNT(*) INTO trip_count FROM trips WHERE driver_id = record_id;
        
        result := json_build_object(
            'canDelete', truck_count = 0,
            'trucks', truck_count,
            'schedules', schedule_count,
            'trips', trip_count,
            'tripsCount', trip_count,
            'message', CASE 
                WHEN truck_count > 0 THEN 'Motorista está vinculado a ' || truck_count || ' caminhão(ões)'
                ELSE 'Pode ser excluído com segurança'
            END
        );
        
    ELSIF table_name = 'trucks' THEN
        SELECT COUNT(*) INTO schedule_count FROM schedules WHERE truck_id = record_id;
        SELECT COUNT(*) INTO trip_count FROM trips WHERE truck_id = record_id;
        SELECT COUNT(*) INTO maintenance_count FROM maintenance_records WHERE truck_id = record_id;
        
        result := json_build_object(
            'canDelete', trip_count = 0,
            'schedules', schedule_count,
            'trips', trip_count,
            'maintenance', maintenance_count,
            'message', CASE 
                WHEN trip_count > 0 THEN 'Caminhão possui ' || trip_count || ' viagem(ns) registrada(s)'
                ELSE 'Pode ser excluído (agendamentos e manutenções serão removidos)'
            END
        );
        
    ELSIF table_name = 'routes' THEN
        SELECT COUNT(*) INTO schedule_count FROM schedules WHERE route_id = record_id;
        SELECT COUNT(*) INTO route_point_count FROM route_points WHERE route_id = record_id;
        
        result := json_build_object(
            'canDelete', true,
            'schedules', schedule_count,
            'points', route_point_count,
            'message', 'Pode ser excluída (agendamentos serão desvinculados e pontos removidos)'
        );
        
    ELSE
        result := json_build_object('canDelete', true, 'message', 'Sem dependências verificadas');
    END IF;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- CONFIGURAÇÕES PADRÃO DO SISTEMA
-- ============================================

INSERT INTO system_settings (setting_key, setting_value, setting_type, description) 
VALUES 
    ('theme', 'light', 'string', 'Tema padrão da aplicação'),
    ('company_name', 'AlchemyRotas', 'string', 'Nome da empresa'),
    ('default_map_zoom', '12', 'number', 'Zoom padrão do mapa'),
    ('maintenance_reminder_days', '7', 'number', 'Dias de antecedência para lembrete de manutenção'),
    ('max_route_points', '20', 'number', 'Máximo de pontos por rota'),
    ('default_delivery_time', '30', 'number', 'Tempo padrão de entrega em minutos'),
    ('fuel_cost_per_liter', '5.50', 'number', 'Custo do combustível por litro'),
    ('api_google_maps_enabled', 'true', 'boolean', 'Habilitar Google Maps API')
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================
-- USUÁRIO ADMINISTRADOR PADRÃO
-- ============================================

-- Senha padrão: admin123 (alterar após primeiro login)
INSERT INTO users (email, password_hash, name, role) 
VALUES (
    'admin@alchemyrotas.com',
    crypt('admin123', gen_salt('bf')),
    'Administrador',
    'admin'
) ON CONFLICT (email) DO NOTHING;

-- ============================================
-- COMENTÁRIOS E DOCUMENTAÇÃO
-- ============================================

COMMENT ON TABLE drivers IS 'Tabela de motoristas do sistema';
COMMENT ON TABLE trucks IS 'Tabela de caminhões/veículos';
COMMENT ON TABLE routes IS 'Tabela de rotas de entrega';
COMMENT ON TABLE route_points IS 'Pontos específicos de cada rota';
COMMENT ON TABLE schedules IS 'Agendamentos de rotas';
COMMENT ON TABLE trips IS 'Histórico de viagens realizadas';
COMMENT ON TABLE maintenance_records IS 'Registros de manutenção dos veículos';
COMMENT ON TABLE truck_location_history IS 'Histórico de localização dos caminhões';
COMMENT ON TABLE system_settings IS 'Configurações gerais do sistema';

COMMENT ON FUNCTION check_deletion_dependencies IS 'Verifica dependências antes de excluir registros';

-- ============================================
-- FINALIZAÇÃO
-- ============================================

-- Atualizar estatísticas da base de dados
ANALYZE;

-- Log de conclusão
DO $$
BEGIN
    RAISE NOTICE 'Database AlchemyRotas criada com sucesso!';
    RAISE NOTICE 'Usuário admin criado: admin@alchemyrotas.com / admin123';
    RAISE NOTICE 'Altere a senha padrão após primeiro login!';
END
$$;
