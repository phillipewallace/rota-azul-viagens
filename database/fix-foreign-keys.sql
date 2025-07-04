
-- Script para corrigir problemas de chave estrangeira e implementar cascatas inteligentes
-- Execute este script no seu banco PostgreSQL

-- 1. Primeiro, vamos dropar as constraints existentes que causam problemas
ALTER TABLE IF EXISTS trucks DROP CONSTRAINT IF EXISTS trucks_current_driver_id_fkey;
ALTER TABLE IF EXISTS schedules DROP CONSTRAINT IF EXISTS schedules_truck_id_fkey;
ALTER TABLE IF EXISTS schedules DROP CONSTRAINT IF EXISTS schedules_driver_id_fkey;
ALTER TABLE IF EXISTS schedules DROP CONSTRAINT IF EXISTS schedules_route_id_fkey;
ALTER TABLE IF EXISTS maintenance_records DROP CONSTRAINT IF EXISTS maintenance_records_truck_id_fkey;
ALTER TABLE IF EXISTS trips DROP CONSTRAINT IF EXISTS trips_truck_id_fkey;
ALTER TABLE IF EXISTS trips DROP CONSTRAINT IF EXISTS trips_driver_id_fkey;
ALTER TABLE IF EXISTS route_points DROP CONSTRAINT IF EXISTS route_points_route_id_fkey;

-- 2. Agora vamos recriar as constraints com comportamentos inteligentes

-- Trucks -> Drivers (SET NULL quando motorista é excluído)
ALTER TABLE trucks 
ADD CONSTRAINT trucks_current_driver_id_fkey 
FOREIGN KEY (current_driver_id) 
REFERENCES drivers(id) 
ON DELETE SET NULL 
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

-- Route Points -> Routes (CASCADE - pontos são específicos da rota)
ALTER TABLE route_points 
ADD CONSTRAINT route_points_route_id_fkey 
FOREIGN KEY (route_id) 
REFERENCES routes(id) 
ON DELETE CASCADE 
ON UPDATE CASCADE;

-- 3. Criar índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_trucks_current_driver_id ON trucks(current_driver_id);
CREATE INDEX IF NOT EXISTS idx_schedules_truck_id ON schedules(truck_id);
CREATE INDEX IF NOT EXISTS idx_schedules_driver_id ON schedules(driver_id);
CREATE INDEX IF NOT EXISTS idx_schedules_route_id ON schedules(route_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_truck_id ON maintenance_records(truck_id);
CREATE INDEX IF NOT EXISTS idx_trips_truck_id ON trips(truck_id);
CREATE INDEX IF NOT EXISTS idx_trips_driver_id ON trips(driver_id);
CREATE INDEX IF NOT EXISTS idx_route_points_route_id ON route_points(route_id);

-- 4. Criar função para verificar dependências antes de exclusão
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

COMMENT ON FUNCTION check_deletion_dependencies IS 'Verifica dependências antes de excluir registros';
