
-- AlchemyRotas - Complete Database Schema with Management Support
-- Execute this file to create all necessary tables and relationships

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drivers table
CREATE TABLE IF NOT EXISTS drivers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    license_number VARCHAR(50) UNIQUE NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255),
    hire_date DATE,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Routes table with updated point structure
CREATE TABLE IF NOT EXISTS routes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    points JSONB,
    total_distance DECIMAL(10, 2),
    estimated_time VARCHAR(50),
    optimized_order JSONB,
    polyline TEXT,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trucks table
CREATE TABLE IF NOT EXISTS trucks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    plate VARCHAR(20) UNIQUE NOT NULL,
    model VARCHAR(255),
    year INTEGER,
    status VARCHAR(20) DEFAULT 'available',
    driver_id UUID REFERENCES drivers(id),
    current_route_id UUID REFERENCES routes(id),
    active_route_id UUID REFERENCES routes(id),
    route_started_at TIMESTAMP,
    last_maintenance DATE,
    mileage INTEGER DEFAULT 0,
    location_lat DECIMAL(10, 8),
    location_lng DECIMAL(11, 8),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Schedules table
CREATE TABLE IF NOT EXISTS schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    truck_id UUID REFERENCES trucks(id) ON DELETE CASCADE,
    route_name VARCHAR(255),
    driver_id UUID REFERENCES drivers(id),
    scheduled_date DATE NOT NULL,
    scheduled_time TIME NOT NULL,
    status VARCHAR(20) DEFAULT 'scheduled',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Truck routes relationship table
CREATE TABLE IF NOT EXISTS truck_routes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    truck_id UUID REFERENCES trucks(id) ON DELETE CASCADE,
    route_id UUID REFERENCES routes(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active',
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    current_point_id VARCHAR(50),
    UNIQUE(truck_id, route_id)
);

-- Truck location history
CREATE TABLE IF NOT EXISTS truck_location_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    truck_id UUID REFERENCES trucks(id) ON DELETE CASCADE,
    lat DECIMAL(10, 8) NOT NULL,
    lng DECIMAL(11, 8) NOT NULL,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    speed DECIMAL(5, 2),
    heading DECIMAL(5, 2)
);

-- Route progress tracking
CREATE TABLE IF NOT EXISTS route_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    truck_route_id UUID REFERENCES truck_routes(id) ON DELETE CASCADE,
    point_id VARCHAR(50) NOT NULL,
    point_type VARCHAR(20) DEFAULT 'entrega',
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP,
    lat DECIMAL(10, 8),
    lng DECIMAL(11, 8),
    notes TEXT
);

-- Invoice files table
CREATE TABLE IF NOT EXISTS invoice_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    schedule_id UUID REFERENCES schedules(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR(100),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- System settings table
CREATE TABLE IF NOT EXISTS system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    setting_type VARCHAR(50) DEFAULT 'string',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reports table
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_type VARCHAR(50) NOT NULL,
    start_date DATE,
    end_date DATE,
    parameters JSONB,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    file_path TEXT
);

-- Trips table for tracking completed routes
CREATE TABLE IF NOT EXISTS trips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    truck_id UUID REFERENCES trucks(id),
    route_id UUID REFERENCES routes(id),
    driver_id UUID REFERENCES drivers(id),
    distance_km DECIMAL(10, 2),
    duration_minutes INTEGER,
    fuel_consumed DECIMAL(8, 2),
    status VARCHAR(20) DEFAULT 'in_progress',
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Maintenance table
CREATE TABLE IF NOT EXISTS maintenance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    truck_id UUID REFERENCES trucks(id),
    maintenance_type VARCHAR(100),
    description TEXT,
    cost DECIMAL(10, 2),
    scheduled_date DATE,
    completed_date DATE,
    status VARCHAR(20) DEFAULT 'scheduled',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Performance metrics table for management reports
