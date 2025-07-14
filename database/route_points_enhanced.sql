
-- Aprimorar tabela route_points para suportar lógica inteligente
ALTER TABLE route_points 
ADD COLUMN IF NOT EXISTS completed_by UUID REFERENCES trucks(id),
ADD COLUMN IF NOT EXISTS completion_notes TEXT,
ADD COLUMN IF NOT EXISTS batch_order INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_optimized BOOLEAN DEFAULT FALSE;

-- Criar índices para performance em rotas extensas
CREATE INDEX IF NOT EXISTS idx_route_points_completed_status ON route_points(route_id, completed, point_order);
CREATE INDEX IF NOT EXISTS idx_route_points_batch ON route_points(route_id, batch_order, point_order);
CREATE INDEX IF NOT EXISTS idx_route_points_optimization ON route_points(route_id, is_optimized, completed);

-- Atualizar pontos existentes
UPDATE route_points SET is_optimized = FALSE WHERE is_optimized IS NULL;

-- Função para otimização em lotes (rotas +25 pontos)
CREATE OR REPLACE FUNCTION optimize_route_in_batches(
    p_route_id UUID,
    p_batch_size INTEGER DEFAULT 25
) RETURNS JSON AS $$
DECLARE
    batch_count INTEGER;
    total_points INTEGER;
    result JSON;
BEGIN
    -- Contar pontos total
    SELECT COUNT(*) INTO total_points 
    FROM route_points 
    WHERE route_id = p_route_id AND completed = FALSE;
    
    -- Calcular número de lotes
    batch_count := CEIL(total_points::FLOAT / p_batch_size);
    
    -- Marcar lotes para otimização
    WITH numbered_points AS (
        SELECT id, 
               ROW_NUMBER() OVER (ORDER BY point_order) as rn
        FROM route_points 
        WHERE route_id = p_route_id AND completed = FALSE
    )
    UPDATE route_points rp
    SET batch_order = CEIL(np.rn::FLOAT / p_batch_size)
    FROM numbered_points np
    WHERE rp.id = np.id;
    
    result := json_build_object(
        'total_points', total_points,
        'batch_count', batch_count,
        'batch_size', p_batch_size
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Trigger para manter ordem após inserções
CREATE OR REPLACE FUNCTION maintain_point_order()
RETURNS TRIGGER AS $$
BEGIN
    -- Reordenar pontos após inserção/atualização
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        UPDATE route_points 
        SET point_order = subq.new_order
        FROM (
            SELECT id, ROW_NUMBER() OVER (ORDER BY point_order, created_at) - 1 as new_order
            FROM route_points 
            WHERE route_id = NEW.route_id
        ) subq
        WHERE route_points.id = subq.id AND route_points.route_id = NEW.route_id;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_maintain_point_order
    AFTER INSERT OR UPDATE ON route_points
    FOR EACH ROW EXECUTE FUNCTION maintain_point_order();
