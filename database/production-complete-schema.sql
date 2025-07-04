
-- AlchemyRotas - Schema Completo para Produção VPS
-- Este arquivo cria toda a estrutura necessária do banco de dados
-- Execute este arquivo no PostgreSQL da VPS

-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Limpar banco se necessário (CUIDADO: Remove todos os dados)
DROP TABLE IF EXISTS route_progress CASCADE;
DROP TABLE IF EXISTS invoice_files CASCADE;
DROP TABLE IF EXISTS truck_location_history CASCADE;
DROP TABLE IF EXISTS truck_routes CASCADE;
DROP TABLE IF EXISTS route_assignments CASCADE;
DROP TABLE IF EXISTS schedule_assignments CASCADE;
DROP TABLE IF EXISTS route_points CASCADE;
DROP TABLE IF EXISTS trips CASCADE;
DROP TABLE IF EXISTS maintenance_records CASCADE;
DROP TABLE IF EXISTS schedules CASCADE;
DROP TABLE IF EXISTS routes CASCADE;
DROP TABLE IF EXISTS trucks CASCADE;
DROP TABLE IF EXISTS drivers CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS system_settings CASCADE;
DROP TABLE IF EXISTS reports CASCADE;

-- Função para verificar dependências antes de exclusões
CREATE OR REPLACE FUNCTION check_deletion_dependencies(
    table_name TEXT,
    record_id UUID
) RETURNS JSONB AS $$
DECLARE
    dependencies JSONB := '{}';
    count_result INTEGER;
BEGIN
    -- Verificar dependências para motoristas
    IF table_name = 'drivers' THEN
        -- Caminhões vinculados
        SELECT COUNT(*) INTO count_result FROM trucks WHERE current_driver_id = record_id;
        dependencies := jsonb_set(dependencies, '{trucks}', to_jsonb(count_result));
        
        -- Viagens realizadas
        SELECT COUNT(*) INTO count_result FROM trips WHERE driver_id = record_id;
        dependencies := jsonb_set(dependencies, '{trips}', to_jsonb(count_result));
        
        -- Agendamentos
        SELECT COUNT(*) INTO count_result FROM schedules WHERE driver_id = record_id;
        dependencies := jsonb_set(dependencies, '{schedules}', to_jsonb(count_result));
    END IF;
    
    -- Verificar dependências para caminhões
    IF table_name = 'trucks' THEN
        -- Viagens realizadas
        SELECT COUNT(*) INTO count_result FROM trips WHERE truck_id = record_id;
        dependencies := jsonb_set(dependencies, '{trips}', to_jsonb(count_result));
        
        -- Manutenções
        SELECT COUNT(*) INTO count_result FROM maintenance_records WHERE truck_id = record_id;
        dependencies := jsonb_set(dependencies, '{maintenance}', to_jsonb(count_result));
        
        -- Agendamentos
        SELECT COUNT(*) INTO count_result FROM schedules WHERE truck_id = record_id;
        dependencies := jsonb_set(dependencies, '{schedules}', to_jsonb(count_result));
    END IF;
    
    -- Verificar dependências para rotas
    IF table_name = 'routes' THEN
        -- Pontos de rota
        SELECT COUNT(*) INTO count_result FROM route_points WHERE route_id = record_id;
        dependencies := jsonb_set(dependencies, '{route_points}', to_jsonb(count_result));
        
        -- Agendamentos
        SELECT COUNT(*) INTO count_result FROM schedules WHERE route_id = record_id;
        dependencies := jsonb_set(dependencies, '{schedules}', to_jsonb(count_result));
        
        -- Viagens
        SELECT COUNT(*) INTO count_result FROM trips WHERE route_id = record_id;
        dependencies := jsonb_set(dependencies, '{trips}', to_jsonb(count_result));
    END IF;
    
    RETURN dependencies;
END;
$$ LANGUAGE plpgsql;

-- Tabela de usuários para autenticação
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE,
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'manager', 'user')),
    active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de motoristas
