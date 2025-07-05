
-- AlchemyRotas - Complete Database Schema
-- Execute this file to create all necessary tables and relationships

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Drop existing tables if they exist (in correct order due to foreign key constraints)
DROP TABLE IF EXISTS route_points CASCADE;
DROP TABLE IF EXISTS route_assignments CASCADE;
DROP TABLE IF EXISTS schedule_assignments CASCADE;
DROP TABLE IF EXISTS schedules CASCADE;
DROP TABLE IF EXISTS maintenance_records CASCADE;
DROP TABLE IF EXISTS trips CASCADE;
DROP TABLE IF EXISTS truck_routes CASCADE;
DROP TABLE IF EXISTS truck_location_history CASCADE;
DROP TABLE IF EXISTS routes CASCADE;
DROP TABLE IF EXISTS trucks CASCADE;
DROP TABLE IF EXISTS drivers CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users table for authentication
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100),
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'manager', 'user')),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Drivers table
CREATE TABLE drivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- Routes table
CREATE TABLE routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- Route points table (for detailed route management)
CREATE TABLE route_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- Trucks table
CREATE TABLE trucks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    plate VARCHAR(10) UNIQUE NOT NULL,
    model VARCHAR(100) NOT NULL,
    year INTEGER NOT NULL,
    capacity_kg DECIMAL(10,2) DEFAULT 0,
    fuel_type VARCHAR(20) DEFAULT 'Diesel',
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'in-route', 'maintenance', 'inactive')),
    current_route_id UUID REFERENCES routes(id),
    current_route VARCHAR(255),
    driver_id UUID REFERENCES drivers(id),
    driver VARCHAR(255),
    current_driver_id UUID REFERENCES drivers(id),
    location_lat DECIMAL(10,8),
    location_lng DECIMAL(11,8),
    last_maintenance DATE,
    next_maintenance DATE,
    mileage INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Schedules table
CREATE TABLE schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100),
    truck_id UUID REFERENCES trucks(id) ON DELETE CASCADE,
    route_id UUID REFERENCES routes(id),
    route_name VARCHAR(255),
    driver_id UUID REFERENCES drivers(id),
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

-- Schedule assignments table
CREATE TABLE schedule_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
    truck_id UUID NOT NULL REFERENCES trucks(id),
    driver_id UUID NOT NULL REFERENCES drivers(id),
    assigned_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in-progress', 'completed', 'cancelled')),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Route assignments table (for manual assignments)
CREATE TABLE route_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id UUID NOT NULL REFERENCES routes(id),
    truck_id UUID NOT NULL REFERENCES trucks(id),
    driver_id UUID NOT NULL REFERENCES drivers(id),
    assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(20) DEFAULT 'assigned' CHECK (status IN ('assigned', 'in-progress', 'completed', 'cancelled')),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Truck routes relationship table
CREATE TABLE truck_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    truck_id UUID REFERENCES trucks(id) ON DELETE CASCADE,
    route_id UUID REFERENCES routes(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    current_point_id VARCHAR(50),
    UNIQUE(truck_id, route_id)
);

-- Truck location history
CREATE TABLE truck_location_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    truck_id UUID REFERENCES trucks(id) ON DELETE CASCADE,
    lat DECIMAL(10,8) NOT NULL,
    lng DECIMAL(11,8) NOT NULL,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    speed DECIMAL(5,2),
    heading DECIMAL(5,2)
);

-- Maintenance records table
CREATE TABLE maintenance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    truck_id UUID NOT NULL REFERENCES trucks(id),
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

-- Trips table for tracking completed routes
CREATE TABLE trips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    truck_id UUID REFERENCES trucks(id),
    route_id UUID REFERENCES routes(id),
    driver_id UUID REFERENCES drivers(id),
    distance_km DECIMAL(10,2) DEFAULT 0,
    duration_minutes INTEGER,
    status VARCHAR(20) DEFAULT 'in_progress' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- System settings table
CREATE TABLE system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    setting_type VARCHAR(50) DEFAULT 'string',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reports table
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_type VARCHAR(50) NOT NULL,
    start_date DATE,
    end_date DATE,
    parameters JSONB,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    file_path TEXT
);

-- Create indexes for better performance
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_active ON users(active);
CREATE INDEX idx_drivers_license ON drivers(license_number);
CREATE INDEX idx_drivers_status ON drivers(status);
CREATE INDEX idx_routes_status ON routes(status);
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
CREATE INDEX idx_trips_truck_id ON trips(truck_id);
CREATE INDEX idx_trips_route_id ON trips(route_id);
CREATE INDEX idx_trips_status ON trips(status);

-- Create trigger to update updated_at timestamp
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

-- Insert sample data

-- Insert admin user (plain text password as requested)
INSERT INTO users (username, password, name, email, role) VALUES 
('phillipe.sodre', '@Wallace44', 'Phillipe Sodré', 'phillipe.sodre@alchemyrotas.com', 'admin');
('micban','@Mic1974','Micban','mic.ban@alchemyrotas.com','admin');


-- Insert default system settings
INSERT INTO system_settings (setting_key, setting_value, setting_type) 
VALUES 
    ('theme', 'light', 'string'),
    ('company_name', 'AlchemyRotas', 'string'),
    ('default_map_zoom', '12', 'number');



COMMIT;
