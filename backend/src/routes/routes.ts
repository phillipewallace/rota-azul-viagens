
import { Router } from 'express';
import { pool } from '../config/database';
import { googleMapsOptimizer } from '../services/googleMapsOptimizer';

const router = Router();

// Get all routes
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT 
        r.id,
        r.name,
        r.description,
        r.points,
        r.total_distance,
        r.estimated_time,
        r.estimated_duration,
        r.optimized_order,
        r.polyline,
        r.status,
        r.created_at,
        COUNT(rp.id) as point_count
      FROM routes r
      LEFT JOIN route_points rp ON r.id = rp.route_id
      GROUP BY r.id, r.name, r.description, r.points, r.total_distance, r.estimated_time, r.estimated_duration, r.optimized_order, r.polyline, r.status, r.created_at
      ORDER BY r.created_at DESC
    `;
    
    const result = await pool.query(query);
    
    const routes = result.rows.map(route => ({
      id: route.id,
      name: route.name,
      description: route.description,
      points: route.points || [],
      totalDistance: parseFloat(route.total_distance) || 0,
      estimatedTime: route.estimated_time,
      estimatedDuration: parseInt(route.estimated_duration) || 0,
      optimizedOrder: route.optimized_order || [],
      polyline: route.polyline,
      status: route.status,
      createdAt: route.created_at,
      pointCount: parseInt(route.point_count) || 0
    }));

    res.json(routes);
  } catch (error) {
    console.error('❌ [ROUTES] Error fetching routes:', error);
    res.status(500).json({ error: 'Erro ao buscar rotas' });
  }
});

// Get single route by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const routeQuery = `SELECT * FROM routes WHERE id = $1`;
    const pointsQuery = `SELECT * FROM route_points WHERE route_id = $1 ORDER BY point_order`;
    
    const [routeResult, pointsResult] = await Promise.all([
      pool.query(routeQuery, [id]),
      pool.query(pointsQuery, [id])
    ]);
    
    if (routeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Rota não encontrada' });
    }
    
    const route = {
      ...routeResult.rows[0],
      totalDistance: parseFloat(routeResult.rows[0].total_distance) || 0,
      estimatedDuration: parseInt(routeResult.rows[0].estimated_duration) || 0,
      routePoints: pointsResult.rows
    };
    
    res.json(route);
  } catch (error) {
    console.error('❌ [ROUTES] Error fetching route:', error);
    res.status(500).json({ error: 'Erro ao buscar rota' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, description, points, totalDistance, estimatedTime, estimatedDuration, optimizedOrder, polyline } = req.body;
    
    const query = `
      INSERT INTO routes (name, description, points, total_distance, estimated_time, estimated_duration, optimized_order, polyline)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    
    const result = await pool.query(query, [
      name,
      description,
      JSON.stringify(points || []),
      parseFloat(totalDistance) || 0,
      estimatedTime,
      parseInt(estimatedDuration) || 0,
      JSON.stringify(optimizedOrder || []),
      polyline
    ]);
    
    // Insert route points if provided
    if (points && points.length > 0) {
      for (const point of points) {
        await pool.query(
          `INSERT INTO route_points (route_id, address, lat, lng, point_order, type)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [result.rows[0].id, point.address, point.lat, point.lng, point.order, point.type || 'waypoint']
        );
      }
    }
    
    const responseRoute = {
      ...result.rows[0],
      totalDistance: parseFloat(result.rows[0].total_distance) || 0,
      estimatedDuration: parseInt(result.rows[0].estimated_duration) || 0
    };
    
    res.status(201).json(responseRoute);
  } catch (error) {
    console.error('❌ [ROUTES] Error creating route:', error);
    res.status(500).json({ error: 'Erro ao criar rota' });
  }
});

// CORRIGIDO: Função para preservar pontos concluídos durante atualizações
async function handleIntelligentRouteUpdate(client: any, routeId: string, newPoints: any[]) {
  try {
    console.log(`🧠 [ROUTES INTELLIGENT] Processando preservação para rota ${routeId}`);
    
    // 1. Buscar pontos concluídos
    const completedPointsResult = await client.query(
      'SELECT * FROM route_points WHERE route_id = $1 AND completed = true ORDER BY point_order',
      [routeId]
    );

    const completedPoints = completedPointsResult.rows.map(p => ({
      id: p.id,
      address: p.address,
      lat: parseFloat(p.lat),
      lng: parseFloat(p.lng),
      order: p.point_order,
      type: p.type,
      completed: true,
      completedAt: p.completed_at
    }));

    console.log(`✅ [ROUTES INTELLIGENT] ${completedPoints.length} pontos concluídos encontrados`);
    
    if (completedPoints.length === 0) {
      console.log(`🔄 [ROUTES INTELLIGENT] Nenhum ponto concluído - substituindo completamente`);
      
      await client.query('DELETE FROM route_points WHERE route_id = $1', [routeId]);
      
      for (const point of newPoints) {
        await client.query(
          `INSERT INTO route_points (route_id, address, lat, lng, point_order, type, completed)
           VALUES ($1, $2, $3, $4, $5, $6, false)`,
          [routeId, point.address, point.lat, point.lng, point.order, point.type || 'waypoint']
        );
      }
      
      return;
    }
    
    // 2. FILTRO CORRETO: Separar pontos que ainda não foram concluídos
    const maxCompletedOrder = Math.max(...completedPoints.map(p => p.order));
    const remainingNewPoints = newPoints.filter(p => p.order > maxCompletedOrder);
    
    console.log(`🔍 [ROUTES INTELLIGENT] Preservando ${completedPoints.length} pontos concluídos`);
    console.log(`🔍 [ROUTES INTELLIGENT] ${remainingNewPoints.length} novos pontos para processar`);
    
    if (remainingNewPoints.length > 0) {
      try {
        const optimizedResult = await googleMapsOptimizer.optimizePartialRoute(
          completedPoints,
          remainingNewPoints
        );
        
        console.log(`✅ [ROUTES INTELLIGENT] Otimização parcial concluída`);
        
        // 4. Remover apenas pontos não concluídos
        await client.query(
          'DELETE FROM route_points WHERE route_id = $1 AND (completed = false OR completed IS NULL)',
          [routeId]
        );
        
        // 5. Inserir apenas os novos pontos otimizados
        const pointsToInsert = optimizedResult.optimizedPoints.filter(p => !p.completed);
        
        for (const point of pointsToInsert) {
          await client.query(
            `INSERT INTO route_points (route_id, address, lat, lng, point_order, type, completed)
             VALUES ($1, $2, $3, $4, $5, $6, false)`,
            [routeId, point.address, point.lat, point.lng, point.order, point.type || 'waypoint']
          );
        }
        
        console.log(`✅ [ROUTES INTELLIGENT] ${pointsToInsert.length} novos pontos inseridos`);
        
      } catch (optimizationError) {
        console.error('❌ [ROUTES INTELLIGENT] Erro na otimização:', optimizationError);
        
        // Fallback seguro: preservar concluídos e adicionar novos sem otimizar
        await client.query(
          'DELETE FROM route_points WHERE route_id = $1 AND (completed = false OR completed IS NULL)',
          [routeId]
        );
        
        for (const point of remainingNewPoints) {
          await client.query(
            `INSERT INTO route_points (route_id, address, lat, lng, point_order, type, completed)
             VALUES ($1, $2, $3, $4, $5, $6, false)`,
            [routeId, point.address, point.lat, point.lng, point.order, point.type || 'waypoint']
          );
        }
        
        console.log(`⚠️ [ROUTES INTELLIGENT] Fallback aplicado`);
      }
    }
    
    await client.query(
      'UPDATE routes SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [routeId]
    );
    
    console.log(`✅ [ROUTES INTELLIGENT] Preservação inteligente concluída`);
    
  } catch (error) {
    console.error('❌ [ROUTES INTELLIGENT] Erro na preservação:', error);
    throw error;
  }
}

router.put('/:id', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const { name, description, points, totalDistance, estimatedTime, estimatedDuration, optimizedOrder, polyline, status } = req.body;
    
    console.log(`🔄 [ROUTES UPDATE] Atualizando rota ${id}`);
    
    // Verificar se a rota está sendo usada por algum caminhão
    const trucksUsingRoute = await client.query(
      'SELECT id, name FROM trucks WHERE current_route_id = $1',
      [id]
    );
    
    if (trucksUsingRoute.rows.length > 0) {
      console.log(`📍 [ROUTES UPDATE] Rota em uso - aplicando preservação inteligente`);
      await handleIntelligentRouteUpdate(client, id, points);
    } else {
      console.log(`🔄 [ROUTES UPDATE] Rota não está em uso - atualizando normalmente`);
      
      await client.query('DELETE FROM route_points WHERE route_id = $1', [id]);
      
      if (points && points.length > 0) {
        for (const point of points) {
          await client.query(
            `INSERT INTO route_points (route_id, address, lat, lng, point_order, type)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [id, point.address, point.lat, point.lng, point.order, point.type || 'waypoint']
          );
        }
      }
    }
    
    // Atualizar a rota principal
    const query = `
      UPDATE routes 
      SET name = $1, description = $2, points = $3, total_distance = $4, 
          estimated_time = $5, estimated_duration = $6, optimized_order = $7, 
          polyline = $8, status = $9, updated_at = CURRENT_TIMESTAMP
      WHERE id = $10
      RETURNING *
    `;
    
    const result = await client.query(query, [
      name,
      description,
      JSON.stringify(points || []),
      parseFloat(totalDistance) || 0,
      estimatedTime,
      parseInt(estimatedDuration) || 0,
      JSON.stringify(optimizedOrder || []),
      polyline,
      status || 'active',
      id
    ]);
    
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Rota não encontrada' });
    }
    
    await client.query('COMMIT');
    
    const responseRoute = {
      ...result.rows[0],
      totalDistance: parseFloat(result.rows[0].total_distance) || 0,
      estimatedDuration: parseInt(result.rows[0].estimated_duration) || 0
    };
    
    console.log(`✅ [ROUTES UPDATE] Rota atualizada com sucesso`);
    res.json(responseRoute);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ [ROUTES UPDATE] Error updating route:', error);
    res.status(500).json({ error: 'Erro ao atualizar rota' });
  } finally {
    client.release();
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const scheduleCheck = await pool.query(
      'SELECT COUNT(*) as count FROM schedules WHERE route_id = $1', 
      [id]
    );
    
    if (parseInt(scheduleCheck.rows[0].count) > 0) {
      return res.status(400).json({ 
        error: 'Não é possível excluir esta rota pois ela possui agendamentos vinculados. Remova os agendamentos primeiro.' 
      });
    }
    
    await pool.query('DELETE FROM route_points WHERE route_id = $1', [id]);
    const result = await pool.query('DELETE FROM routes WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Rota não encontrada' });
    }
    
    console.log('✅ [ROUTES] Route deleted:', result.rows[0].name);
    res.json({ message: 'Rota excluída com sucesso' });
  } catch (error) {
    console.error('❌ [ROUTES] Error deleting route:', error);
    res.status(500).json({ error: 'Erro ao excluir rota' });
  }
});

