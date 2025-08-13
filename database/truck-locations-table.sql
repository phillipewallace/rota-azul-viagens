
-- Criar tabela para armazenar histórico de localizações GPS dos caminhões
CREATE TABLE IF NOT EXISTS truck_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    truck_id UUID NOT NULL REFERENCES trucks(id) ON DELETE CASCADE,
    driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
    route_id UUID REFERENCES routes(id) ON DELETE SET NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    accuracy DECIMAL(8, 2), -- Precisão em metros
    speed DECIMAL(8, 2), -- Velocidade em m/s
    heading DECIMAL(6, 2), -- Direção em graus (0-360)
    altitude DECIMAL(8, 2), -- Altitude em metros
    timestamp TIMESTAMPTZ, -- Timestamp do GPS
    device_info JSONB, -- Informações do dispositivo
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_truck_locations_truck_id ON truck_locations(truck_id);
CREATE INDEX IF NOT EXISTS idx_truck_locations_driver_id ON truck_locations(driver_id);
CREATE INDEX IF NOT EXISTS idx_truck_locations_route_id ON truck_locations(route_id);
CREATE INDEX IF NOT EXISTS idx_truck_locations_created_at ON truck_locations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_truck_locations_timestamp ON truck_locations(timestamp DESC);

-- Índice composto para consultas por caminhão e data
CREATE INDEX IF NOT EXISTS idx_truck_locations_truck_date ON truck_locations(truck_id, created_at DESC);

-- Adicionar colunas de localização na tabela trucks se não existirem
ALTER TABLE trucks 
ADD COLUMN IF NOT EXISTS location_lat DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS location_lng DECIMAL(11, 8);

-- Índice para localização atual dos caminhões
CREATE INDEX IF NOT EXISTS idx_trucks_location ON trucks(location_lat, location_lng) WHERE location_lat IS NOT NULL AND location_lng IS NOT NULL;

-- Comentários para documentação
COMMENT ON TABLE truck_locations IS 'Histórico de localizações GPS dos caminhões em tempo real';
COMMENT ON COLUMN truck_locations.accuracy IS 'Precisão do GPS em metros';
COMMENT ON COLUMN truck_locations.speed IS 'Velocidade do veículo em metros por segundo';
COMMENT ON COLUMN truck_locations.heading IS 'Direção do movimento em graus (0-360)';
COMMENT ON COLUMN truck_locations.altitude IS 'Altitude em metros';
COMMENT ON COLUMN truck_locations.timestamp IS 'Timestamp original do GPS';
COMMENT ON COLUMN truck_locations.device_info IS 'Informações do dispositivo móvel (JSON)';

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_truck_locations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_truck_locations_updated_at
    BEFORE UPDATE ON truck_locations
    FOR EACH ROW
    EXECUTE FUNCTION update_truck_locations_updated_at();