CREATE TABLE drivers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    license_number VARCHAR(20) UNIQUE NOT NULL,
    license_category VARCHAR(10) NOT NULL DEFAULT 'D',
    phone VARCHAR(20),
    email VARCHAR(100),
    hire_date DATE DEFAULT CURRENT_DATE,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    current_route VARCHAR(255),
    total_trips INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de rotas
CREATE TABLE routes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    points JSONB DEFAULT '[]',
    total_distance DECIMAL(10,2) DEFAULT 0,
    estimated_time VARCHAR(50),
    optimized_order JSONB DEFAULT '[]',
    polyline TEXT,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'draft')),
    estimated_duration INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de pontos de rota (CASCADE ao excluir rota)
CREATE TABLE route_points (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    route_id UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    address TEXT NOT NULL,
    lat DECIMAL(10,8) NOT NULL,
    lng DECIMAL(11,8) NOT NULL,
    point_order INTEGER NOT NULL,
    type VARCHAR(20) DEFAULT 'waypoint' CHECK (type IN ('origin', 'destination', 'waypoint')),
    estimated_arrival_time TIME,
    notes TEXT,
    completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de caminhões
CREATE TABLE trucks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    plate VARCHAR(10) UNIQUE NOT NULL,
    model VARCHAR(100) NOT NULL,
    year INTEGER NOT NULL,
    capacity_kg DECIMAL(10,2) DEFAULT 0,
    fuel_type VARCHAR(20) DEFAULT 'Diesel',
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'in-route', 'maintenance', 'inactive')),
    current_route_id UUID REFERENCES routes(id) ON DELETE SET NULL,
    current_route VARCHAR(255),
    driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
    driver VARCHAR(255),
    current_driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
    location_lat DECIMAL(10,8),
    location_lng DECIMAL(11,8),
    last_maintenance DATE,
    next_maintenance DATE,
    mileage INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de agendamentos (SET NULL para manter histórico)
CREATE TABLE schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100),
    truck_id UUID REFERENCES trucks(id) ON DELETE SET NULL,
    route_id UUID REFERENCES routes(id) ON DELETE SET NULL,
    route_name VARCHAR(255),
    driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
    scheduled_date DATE NOT NULL,
    scheduled_time TIME NOT NULL,
    start_date DATE,
    end_date DATE,
    days_of_week VARCHAR(20) DEFAULT '1,2,3,4,5',
    start_time TIME,
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in-progress', 'completed', 'cancelled', 'active')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de atribuições de agenda (CASCADE pois dependem do agendamento)
CREATE TABLE schedule_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    schedule_id UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
    truck_id UUID REFERENCES trucks(id) ON DELETE SET NULL,
    driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
    assigned_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in-progress', 'completed', 'cancelled')),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de atribuições de rota
CREATE TABLE route_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    route_id UUID REFERENCES routes(id) ON DELETE SET NULL,
    truck_id UUID REFERENCES trucks(id) ON DELETE SET NULL,
    driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
    assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(20) DEFAULT 'assigned' CHECK (status IN ('assigned', 'in-progress', 'completed', 'cancelled')),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de relação caminhão-rota (CASCADE)
CREATE TABLE truck_routes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    truck_id UUID REFERENCES trucks(id) ON DELETE CASCADE,
    route_id UUID REFERENCES routes(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    current_point_id VARCHAR(50),
    UNIQUE(truck_id, route_id)
);

-- Tabela de histórico de localização (CASCADE)
CREATE TABLE truck_location_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    truck_id UUID REFERENCES trucks(id) ON DELETE CASCADE,
    lat DECIMAL(10,8) NOT NULL,
    lng DECIMAL(11,8) NOT NULL,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    speed DECIMAL(5,2),
    heading DECIMAL(5,2)
);

-- Tabela de progresso de rota (CASCADE)
CREATE TABLE route_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    truck_route_id UUID REFERENCES truck_routes(id) ON DELETE CASCADE,
    point_id VARCHAR(50) NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP,
    lat DECIMAL(10,8),
    lng DECIMAL(11,8),
    notes TEXT
);

