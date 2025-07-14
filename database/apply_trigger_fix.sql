
-- Aplicar correção definitiva do trigger que causa stack overflow
-- Este arquivo deve ser executado no banco de dados

-- 1. Remover o trigger problemático
DROP TRIGGER IF EXISTS trigger_maintain_point_order ON route_points;
DROP FUNCTION IF EXISTS maintain_point_order();

-- 2. Limpar triggers duplicados se existirem
DO $$
DECLARE
    trigger_rec RECORD;
BEGIN
    FOR trigger_rec IN 
        SELECT tgname FROM pg_trigger 
        WHERE tgrelid = 'route_points'::regclass 
        AND tgname LIKE '%maintain_point_order%'
    LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || trigger_rec.tgname || ' ON route_points';
    END LOOP;
END $$;

-- 3. Criar função segura para reordenação manual
CREATE OR REPLACE FUNCTION safe_reorder_route_points(p_route_id UUID)
RETURNS INTEGER AS $$
DECLARE
    points_updated INTEGER := 0;
BEGIN
    -- Reordenar pontos apenas quando explicitamente chamado
    WITH ordered_points AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY point_order, created_at) - 1 as new_order
        FROM route_points 
        WHERE route_id = p_route_id
    )
    UPDATE route_points rp
    SET point_order = op.new_order
    FROM ordered_points op
    WHERE rp.id = op.id 
    AND rp.point_order != op.new_order;
    
    GET DIAGNOSTICS points_updated = ROW_COUNT;
    
    RETURN points_updated;
END;
$$ LANGUAGE plpgsql;

-- 4. Comentário importante
-- NUNCA mais criar triggers automáticos na tabela route_points
-- Use apenas a função safe_reorder_route_points quando necessário
