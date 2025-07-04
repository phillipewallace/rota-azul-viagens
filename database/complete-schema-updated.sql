
-- AlchemyRotas - Complete Database Schema - UPDATED VERSION
-- Execute this file to create all necessary tables and relationships

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables if they exist (in correct order due to dependencies)
DROP TABLE IF EXISTS invoice_files CASCADE;
DROP TABLE IF EXISTS route_progress CASCADE;
DROP TABLE IF EXISTS truck_location_history CASCADE;
DROP TABLE IF EXISTS truck_routes CASCADE;
DROP TABLE IF EXISTS schedules CASCADE;
DROP TABLE IF EXISTS maintenance CASCADE;
DROP TABLE IF EXISTS trips CASCADE;
DROP TABLE IF EXISTS reports CASCADE;
DROP TABLE IF EXISTS system_settings CASCADE;
DROP TABLE IF EXISTS trucks CASCADE;
DROP TABLE IF EXISTS routes CASCADE;  
DROP TABLE IF EXISTS drivers CASCADE;

-- Drivers table
CREATE TABLE drivers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    license_number VARCHAR(50) UNIQUE NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255),
    hire_date DATE,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Routes table
CREATE TABLE routes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    points JSONB NOT NULL DEFAULT '[]',
    total_distance DECIMAL(10, 2) DEFAULT 0,
    estimated_time VARCHAR(50),
    optimized_order JSONB DEFAULT '[]',
    polyline TEXT,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'completed')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trucks table
CREATE TABLE trucks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    plate VARCHAR(20) UNIQUE NOT NULL,
    model VARCHAR(255),
    year INTEGER CHECK (year > 1900 AND year <= EXTRACT(YEAR FROM CURRENT_DATE) + 1),
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'in-route', 'maintenance', 'inactive')),
    driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
    current_route_id UUID REFERENCES routes(id) ON DELETE SET NULL,
    active_route_id UUID REFERENCES routes(id) ON DELETE SET NULL,
    route_started_at TIMESTAMP,
    last_maintenance DATE,
    mileage INTEGER DEFAULT 0 CHECK (mileage >= 0),
    location_lat DECIMAL(10, 8),
    location_lng DECIMAL(11, 8),
    fuel_level DECIMAL(5, 2) CHECK (fuel_level >= 0 AND fuel_level <= 100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Schedules table
CREATE TABLE schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    truck_id UUID REFERENCES trucks(id) ON DELETE CASCADE,
    route_name VARCHAR(255),
    driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
    scheduled_date DATE NOT NULL,
    scheduled_time TIME NOT NULL,
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in-progress', 'completed', 'cancelled')),
    notes TEXT,
    actual_start_time TIMESTAMP,
    actual_end_time TIMESTAMP,
    distance_covered DECIMAL(10, 2),
    fuel_consumed DECIMAL(8, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Truck routes relationship table
CREATE TABLE truck_routes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    truck_id UUID REFERENCES trucks(id) ON DELETE CASCADE,
    route_id UUID REFERENCES routes(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    current_point_id VARCHAR(50),
    progress_percentage DECIMAL(5, 2) DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    estimated_completion TIMESTAMP,
    actual_distance DECIMAL(10, 2),
    UNIQUE(truck_id, route_id, status) DEFERRABLE INITIALLY DEFERRED
);

-- Truck location history
CREATE TABLE truck_location_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    truck_id UUID REFERENCES trucks(id) ON DELETE CASCADE,
    lat DECIMAL(10, 8) NOT NULL,
    lng DECIMAL(11, 8) NOT NULL,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    speed DECIMAL(5, 2) CHECK (speed >= 0),
    heading DECIMAL(5, 2) CHECK (heading >= 0 AND heading < 360),
    accuracy DECIMAL(8, 2),
    altitude DECIMAL(10, 2)
);

-- Route progress tracking
CREATE TABLE route_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    truck_route_id UUID REFERENCES truck_routes(id) ON DELETE CASCADE,
    point_id VARCHAR(50) NOT NULL,
    point_order INTEGER NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP,
    lat DECIMAL(10, 8),
    lng DECIMAL(11, 8),
    notes TEXT,
    arrival_time TIMESTAMP,
    departure_time TIMESTAMP,
    delay_minutes INTEGER DEFAULT 0
);

