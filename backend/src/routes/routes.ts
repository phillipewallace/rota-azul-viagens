import { Router } from 'express';
import { pool } from '../config/database';
import { PartialRouteOptimizer } from '../services/partialRouteOptimizer';

const router = Router();

// Função auxiliar para buscar uma rota com seus pontos
async function getRouteWithPoints(routeId: string) {
  const routeQuery = await pool.query('SELECT * FROM routes WHERE id = $1', [routeId]);
  if (routeQuery.rows.length === 0) {
    return null; // Rota não encontrada
  }

  const pointsQuery = await pool.query(
    'SELECT * FROM route_points WHERE route_id = $1 ORDER BY point_order ASC',
    [routeId]
  );

  const route = routeQuery.rows[0];
  const points = pointsQuery.rows.map(point => ({
    id: point.id,
    address: point.address,
    cep: point.cep,
    lat: parseFloat(point.lat),
    lng: parseFloat(point.lng),
    order: point.point_order,
    type: point.type,
    completed: point.completed,
    completedAt: point.completed_at,
  }));

  return {
    id: route.id,
    name: route.name,
    description: route.description,
    points: points,
    totalDistance: route.total_distance,
    estimatedTime: route.estimated_time,
    optimizedOrder: route.optimized_order,
    status: route.status,
    createdAt: route.created_at,
  };
}

// ✅ ENDPOINT DE OTIMIZAÇÃO INTELIGENTE - CRÍTICO
router.post('/:id/optimize-intelligent', async (req, res) => {
  const startTime = Date.now();
  try {
    const { id } = req.params;
    const { points } = req.body;

    console.log(`🧠 [INTELLIGENT OPTIMIZATION] Iniciando para rota ${id}`);
    console.log(`📊 [INTELLIGENT OPTIMIZATION] Pontos recebidos: ${points?.length || 0}`);

    if (!points || points.length < 2) {
      return res.status(400).json({ 
        error: 'É necessário pelo menos 2 pontos para otimização',
        receivedPoints: points?.length || 0 
      });
    }

    // Verificar se a rota existe
    const existingRoute = await getRouteWithPoints(id);
    if (!existingRoute) {
      return res.status(404).json({ error: 'Rota não encontrada' });
    }

    console.log(`✅ [INTELLIGENT OPTIMIZATION] Rota encontrada: "${existingRoute.name}"`);

    // Usar PartialRouteOptimizer para preservar pontos concluídos
    const optimizationResult = await PartialRouteOptimizer.optimizeWithPreservation(points);

    const response = {
      optimizedOrder: optimizationResult.optimizedOrder,
      totalDistance: optimizationResult.totalDistance,
      estimatedTime: `${Math.round(optimizationResult.totalDuration / 60)}min`,
      points: optimizationResult.optimizedPoints,
      preservedPoints: optimizationResult.preservedPoints,
      optimizedPoints: optimizationResult.optimizedPointsCount,
      isExtended: false,
      batchCount: 1,
      polyline: optimizationResult.polyline,
      processingTime: Date.now() - startTime
    };

    console.log(`✅ [INTELLIGENT OPTIMIZATION] Concluído: ${response.totalDistance}km, ${response.processingTime}ms`);
    res.json(response);

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`❌ [INTELLIGENT OPTIMIZATION] Erro:`, error.message);
    
    res.status(500).json({ 
      error: 'Erro na otimização inteligente',
      details: error.message,
      processingTime 
    });
  }
});

// ✅ VERIFICAÇÃO DE ROTAS REGISTRADAS
router.use((req, res, next) => {
  console.log(`📍 [ROUTES] Request interceptado: ${req.method} ${req.path}`);
  next();
});