CREATE TABLE IF NOT EXISTS performance_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    truck_id UUID REFERENCES trucks(id),
    driver_id UUID REFERENCES drivers(id),
    route_id UUID REFERENCES routes(id),
    date DATE NOT NULL,
    trips_completed INTEGER DEFAULT 0,
    distance_traveled DECIMAL(10, 2) DEFAULT 0,
    fuel_efficiency DECIMAL(5, 2),
    on_time_deliveries INTEGER DEFAULT 0,
    total_deliveries INTEGER DEFAULT 0,
    revenue DECIMAL(12, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Route analytics table
CREATE TABLE IF NOT EXISTS route_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    route_id UUID REFERENCES routes(id),
    date DATE NOT NULL,
    times_used INTEGER DEFAULT 0,
    average_completion_time INTEGER,
    total_distance DECIMAL(10, 2),
    efficiency_score DECIMAL(3, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Monthly summaries for quick reporting
CREATE TABLE IF NOT EXISTS monthly_summaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    total_trips INTEGER DEFAULT 0,
    total_distance DECIMAL(12, 2) DEFAULT 0,
    total_fuel_cost DECIMAL(12, 2) DEFAULT 0,
    total_maintenance_cost DECIMAL(12, 2) DEFAULT 0,
    total_revenue DECIMAL(12, 2) DEFAULT 0,
    active_trucks INTEGER DEFAULT 0,
    active_drivers INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(month, year)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_trucks_status ON trucks(status);
CREATE INDEX IF NOT EXISTS idx_trucks_current_route ON trucks(current_route_id);
CREATE INDEX IF NOT EXISTS idx_trucks_driver ON trucks(driver_id);
CREATE INDEX IF NOT EXISTS idx_schedules_date ON schedules(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_schedules_truck ON schedules(truck_id);
CREATE INDEX IF NOT EXISTS idx_routes_status ON routes(status);
CREATE INDEX IF NOT EXISTS idx_truck_routes_truck_id ON truck_routes(truck_id);
CREATE INDEX IF NOT EXISTS idx_truck_routes_route_id ON truck_routes(route_id);
CREATE INDEX IF NOT EXISTS idx_truck_location_history_truck_id ON truck_location_history(truck_id);
CREATE INDEX IF NOT EXISTS idx_truck_location_history_recorded_at ON truck_location_history(recorded_at);
CREATE INDEX IF NOT EXISTS idx_route_progress_truck_route_id ON route_progress(truck_route_id);
CREATE INDEX IF NOT EXISTS idx_trips_truck_id ON trips(truck_id);
CREATE INDEX IF NOT EXISTS idx_trips_route_id ON trips(route_id);
CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_truck_id ON maintenance(truck_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_status ON maintenance(status);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_date ON performance_metrics(date);
CREATE INDEX IF NOT EXISTS idx_route_analytics_date ON route_analytics(date);
CREATE INDEX IF NOT EXISTS idx_monthly_summaries_year_month ON monthly_summaries(year, month);

-- Insert default system settings
INSERT INTO system_settings (setting_key, setting_value, setting_type) 
VALUES 
    ('theme', 'dark', 'string'),
    ('company_name', 'AlchemyRotas', 'string'),
    ('default_map_zoom', '12', 'number'),
    ('auto_optimize_routes', 'true', 'boolean'),
    ('maintenance_reminder_days', '30', 'number')
ON CONFLICT (setting_key) DO NOTHING;

-- Insert sample data (optional)
INSERT INTO drivers (name, license_number, phone, email) VALUES
('João Silva', 'CNH123456789', '(11) 99999-1111', 'joao@email.com'),
('Maria Santos', 'CNH987654321', '(11) 99999-2222', 'maria@email.com'),
('Pedro Oliveira', 'CNH456789123', '(11) 99999-3333', 'pedro@email.com')
ON CONFLICT (license_number) DO NOTHING;

INSERT INTO trucks (name, plate, model, year, mileage) VALUES
('Caminhão 01', 'ABC-1234', 'Mercedes-Benz Atego', 2020, 45000),
('Caminhão 02', 'DEF-5678', 'Volvo VM', 2019, 62000),
('Caminhão 03', 'GHI-9012', 'Scania R-Series', 2021, 38000)
ON CONFLICT (plate) DO NOTHING;

-- Sample route with point types
INSERT INTO routes (name, description, points, total_distance, estimated_time, status) VALUES
('Rota Centro-Sul', 'Coleta e entrega zona sul', 
'[
  {"id": "1", "address": "Av. Paulista, 1000 - São Paulo", "lat": -23.5610, "lng": -46.6565, "order": 0, "type": "origin", "pointType": "recolhimento", "cep": "01310-100"},
  {"id": "2", "address": "Rua Augusta, 500 - São Paulo", "lat": -23.5505, "lng": -46.6333, "order": 1, "type": "waypoint", "pointType": "entrega", "cep": "01305-000"},
  {"id": "3", "address": "Av. Ibirapuera, 200 - São Paulo", "lat": -23.5955, "lng": -46.6566, "order": 2, "type": "destination", "pointType": "limpeza", "cep": "04029-000"}
]'::jsonb, 
15.5, '2h 30min', 'active')
ON CONFLICT DO NOTHING;