-- Tabela de registros de manutenção (SET NULL para preservar histórico)
CREATE TABLE maintenance_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    truck_id UUID REFERENCES trucks(id) ON DELETE SET NULL,
    type VARCHAR(50) NOT NULL,
    maintenance_type VARCHAR(100),
    description TEXT,
    cost DECIMAL(10,2) DEFAULT 0.00,
    maintenance_date DATE NOT NULL,
    scheduled_date DATE,
    completed_date DATE,
    next_maintenance_date DATE,
    performed_by VARCHAR(100),
    status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('scheduled', 'in-progress', 'completed', 'cancelled')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de viagens (RESTRICT para preservar histórico crítico)
CREATE TABLE trips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    truck_id UUID REFERENCES trucks(id) ON DELETE RESTRICT,
    route_id UUID REFERENCES routes(id) ON DELETE RESTRICT,
    driver_id UUID REFERENCES drivers(id) ON DELETE RESTRICT,
    distance_km DECIMAL(10,2) DEFAULT 0,
    duration_minutes INTEGER,
    status VARCHAR(20) DEFAULT 'in_progress' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de arquivos de fatura (CASCADE)
CREATE TABLE invoice_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    schedule_id UUID REFERENCES schedules(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR(100),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de configurações do sistema
CREATE TABLE system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    setting_type VARCHAR(50) DEFAULT 'string',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de relatórios
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_type VARCHAR(50) NOT NULL,
    start_date DATE,
    end_date DATE,
    parameters JSONB,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    file_path TEXT
);

-- ÍNDICES PARA PERFORMANCE
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(active);
CREATE INDEX idx_drivers_license ON drivers(license_number);
CREATE INDEX idx_drivers_status ON drivers(status);
CREATE INDEX idx_drivers_name ON drivers(name);
CREATE INDEX idx_routes_status ON routes(status);
CREATE INDEX idx_routes_name ON routes(name);
CREATE INDEX idx_route_points_route_id ON route_points(route_id);
CREATE INDEX idx_route_points_order ON route_points(point_order);
CREATE INDEX idx_trucks_plate ON trucks(plate);
CREATE INDEX idx_trucks_status ON trucks(status);
CREATE INDEX idx_trucks_current_driver ON trucks(current_driver_id);
CREATE INDEX idx_trucks_current_route ON trucks(current_route_id);
CREATE INDEX idx_trucks_driver ON trucks(driver_id);
CREATE INDEX idx_schedules_date ON schedules(scheduled_date);
CREATE INDEX idx_schedules_truck ON schedules(truck_id);
CREATE INDEX idx_schedules_route_id ON schedules(route_id);
CREATE INDEX idx_schedules_driver ON schedules(driver_id);
CREATE INDEX idx_schedule_assignments_schedule_id ON schedule_assignments(schedule_id);
CREATE INDEX idx_schedule_assignments_truck_id ON schedule_assignments(truck_id);
CREATE INDEX idx_schedule_assignments_driver_id ON schedule_assignments(driver_id);
CREATE INDEX idx_route_assignments_route_id ON route_assignments(route_id);
CREATE INDEX idx_route_assignments_truck_id ON route_assignments(truck_id);
CREATE INDEX idx_route_assignments_driver_id ON route_assignments(driver_id);
CREATE INDEX idx_truck_routes_truck_id ON truck_routes(truck_id);
CREATE INDEX idx_truck_routes_route_id ON truck_routes(route_id);
CREATE INDEX idx_truck_location_history_truck_id ON truck_location_history(truck_id);
CREATE INDEX idx_truck_location_history_recorded_at ON truck_location_history(recorded_at);
CREATE INDEX idx_maintenance_records_truck_id ON maintenance_records(truck_id);
CREATE INDEX idx_maintenance_records_date ON maintenance_records(maintenance_date);
CREATE INDEX idx_maintenance_records_status ON maintenance_records(status);
CREATE INDEX idx_trips_truck_id ON trips(truck_id);
CREATE INDEX idx_trips_route_id ON trips(route_id);
CREATE INDEX idx_trips_driver_id ON trips(driver_id);
CREATE INDEX idx_trips_status ON trips(status);
CREATE INDEX idx_trips_date ON trips(started_at);

