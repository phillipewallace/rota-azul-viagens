
-- Remover o trigger problemático que causa stack overflow
DROP TRIGGER IF EXISTS trigger_maintain_point_order ON route_points;
DROP FUNCTION IF EXISTS maintain_point_order();

-- Criar uma função mais segura para reordenar pontos apenas quando necessário
CREATE OR REPLACE FUNCTION reorder_route_points(p_route_id UUID)
RETURNS INTEGER AS $$
DECLARE
    points_updated INTEGER := 0;
BEGIN
    -- Reordenar pontos de uma rota específica de forma segura
    WITH ordered_points AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY point_order, created_at) - 1 as new_order
        FROM route_points 
        WHERE route_id = p_route_id
    )
    UPDATE route_points rp
    SET point_order = op.new_order
    FROM ordered_points op
    WHERE rp.id = op.id 
    AND rp.point_order != op.new_order; -- Só atualiza se realmente mudou
    
    GET DIAGNOSTICS points_updated = ROW_COUNT;
    
    RETURN points_updated;
END;
$$ LANGUAGE plpgsql;

-- Criar função para limpar pontos órfãos ou duplicados
CREATE OR REPLACE FUNCTION cleanup_route_points(p_route_id UUID DEFAULT NULL)
RETURNS JSON AS $$
DECLARE
    orphaned_count INTEGER := 0;
    duplicate_count INTEGER := 0;
    result JSON;
BEGIN
    -- Remover pontos órfãos (sem rota válida)
    DELETE FROM route_points 
    WHERE route_id NOT IN (SELECT id FROM routes)
    AND (p_route_id IS NULL OR route_id = p_route_id);
    
    GET DIAGNOSTICS orphaned_count = ROW_COUNT;
    
    -- Remover duplicatas baseadas em lat/lng muito próximas na mesma rota
    WITH duplicates AS (
        SELECT rp1.id
        FROM route_points rp1
        JOIN route_points rp2 ON rp1.route_id = rp2.route_id 
        WHERE rp1.id > rp2.id 
        AND ABS(rp1.lat - rp2.lat) < 0.0001 
        AND ABS(rp1.lng - rp2.lng) < 0.0001
        AND (p_route_id IS NULL OR rp1.route_id = p_route_id)
    )
    DELETE FROM route_points 
    WHERE id IN (SELECT id FROM duplicates);
    
    GET DIAGNOSTICS duplicate_count = ROW_COUNT;
    
    result := json_build_object(
        'orphaned_removed', orphaned_count,
        'duplicates_removed', duplicate_count
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Comentário sobre uso das funções:
-- Para reordenar pontos: SELECT reorder_route_points('route_id_here');
-- Para limpeza: SELECT cleanup_route_points('route_id_here'); ou SELECT cleanup_route_points(); para todas
