
-- Tabela para vincular caminhões às rotas
CREATE TABLE IF NOT EXISTS truck_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    truck_id UUID REFERENCES trucks(id) ON DELETE CASCADE,
    route_id UUID REFERENCES routes(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active',
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    current_point_id VARCHAR(50),
    UNIQUE(truck_id, route_id)
);

-- Tabela para histórico de localização dos caminhões
CREATE TABLE IF NOT EXISTS truck_location_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    truck_id UUID REFERENCES trucks(id) ON DELETE CASCADE,
    lat DECIMAL(10, 8) NOT NULL,
    lng DECIMAL(11, 8) NOT NULL,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    speed DECIMAL(5, 2),
    heading DECIMAL(5, 2)
);

-- Tabela para controle de progresso de rotas
CREATE TABLE IF NOT EXISTS route_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    truck_route_id UUID REFERENCES truck_routes(id) ON DELETE CASCADE,
    point_id VARCHAR(50) NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP,
    lat DECIMAL(10, 8),
    lng DECIMAL(11, 8),
    notes TEXT
);

-- Adicionar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_truck_routes_truck_id ON truck_routes(truck_id);
CREATE INDEX IF NOT EXISTS idx_truck_routes_route_id ON truck_routes(route_id);
CREATE INDEX IF NOT EXISTS idx_truck_location_history_truck_id ON truck_location_history(truck_id);
CREATE INDEX IF NOT EXISTS idx_truck_location_history_recorded_at ON truck_location_history(recorded_at);
CREATE INDEX IF NOT EXISTS idx_route_progress_truck_route_id ON route_progress(truck_route_id);

-- Atualizar tabela de caminhões para ter referência à rota ativa
ALTER TABLE trucks ADD COLUMN IF NOT EXISTS active_route_id UUID REFERENCES routes(id);
ALTER TABLE trucks ADD COLUMN IF NOT EXISTS route_started_at TIMESTAMP;

-- Inserir dados de exemplo se necessário
INSERT INTO truck_routes (truck_id, route_id, status) 
SELECT t.id, r.id, 'assigned'
FROM trucks t, routes r 
WHERE t.plate = 'ABC-1234' AND r.name LIKE '%SP-RJ%'
ON CONFLICT DO NOTHING;