-- TRIGGERS PARA ATUALIZAÇÃO AUTOMÁTICA DE updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_drivers_updated_at BEFORE UPDATE ON drivers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_routes_updated_at BEFORE UPDATE ON routes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_trucks_updated_at BEFORE UPDATE ON trucks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_schedules_updated_at BEFORE UPDATE ON schedules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_maintenance_records_updated_at BEFORE UPDATE ON maintenance_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- TRIGGER PARA ATUALIZAR CONTADOR DE VIAGENS DO MOTORISTA
CREATE OR REPLACE FUNCTION update_driver_trip_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE drivers SET total_trips = total_trips + 1 WHERE id = NEW.driver_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE drivers SET total_trips = GREATEST(total_trips - 1, 0) WHERE id = OLD.driver_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_driver_trip_count
    AFTER INSERT OR DELETE ON trips
    FOR EACH ROW EXECUTE FUNCTION update_driver_trip_count();

-- DADOS INICIAIS

-- Usuário administrador
INSERT INTO users (username, password, name, email, role) VALUES 
('phillipe.sodre', '@Wallace44', 'Phillipe Sodré', 'phillipe.sodre@alchemyrotas.com', 'admin');

-- Motoristas de exemplo
INSERT INTO drivers (name, license_number, license_category, phone, email, hire_date, status) VALUES 
('João Silva', 'CNH001234567', 'D', '(11) 98765-4321', 'joao.silva@email.com', '2023-01-15', 'active'),
('Maria Santos', 'CNH007654321', 'D', '(11) 99887-6543', 'maria.santos@email.com', '2023-02-20', 'active'),
('Pedro Costa', 'CNH009876543', 'D', '(11) 97654-3210', 'pedro.costa@email.com', '2023-03-10', 'active'),
('Ana Oliveira', 'CNH005432109', 'D', '(11) 96543-2109', 'ana.oliveira@email.com', '2023-04-05', 'active'),
('Carlos Ferreira', 'CNH003210987', 'D', '(11) 95432-1098', 'carlos.ferreira@email.com', '2023-05-12', 'active');

-- Caminhões de exemplo
INSERT INTO trucks (name, plate, model, year, capacity_kg, fuel_type, status, location_lat, location_lng, last_maintenance, next_maintenance, mileage) VALUES 
('Caminhão Alpha', 'ABC-1234', 'Mercedes-Benz Atego', 2020, 8000.00, 'Diesel', 'available', -19.9167, -44.0833, '2024-01-15', '2024-07-15', 45000),
('Caminhão Beta', 'DEF-5678', 'Volvo VM', 2019, 12000.00, 'Diesel', 'available', -19.9200, -44.0850, '2024-02-20', '2024-08-20', 62000),
('Caminhão Gamma', 'GHI-9012', 'Scania P-Series', 2021, 15000.00, 'Diesel', 'available', -19.9150, -44.0800, '2024-03-10', '2024-09-10', 38000),
('Caminhão Delta', 'JKL-3456', 'Iveco Daily', 2018, 5000.00, 'Diesel', 'maintenance', -19.9180, -44.0820, '2024-01-25', '2024-07-25', 85000),
('Caminhão Echo', 'MNO-7890', 'Ford Cargo', 2022, 10000.00, 'Diesel', 'available', -19.9220, -44.0870, '2024-04-05', '2024-10-05', 25000);