// CORRIGIDO: Endpoint para resetar rota manualmente
router.post('/:id/reset', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    
    console.log(`🔄 [ROUTES RESET] Resetando rota ${id}`);
    
    // Verificar se a rota existe
    const routeCheck = await client.query('SELECT id, name FROM routes WHERE id = $1', [id]);
    
    if (routeCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Rota não encontrada' });
    }
    
    // Resetar todos os pontos da rota
    const resetResult = await client.query(
      'UPDATE route_points SET completed = false, completed_at = NULL WHERE route_id = $1 RETURNING id',
      [id]
    );
    
    // Atualizar timestamp da rota
    await client.query(
      'UPDATE routes SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    );
    
    await client.query('COMMIT');
    
    console.log(`✅ [ROUTES RESET] Rota "${routeCheck.rows[0].name}" resetada - ${resetResult.rows.length} pontos`);
    
    res.json({ 
      message: 'Rota resetada com sucesso',
      routeName: routeCheck.rows[0].name,
      pointsReset: resetResult.rows.length
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ [ROUTES RESET] Erro ao resetar rota:', error);
    res.status(500).json({ error: 'Erro ao resetar rota' });
  } finally {
    client.release();
  }
});

// Endpoint de otimização ATUALIZADO para Routes API v2
router.post('/:id/optimize', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`🚀 [ROUTES OPTIMIZE] Iniciando otimização da rota ${id}`);
    
    // Get route points
    const pointsResult = await pool.query(
      'SELECT * FROM route_points WHERE route_id = $1 ORDER BY point_order',
      [id]
    );
    
    const points = pointsResult.rows.map(p => ({
      id: p.id,
      address: p.address,
      lat: parseFloat(p.lat),
      lng: parseFloat(p.lng),
      order: p.point_order,
      type: p.point_order === 0 ? 'origin' : 
            p.point_order === pointsResult.rows.length - 1 ? 'destination' : 'waypoint',
      completed: p.completed
    }));

    if (points.length < 2) {
      return res.json({ message: 'Rota precisa de pelo menos 2 pontos para otimizar' });
    }

    // Usar Routes API v2 com limite de waypoints
    const optimized = await googleMapsOptimizer.optimizeRouteWithGoogleAPIs(points);
    
    // Update route points with optimized order
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Delete existing points
      await client.query('DELETE FROM route_points WHERE route_id = $1', [id]);
      
      // Insert optimized points
      for (const point of optimized.optimizedPoints) {
        await client.query(
          `INSERT INTO route_points (route_id, address, lat, lng, point_order, type, completed)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [id, point.address, point.lat, point.lng, point.order, point.type, point.completed || false]
        );
      }
      
      // Update route metadata
      await client.query(
        `UPDATE routes SET 
         total_distance = $1, 
         estimated_duration = $2, 
         polyline = $3,
         optimized_order = $4,
         updated_at = CURRENT_TIMESTAMP 
         WHERE id = $5`,
        [
          optimized.totalDistance,
          optimized.totalDuration,
          optimized.polyline,
          JSON.stringify(optimized.optimizedOrder),
          id
        ]
      );
      
      await client.query('COMMIT');
      
      console.log(`✅ [ROUTES OPTIMIZE] Rota ${id} otimizada com sucesso`);
      res.json({ 
        message: 'Rota otimizada com sucesso',
        optimizedPoints: optimized.optimizedPoints.length,
        totalDistance: optimized.totalDistance,
        totalDuration: Math.round(optimized.totalDuration / 60) + ' min',
        newOrder: optimized.optimizedOrder
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('❌ [ROUTES OPTIMIZE] Erro na otimização:', error);
    res.status(500).json({ error: 'Erro ao otimizar rota' });
  }
});

export default router;