-- Invoice files table
CREATE TABLE invoice_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    schedule_id UUID REFERENCES schedules(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255),
    file_path TEXT NOT NULL,
    file_size INTEGER CHECK (file_size > 0),
    mime_type VARCHAR(100),
    upload_status VARCHAR(20) DEFAULT 'pending' CHECK (upload_status IN ('pending', 'uploaded', 'failed')),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- System settings table  
CREATE TABLE system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    setting_type VARCHAR(50) DEFAULT 'string' CHECK (setting_type IN ('string', 'number', 'boolean', 'json')),
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reports table
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_type VARCHAR(50) NOT NULL,
    title VARCHAR(255),
    start_date DATE,
    end_date DATE,
    parameters JSONB DEFAULT '{}',
    generated_by VARCHAR(255),
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    file_path TEXT,
    file_size INTEGER,
    status VARCHAR(20) DEFAULT 'generated' CHECK (status IN ('generating', 'generated', 'failed', 'deleted'))
);

-- Trips table for tracking completed routes
CREATE TABLE trips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    truck_id UUID REFERENCES trucks(id) ON DELETE SET NULL,
    route_id UUID REFERENCES routes(id) ON DELETE SET NULL,
    driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
    trip_number VARCHAR(50) UNIQUE,
    distance_km DECIMAL(10, 2) CHECK (distance_km >= 0),
    duration_minutes INTEGER CHECK (duration_minutes >= 0),
    fuel_consumed DECIMAL(8, 2) CHECK (fuel_consumed >= 0),
    average_speed DECIMAL(5, 2) CHECK (average_speed >= 0),
    status VARCHAR(20) DEFAULT 'in_progress' CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    total_stops INTEGER DEFAULT 0,
    delayed_stops INTEGER DEFAULT 0,
    route_efficiency DECIMAL(5, 2) CHECK (route_efficiency >= 0 AND route_efficiency <= 100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Maintenance table
CREATE TABLE maintenance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    truck_id UUID REFERENCES trucks(id) ON DELETE CASCADE,
    maintenance_type VARCHAR(100) NOT NULL,
    category VARCHAR(50) DEFAULT 'routine' CHECK (category IN ('routine', 'preventive', 'corrective', 'emergency')),
    description TEXT,
    cost DECIMAL(10, 2) CHECK (cost >= 0),
    labor_hours DECIMAL(5, 2) CHECK (labor_hours >= 0),
    parts_replaced TEXT[],
    mechanic_name VARCHAR(255),
    service_provider VARCHAR(255),
    scheduled_date DATE,
    started_date DATE,
    completed_date DATE,
    next_maintenance_due DATE,
    mileage_at_maintenance INTEGER CHECK (mileage_at_maintenance >= 0),
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'overdue')),
    priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    warranty_until DATE,
    invoice_number VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Fuel records table
CREATE TABLE fuel_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    truck_id UUID REFERENCES trucks(id) ON DELETE CASCADE,
    fuel_station VARCHAR(255),
    fuel_type VARCHAR(50) DEFAULT 'diesel',
    liters DECIMAL(8, 2) NOT NULL CHECK (liters > 0),
    price_per_liter DECIMAL(6, 3) CHECK (price_per_liter > 0),
    total_cost DECIMAL(10, 2) CHECK (total_cost > 0),
    odometer_reading INTEGER CHECK (odometer_reading >= 0),
    fuel_efficiency DECIMAL(5, 2),
    receipt_number VARCHAR(100),
    refuel_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    location_lat DECIMAL(10, 8),
    location_lng DECIMAL(11, 8),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Expenses table
CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    truck_id UUID REFERENCES trucks(id) ON DELETE CASCADE,
    trip_id UUID REFERENCES trips(id) ON DELETE SET NULL,
    expense_type VARCHAR(50) NOT NULL,
    category VARCHAR(50) DEFAULT 'operational' CHECK (category IN ('fuel', 'maintenance', 'toll', 'parking', 'food', 'accommodation', 'fine', 'other')),
    description TEXT,
    amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) DEFAULT 'BRL',
    expense_date DATE NOT NULL,
    receipt_number VARCHAR(100),
    vendor VARCHAR(255),
    location VARCHAR(255),
    is_reimbursable BOOLEAN DEFAULT FALSE,
    approved BOOLEAN DEFAULT FALSE,
    approved_by VARCHAR(255),
    approved_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notifications table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'info' CHECK (type IN ('info', 'warning', 'error', 'success')),
    target_user VARCHAR(255),
    target_role VARCHAR(50),
    related_entity_type VARCHAR(50),
    related_entity_id UUID,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    expires_at TIMESTAMP,
    priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_trucks_status ON trucks(status);
CREATE INDEX idx_trucks_current_route ON trucks(current_route_id);
CREATE INDEX idx_trucks_driver ON trucks(driver_id);
CREATE INDEX idx_trucks_plate ON trucks(plate);

CREATE INDEX idx_drivers_status ON drivers(status);
CREATE INDEX idx_drivers_license ON drivers(license_number);

CREATE INDEX idx_routes_status ON routes(status);
CREATE INDEX idx_routes_name ON routes(name);

CREATE INDEX idx_schedules_date ON schedules(scheduled_date);
CREATE INDEX idx_schedules_truck ON schedules(truck_id);
CREATE INDEX idx_schedules_status ON schedules(status);

CREATE INDEX idx_truck_routes_truck_id ON truck_routes(truck_id);
CREATE INDEX idx_truck_routes_route_id ON truck_routes(route_id);
CREATE INDEX idx_truck_routes_status ON truck_routes(status);

CREATE INDEX idx_truck_location_history_truck_id ON truck_location_history(truck_id);
CREATE INDEX idx_truck_location_history_recorded_at ON truck_location_history(recorded_at);

CREATE INDEX idx_route_progress_truck_route_id ON route_progress(truck_route_id);
CREATE INDEX idx_route_progress_completed ON route_progress(completed);

CREATE INDEX idx_trips_truck_id ON trips(truck_id);
CREATE INDEX idx_trips_route_id ON trips(route_id);
CREATE INDEX idx_trips_status ON trips(status);
CREATE INDEX idx_trips_dates ON trips(started_at, completed_at);

CREATE INDEX idx_maintenance_truck_id ON maintenance(truck_id);
CREATE INDEX idx_maintenance_status ON maintenance(status);
CREATE INDEX idx_maintenance_dates ON maintenance(scheduled_date, completed_date);
CREATE INDEX idx_maintenance_priority ON maintenance(priority);

CREATE INDEX idx_fuel_records_truck_id ON fuel_records(truck_id);
CREATE INDEX idx_fuel_records_date ON fuel_records(refuel_date);

CREATE INDEX idx_expenses_truck_id ON expenses(truck_id);
CREATE INDEX idx_expenses_category ON expenses(category);
CREATE INDEX idx_expenses_date ON expenses(expense_date);

CREATE INDEX idx_notifications_target ON notifications(target_user, target_role);
CREATE INDEX idx_notifications_read ON notifications(is_read);
CREATE INDEX idx_notifications_created ON notifications(created_at);