-- Rotas de exemplo
INSERT INTO routes (name, description, status, estimated_duration, total_distance, points) VALUES 
('Rota Centro-Sul', 'Rota que conecta o centro da cidade à zona sul', 'active', 120, 25.5, '[{"address":"Terminal Central, Contagem-MG","lat":-19.9167,"lng":-44.0833,"order":1,"type":"origin"},{"address":"Shopping Contagem, Contagem-MG","lat":-19.9200,"lng":-44.0850,"order":2,"type":"waypoint"},{"address":"Bairro Eldorado, Contagem-MG","lat":-19.9250,"lng":-44.0900,"order":3,"type":"destination"}]'),
('Rota Norte-Leste', 'Percurso pela zona norte e leste da cidade', 'active', 90, 18.2, '[{"address":"Centro Norte, Contagem-MG","lat":-19.9100,"lng":-44.0800,"order":1,"type":"origin"},{"address":"Zona Leste, Contagem-MG","lat":-19.9050,"lng":-44.0750,"order":2,"type":"destination"}]'),
('Rota Industrial', 'Atendimento ao distrito industrial', 'active', 150, 35.8, '[{"address":"Distrito Industrial, Contagem-MG","lat":-19.9300,"lng":-44.1000,"order":1,"type":"origin"},{"address":"Zona Industrial Norte, Contagem-MG","lat":-19.9350,"lng":-44.1050,"order":2,"type":"destination"}]'),
('Rota Metropolitana', 'Cobertura da região metropolitana', 'active', 180, 45.2, '[{"address":"Terminal Metropolitano, Contagem-MG","lat":-19.9400,"lng":-44.1100,"order":1,"type":"origin"},{"address":"Região Metropolitana Sul, Contagem-MG","lat":-19.9450,"lng":-44.1150,"order":2,"type":"destination"}]'),
('Rota Expressa', 'Rota rápida centro-aeroporto', 'active', 60, 12.5, '[{"address":"Centro, Contagem-MG","lat":-19.9167,"lng":-44.0833,"order":1,"type":"origin"},{"address":"Aeroporto, Confins-MG","lat":-19.6333,"lng":-43.9667,"order":2,"type":"destination"}]');

-- Pontos de rota detalhados
INSERT INTO route_points (route_id, address, lat, lng, point_order, type, estimated_arrival_time) 
SELECT r.id, 'Terminal Central, Contagem-MG', -19.9167, -44.0833, 1, 'origin', '08:00:00'
FROM routes r WHERE r.name = 'Rota Centro-Sul' LIMIT 1;

INSERT INTO route_points (route_id, address, lat, lng, point_order, type, estimated_arrival_time) 
SELECT r.id, 'Shopping Contagem, Contagem-MG', -19.9200, -44.0850, 2, 'waypoint', '08:30:00'
FROM routes r WHERE r.name = 'Rota Centro-Sul' LIMIT 1;

INSERT INTO route_points (route_id, address, lat, lng, point_order, type, estimated_arrival_time) 
SELECT r.id, 'Bairro Eldorado, Contagem-MG', -19.9250, -44.0900, 3, 'destination', '09:00:00'
FROM routes r WHERE r.name = 'Rota Centro-Sul' LIMIT 1;

-- Registros de manutenção
INSERT INTO maintenance_records (truck_id, type, maintenance_type, description, cost, maintenance_date, next_maintenance_date, performed_by, status)
SELECT t.id, 'Revisão Preventiva', 'Revisão Preventiva', 'Troca de óleo e filtros', 350.00, '2024-01-15', '2024-07-15', 'Oficina Central', 'completed'
FROM trucks t WHERE t.plate = 'ABC-1234' LIMIT 1;

INSERT INTO maintenance_records (truck_id, type, maintenance_type, description, cost, maintenance_date, next_maintenance_date, performed_by, status)
SELECT t.id, 'Reparo de Freios', 'Reparo de Freios', 'Substituição de pastilhas de freio', 280.00, '2024-02-20', '2024-08-20', 'Oficina Norte', 'completed'
FROM trucks t WHERE t.plate = 'DEF-5678' LIMIT 1;