// Rota para obter todas as rotas
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM routes ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar rotas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para obter uma rota específica por ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const route = await getRouteWithPoints(id);

    if (!route) {
      return res.status(404).json({ error: 'Rota não encontrada' });
    }

    res.json(route);
  } catch (error) {
    console.error('Erro ao buscar rota:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para criar uma nova rota
router.post('/', async (req, res) => {
  try {
    const { name, description, points, totalDistance, estimatedTime, optimizedOrder, status } = req.body;

    console.log('Criando rota:', { name, pointsCount: points?.length });

    // Iniciar transação
    await pool.query('BEGIN');

    try {
      // 1. Inserir dados da rota
      const routeResult = await pool.query(
        `INSERT INTO routes (name, description, total_distance, estimated_time, optimized_order, status) 
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [name, description, totalDistance, estimatedTime, optimizedOrder, status]
      );

      const newRoute = routeResult.rows[0];

      // 2. Inserir pontos da rota
      if (points && points.length > 0) {
        for (let i = 0; i < points.length; i++) {
          const point = points[i];
          await pool.query(
            `INSERT INTO route_points 
             (id, route_id, address, cep, lat, lng, point_order, type, completed, completed_at, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
            [
              point.id || `point-${Date.now()}-${i}`,
              newRoute.id,
              point.address,
              point.cep || '',
              point.lat,
              point.lng,
              i,
              point.type || 'waypoint',
              point.completed || false,
              point.completedAt || null
            ]
          );
        }
      }

      // Commit da transação
      await pool.query('COMMIT');

      // 3. Buscar rota criada com pontos
      const createdRoute = await getRouteWithPoints(newRoute.id);
      res.status(201).json(createdRoute);

    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Erro ao criar rota:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Atualizar rota existente
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, points, totalDistance, estimatedTime, optimizedOrder, status } = req.body;

    console.log(`📝 [ROUTES] Atualizando rota ${id}:`, { name, pointsCount: points?.length });

    // Iniciar transação
    await pool.query('BEGIN');

    try {
      // 1. Atualizar dados da rota
      const routeResult = await pool.query(
        `UPDATE routes 
         SET name = $1, description = $2, total_distance = $3, estimated_time = $4, 
             optimized_order = $5, status = $6, updated_at = NOW()
         WHERE id = $7 RETURNING *`,
        [name, description, totalDistance, estimatedTime, optimizedOrder, status, id]
      );

      if (routeResult.rows.length === 0) {
        await pool.query('ROLLBACK');
        return res.status(404).json({ error: 'Rota não encontrada' });
      }

      // 2. Remover pontos antigos
      await pool.query('DELETE FROM route_points WHERE route_id = $1', [id]);

      // 3. Inserir novos pontos (sem trigger automático)
      if (points && points.length > 0) {
        for (let i = 0; i < points.length; i++) {
          const point = points[i];
          await pool.query(
            `INSERT INTO route_points 
             (id, route_id, address, cep, lat, lng, point_order, type, completed, completed_at, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
            [
              point.id || `point-${Date.now()}-${i}`,
              id,
              point.address,
              point.cep || '',
              point.lat,
              point.lng,
              i,
              point.type || 'waypoint',
              point.completed || false,
              point.completedAt || null
            ]
          );
        }

        // 4. Usar função segura para reordenação (opcional)
        console.log('🔧 [ROUTES] Aplicando reordenação segura...');
        await pool.query('SELECT safe_reorder_route_points($1)', [id]);
      }

      // Commit da transação
      await pool.query('COMMIT');

      // 5. Buscar rota atualizada com pontos
      const updatedRoute = await getRouteWithPoints(id);
      
      console.log(`✅ [ROUTES] Rota ${id} atualizada com sucesso`);
      res.json(updatedRoute);

    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('❌ [ROUTES] Erro ao atualizar rota:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para excluir uma rota
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    console.log('Excluindo rota:', id);

    await pool.query('BEGIN');

    try {
      // 1. Excluir pontos da rota
      await pool.query('DELETE FROM route_points WHERE route_id = $1', [id]);

      // 2. Excluir a rota
      const result = await pool.query('DELETE FROM routes WHERE id = $1 RETURNING *', [id]);

      await pool.query('COMMIT');

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Rota não encontrada' });
      }

      res.json({ message: 'Rota excluída com sucesso' });

    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Erro ao excluir rota:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para verificar se uma rota está em uso
router.get('/:id/check-usage', async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar se a rota está associada a algum caminhão ativo
    const result = await pool.query(
      `SELECT EXISTS (
        SELECT 1
        FROM trucks
        WHERE route_id = $1 AND status = 'active'
      )`,
      [id]
    );

    const inUse = result.rows[0].exists;
    res.json({ inUse });

  } catch (error) {
    console.error('Erro ao verificar uso da rota:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para resetar uma rota (remover completedBy e completionNotes)
router.post('/:id/reset', async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`🔄 [ROUTES] Resetando rota ${id}`);

    // Iniciar transação
    await pool.query('BEGIN');

    try {
      // 1. Resetar campos específicos na tabela route_points
      const resetPointsResult = await pool.query(
        `UPDATE route_points
         SET completed_by = NULL, completion_notes = NULL, completed = FALSE, completed_at = NULL
         WHERE route_id = $1
         RETURNING *`,
        [id]
      );

      // 2. Commit da transação
      await pool.query('COMMIT');

      console.log(`✅ [ROUTES] Rota ${id} resetada com sucesso. ${resetPointsResult.rowCount} pontos afetados.`);
      res.json({ message: 'Rota resetada com sucesso', pointsAffected: resetPointsResult.rowCount });

    } catch (error) {
      await pool.query('ROLLBACK');
      console.error(`❌ [ROUTES] Erro durante o reset da rota ${id}:`, error);
      return res.status(500).json({ error: 'Erro ao resetar a rota' });
    }

  } catch (error) {
    console.error('Erro ao resetar rota:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;