-- Create triggers for updated_at fields
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_drivers_updated_at BEFORE UPDATE ON drivers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trucks_updated_at BEFORE UPDATE ON trucks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_routes_updated_at BEFORE UPDATE ON routes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_schedules_updated_at BEFORE UPDATE ON schedules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_maintenance_updated_at BEFORE UPDATE ON maintenance
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default system settings
INSERT INTO system_settings (setting_key, setting_value, setting_type, description, is_public) VALUES 
    ('theme', 'light', 'string', 'Interface theme', true),
    ('company_name', 'AlchemyRotas', 'string', 'Company name', true),
    ('default_map_zoom', '12', 'number', 'Default map zoom level', true),
    ('maintenance_reminder_days', '30', 'number', 'Days before maintenance reminder', false),
    ('fuel_efficiency_alert_threshold', '15', 'number', 'Fuel efficiency alert threshold (km/l)', false),
    ('max_working_hours_per_day', '8', 'number', 'Maximum working hours per day', false),
    ('location_update_interval', '30', 'number', 'Location update interval in seconds', false),
    ('enable_notifications', 'true', 'boolean', 'Enable system notifications', true),
    ('currency', 'BRL', 'string', 'Default currency', true),
    ('time_zone', 'America/Sao_Paulo', 'string', 'System timezone', false)
ON CONFLICT (setting_key) DO UPDATE SET 
    setting_value = EXCLUDED.setting_value,
    updated_at = CURRENT_TIMESTAMP;

-- Insert sample data (optional)
INSERT INTO drivers (name, license_number, phone, email, hire_date) VALUES
    ('João Silva', 'CNH123456789', '(11) 99999-1111', 'joao@email.com', '2023-01-15'),
    ('Maria Santos', 'CNH987654321', '(11) 99999-2222', 'maria@email.com', '2023-02-20'),
    ('Pedro Oliveira', 'CNH456789123', '(11) 99999-3333', 'pedro@email.com', '2023-03-10'),
    ('Ana Costa', 'CNH789123456', '(11) 99999-4444', 'ana@email.com', '2023-04-05')
ON CONFLICT (license_number) DO NOTHING;

INSERT INTO trucks (name, plate, model, year, mileage, fuel_level) VALUES
    ('Caminhão 01', 'ABC-1234', 'Mercedes-Benz Atego', 2020, 45000, 75.5),
    ('Caminhão 02', 'DEF-5678', 'Volvo VM', 2019, 62000, 82.3),
    ('Caminhão 03', 'GHI-9012', 'Scania R440', 2021, 28000, 90.0),
    ('Caminhão 04', 'JKL-3456', 'Mercedes-Benz Axor', 2018, 78000, 65.2)
ON CONFLICT (plate) DO NOTHING;

-- Insert sample routes
INSERT INTO routes (name, description, points, total_distance, estimated_time, status) VALUES
    ('Rota Centro-Sul', 'Rota principal do centro para zona sul', 
     '[{"id":"1","address":"Centro, Belo Horizonte - MG","lat":-19.9167,"lng":-43.9345,"order":0,"type":"origin"},{"id":"2","address":"Zona Sul, Belo Horizonte - MG","lat":-19.9500,"lng":-43.9300,"order":1,"type":"destination"}]',
     25.5, '1h 30min', 'active'),
    ('Rota Industrial', 'Rota para distrito industrial', 
     '[{"id":"1","address":"Centro, Contagem - MG","lat":-19.9167,"lng":-44.0537,"order":0,"type":"origin"},{"id":"2","address":"Distrito Industrial, Contagem - MG","lat":-19.8900,"lng":-44.1100,"order":1,"type":"destination"}]',
     18.2, '45min', 'active')
ON CONFLICT DO NOTHING;

-- Create a view for truck status summary
CREATE OR REPLACE VIEW truck_status_summary AS
SELECT 
    status,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM trucks 
GROUP BY status;

-- Create a view for maintenance summary
CREATE OR REPLACE VIEW maintenance_summary AS
SELECT 
    t.name as truck_name,
    t.plate,
    COUNT(m.id) as total_maintenances,
    SUM(m.cost) as total_cost,
    MAX(m.completed_date) as last_maintenance,
    MIN(CASE WHEN m.status = 'scheduled' THEN m.scheduled_date END) as next_scheduled
FROM trucks t
LEFT JOIN maintenance m ON t.id = m.truck_id
GROUP BY t.id, t.name, t.plate;

-- Grant permissions (adjust as needed for your setup)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_app_user;

COMMENT ON DATABASE current_database() IS 'AlchemyRotas - Sistema de Gestão de Frotas e Rotas';
