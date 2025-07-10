import { Router } from 'express';
import { pool } from '../config/database';
import { googleMapsOptimizer } from '../services/googleMapsOptimizer';
import { logger } from '../utils/logger';

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

// CORRIGIDO: Preservação inteligente por ID de pontos concluídos
async function handleIntelligentRouteUpdate(client: any, routeId: string, newPoints: any[]) {
  try {
    logger.info(`Preservação inteligente iniciada para rota ${routeId}`);
    
    // Buscar pontos atuais com status de conclusão
    const currentPointsResult = await client.query(
      'SELECT * FROM route_points WHERE route_id = $1 ORDER BY point_order',
      [routeId]
    );

    const currentPoints = currentPointsResult.rows;
    const completedPoints = currentPoints.filter(p => p.completed === true);
    
    logger.debug(`${completedPoints.length} pontos concluídos de ${currentPoints.length} total`);
    
    if (completedPoints.length === 0) {
      logger.info('Nenhum ponto concluído - substituindo todos');
      
      await client.query('DELETE FROM route_points WHERE route_id = $1', [routeId]);
      
      for (const point of newPoints) {
        await client.query(
          `INSERT INTO route_points (route_id, address, lat, lng, point_order, type, completed, completed_at)
           VALUES ($1, $2, $3, $4, $5, $6, false, NULL)`,
          [routeId, point.address, point.lat, point.lng, point.order, point.type || 'waypoint']
        );
      }
      
      return;
    }
    
    // CORRIGIDO: Preservar pontos concluídos por coordenadas exatas
    const preservedCompleted = [];
    const newPointsToAdd = [];
    
    // Identificar quais novos pontos correspondem aos concluídos
    for (const completedPoint of completedPoints) {
      const matchingNewPoint = newPoints.find(np => 
        Math.abs(parseFloat(np.lat) - parseFloat(completedPoint.lat)) < 0.0001 &&
        Math.abs(parseFloat(np.lng) - parseFloat(completedPoint.lng)) < 0.0001
      );
      
      if (matchingNewPoint) {
        preservedCompleted.push({
          ...completedPoint,
          newOrder: matchingNewPoint.order
        });
      }
    }
    
    // Pontos novos que não existiam antes
    for (const newPoint of newPoints) {
      const existsInCompleted = preservedCompleted.some(pc => 
        Math.abs(parseFloat(newPoint.lat) - parseFloat(pc.lat)) < 0.0001 &&
        Math.abs(parseFloat(newPoint.lng) - parseFloat(pc.lng)) < 0.0001
      );
      
      if (!existsInCompleted) {
        newPointsToAdd.push(newPoint);
      }
    }
    
    logger.debug(`Preservando ${preservedCompleted.length} pontos, adicionando ${newPointsToAdd.length} novos`);
    
    if (newPointsToAdd.length > 0 && preservedCompleted.length > 0) {
      try {
        // Preparar para otimização parcial
        const completedForOptimization = preservedCompleted.map(p => ({
          id: p.id,
          address: p.address,
          lat: parseFloat(p.lat),
          lng: parseFloat(p.lng),
          order: p.newOrder,
          type: p.type,
          completed: true
        }));
        
        const remainingForOptimization = newPointsToAdd.map(p => ({
          id: `new-${p.order}`,
          address: p.address,
          lat: parseFloat(p.lat),
          lng: parseFloat(p.lng),
          order: p.order,
          type: p.type || 'waypoint'
        }));
        
        logger.debug('Iniciando otimização parcial');
        
        const optimizedResult = await googleMapsOptimizer.optimizePartialRoute(
          completedForOptimization,
          remainingForOptimization
        );
        
        // Remover todos os pontos antigos
        await client.query('DELETE FROM route_points WHERE route_id = $1', [routeId]);
        
        // Inserir pontos otimizados preservando status completed
        for (const point of optimizedResult.optimizedPoints) {
          const isCompleted = point.completed === true;
          const completedAt = isCompleted ? 
            (preservedCompleted.find(p => p.id === point.id)?.completed_at || null) : 
            null;
          
          await client.query(
            `INSERT INTO route_points (route_id, address, lat, lng, point_order, type, completed, completed_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [routeId, point.address, point.lat, point.lng, point.order, point.type, isCompleted, completedAt]
          );
        }
        
        logger.info(`Preservação inteligente concluída: ${preservedCompleted.length} preservados, ${newPointsToAdd.length} otimizados`);
        
      } catch (optimizationError) {
        logger.warn('Erro na otimização parcial, usando fallback:', optimizationError);
        
        // Fallback: preservar concluídos e adicionar novos sem otimizar
        await client.query('DELETE FROM route_points WHERE route_id = $1', [routeId]);
        
        // Inserir preservados primeiro
        for (const preserved of preservedCompleted) {
          await client.query(
            `INSERT INTO route_points (route_id, address, lat, lng, point_order, type, completed, completed_at)
             VALUES ($1, $2, $3, $4, $5, $6, true, $7)`,
            [routeId, preserved.address, preserved.lat, preserved.lng, preserved.newOrder, preserved.type, preserved.completed_at]
          );
        }
        
        // Inserir novos pontos
        for (const newPoint of newPointsToAdd) {
          await client.query(
            `INSERT INTO route_points (route_id, address, lat, lng, point_order, type, completed, completed_at)
             VALUES ($1, $2, $3, $4, $5, $6, false, NULL)`,
            [routeId, newPoint.address, newPoint.lat, newPoint.lng, newPoint.order, newPoint.type || 'waypoint']
          );
        }
      }
    } else {
      // Apenas pontos já concluídos ou apenas novos pontos
      await client.query('DELETE FROM route_points WHERE route_id = $1', [routeId]);
      
      for (const point of newPoints) {
        const isCompleted = preservedCompleted.some(p => 
          Math.abs(parseFloat(point.lat) - parseFloat(p.lat)) < 0.0001 &&
          Math.abs(parseFloat(point.lng) - parseFloat(p.lng)) < 0.0001
        );
        
        const completedAt = isCompleted ? 
          preservedCompleted.find(p => 
            Math.abs(parseFloat(point.lat) - parseFloat(p.lat)) < 0.0001 &&
            Math.abs(parseFloat(point.lng) - parseFloat(p.lng)) < 0.0001
          )?.completed_at : null;
        
        await client.query(
          `INSERT INTO route_points (route_id, address, lat, lng, point_order, type, completed, completed_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [routeId, point.address, point.lat, point.lng, point.order, point.type || 'waypoint', isCompleted, completedAt]
        );
      }
    }
    
    // Atualizar timestamp da rota
    await client.query(
      'UPDATE routes SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [routeId]
    );
    
    logger.info('Preservação inteligente concluída com sucesso');
    
  } catch (error) {
    logger.error('Erro na preservação inteligente:', error);
    throw error;
  }
}

router.put('/:id', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const { name, description, points, totalDistance, estimatedTime, estimatedDuration, optimizedOrder, polyline, status } = req.body;
    
    console.log(`🔄 [ROUTES] Atualizando rota ${id} com ${points?.length || 0} pontos`);
    
    // Verificar se a rota está sendo usada por algum caminhão
    const trucksUsingRoute = await client.query(
      'SELECT id, name FROM trucks WHERE current_route_id = $1',
      [id]
    );
    
    if (trucksUsingRoute.rows.length > 0) {
      console.log(`📍 [ROUTES] Rota em uso por ${trucksUsingRoute.rows.length} caminhão(ões) - aplicando preservação inteligente`);
      
      // Aplicar preservação inteligente
      await handleIntelligentRouteUpdate(client, id, points);
    } else {
      console.log(`🔄 [ROUTES] Rota não está em uso - atualizando normalmente`);
      
      // Rota não está em uso, pode atualizar normalmente
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
    
    console.log(`✅ [ROUTES] Rota atualizada com preservação inteligente`);
    res.json(responseRoute);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ [ROUTES] Error updating route:', error);
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
    
    console.log('✅ Route deleted:', result.rows[0].name);
    res.json({ message: 'Rota excluída com sucesso' });
  } catch (error) {
    console.error('❌ Error deleting route:', error);
    res.status(500).json({ error: 'Erro ao excluir rota' });
  }
});

router.post('/:id/reset', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    
    console.log(`🔄 [ROUTES] Resetando rota ${id} manualmente`);
    
    // Resetar todos os pontos da rota
    const resetResult = await client.query(
      'UPDATE route_points SET completed = false, completed_at = NULL WHERE route_id = $1 RETURNING COUNT(*)',
      [id]
    );
    
    // Atualizar timestamp da rota
    await client.query(
      'UPDATE routes SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    );
    
    await client.query('COMMIT');
    
    console.log(`✅ [ROUTES] Rota ${id} resetada com sucesso`);
    res.json({ 
      message: 'Rota resetada com sucesso',
      pointsReset: resetResult.rowCount || 0
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ [ROUTES] Erro ao resetar rota:', error);
    res.status(500).json({ error: 'Erro ao resetar rota' });
  } finally {
    client.release();
  }
});

// CORRIGIDO: Otimização com Routes API v2 completa
router.post('/:id/optimize', async (req, res) => {
  try {
    const { id } = req.params;
    
    logger.info(`Iniciando otimização Routes API v2 da rota ${id}`);
    
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

    // Usar Routes API v2 completa
    const optimized = await googleMapsOptimizer.optimizeRouteWithGoogleAPIs(points);
    
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
      
      logger.info(`Rota ${id} otimizada com Routes API v2 - ${optimized.optimizedPoints.length} pontos`);
      res.json({ 
        message: 'Rota otimizada com sucesso usando Routes API v2',
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
    logger.error('Erro na otimização Routes API v2:', error);
    res.status(500).json({ error: 'Erro ao otimizar rota com Routes API v2' });
  }
});

export default router;