-- Agendamentos de exemplo
INSERT INTO schedules (name, route_id, truck_id, driver_id, start_date, end_date, days_of_week, start_time, scheduled_date, scheduled_time, status)
SELECT 'Cronograma Semanal Centro-Sul', r.id, t.id, d.id, '2024-06-01', '2024-12-31', '1,2,3,4,5', '08:00:00', CURRENT_DATE, '08:00:00', 'active'
FROM routes r, trucks t, drivers d 
WHERE r.name = 'Rota Centro-Sul' AND t.plate = 'ABC-1234' AND d.name = 'João Silva'
LIMIT 1;

-- Vincular motoristas aos caminhões
UPDATE trucks SET 
    current_driver_id = (SELECT id FROM drivers WHERE name = 'João Silva' LIMIT 1),
    driver = 'João Silva',
    driver_id = (SELECT id FROM drivers WHERE name = 'João Silva' LIMIT 1)
WHERE plate = 'ABC-1234';

UPDATE trucks SET 
    current_driver_id = (SELECT id FROM drivers WHERE name = 'Maria Santos' LIMIT 1),
    driver = 'Maria Santos',
    driver_id = (SELECT id FROM drivers WHERE name = 'Maria Santos' LIMIT 1)
WHERE plate = 'DEF-5678';

UPDATE trucks SET 
    current_driver_id = (SELECT id FROM drivers WHERE name = 'Pedro Costa' LIMIT 1),
    driver = 'Pedro Costa',
    driver_id = (SELECT id FROM drivers WHERE name = 'Pedro Costa' LIMIT 1)
WHERE plate = 'GHI-9012';

UPDATE trucks SET 
    current_driver_id = (SELECT id FROM drivers WHERE name = 'Ana Oliveira' LIMIT 1),
    driver = 'Ana Oliveira',
    driver_id = (SELECT id FROM drivers WHERE name = 'Ana Oliveira' LIMIT 1)
WHERE plate = 'MNO-7890';

-- Atribuir rotas ativas a alguns caminhões
UPDATE trucks SET 
    current_route_id = (SELECT id FROM routes WHERE name = 'Rota Centro-Sul' LIMIT 1), 
    current_route = 'Rota Centro-Sul',
    status = 'in-route' 
WHERE plate = 'ABC-1234';

UPDATE trucks SET 
    current_route_id = (SELECT id FROM routes WHERE name = 'Rota Norte-Leste' LIMIT 1),
    current_route = 'Rota Norte-Leste',
    status = 'in-route' 
WHERE plate = 'DEF-5678';

-- Configurações do sistema
INSERT INTO system_settings (setting_key, setting_value, setting_type) 
VALUES 
    ('theme', 'light', 'string'),
    ('company_name', 'AlchemyRotas', 'string'),
    ('default_map_zoom', '12', 'number'),
    ('maintenance_alert_days', '30', 'number'),
    ('max_daily_hours', '8', 'number');

-- Viagem de exemplo
INSERT INTO trips (truck_id, route_id, driver_id, distance_km, status, started_at, completed_at)
SELECT t.id, r.id, d.id, 25.5, 'completed', '2024-01-15 08:00:00', '2024-01-15 10:00:00'
FROM trucks t, routes r, drivers d
WHERE t.plate = 'ABC-1234' AND r.name = 'Rota Centro-Sul' AND d.name = 'João Silva'
LIMIT 1;

-- Mensagem de conclusão
DO $$
BEGIN
    RAISE NOTICE '✅ Schema completo criado com sucesso!';
    RAISE NOTICE '📊 Tabelas: % criadas', (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public');
    RAISE NOTICE '🔗 Relacionamentos com CASCADE, SET NULL e RESTRICT configurados';
    RAISE NOTICE '⚡ Índices de performance criados';
    RAISE NOTICE '🔧 Triggers e funções implementados';
    RAISE NOTICE '📝 Dados de exemplo inseridos';
    RAISE NOTICE '🚀 Banco pronto para produção na VPS!';
END $$;

COMMIT;
