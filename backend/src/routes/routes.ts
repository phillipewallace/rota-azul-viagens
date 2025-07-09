import { Router } from 'express';
import { pool } from '../config/database';
import { googleMapsOptimizer } from '../services/googleMapsOptimizer';

const router = Router();

// Get all routes
router.get('/', async (req, res) => {
  try {
    console.log('🛣️ [ROUTES V2] Fetching all routes...');
    
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

    console.log(`✅ [ROUTES V2] Found ${routes.length} routes`);
    res.json(routes);
  } catch (error) {
    console.error('❌ [ROUTES V2] Error fetching routes:', error);
    res.status(500).json({ error: 'Erro ao buscar rotas' });
  }
});

// Get single route by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`🔍 [ROUTES V2] Fetching route ${id}`);
    
    const routeQuery = `
      SELECT * FROM routes WHERE id = $1
    `;
    
    const pointsQuery = `
      SELECT * FROM route_points WHERE route_id = $1 ORDER BY point_order
    `;
    
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
    
    console.log(`✅ [ROUTES V2] Route ${id} found with ${pointsResult.rows.length} points`);
    res.json(route);
  } catch (error) {
    console.error('❌ [ROUTES V2] Error fetching route:', error);
    res.status(500).json({ error: 'Erro ao buscar rota' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, description, points, totalDistance, estimatedTime, estimatedDuration, optimizedOrder, polyline } = req.body;
    
    console.log(`🆕 [ROUTES V2] Creating route "${name}" with ${points?.length || 0} points`);
    
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
      console.log(`📍 [ROUTES V2] Inserting ${points.length} route points`);
      
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
    
    console.log(`✅ [ROUTES V2] Route created: ${responseRoute.name}`);
    res.status(201).json(responseRoute);
  } catch (error) {
    console.error('❌ [ROUTES V2] Error creating route:', error);
    res.status(500).json({ error: 'Erro ao criar rota' });
  }
});

// Função MELHORADA para preservar pontos concluídos
async function handleIntelligentRouteUpdate(client: any, routeId: string, newPoints: any[]) {
  try {
    console.log(`🧠 [ROUTES V2 INTELLIGENT] Processando atualização inteligente para rota ${routeId}`);
    
    // Buscar pontos já concluídos PRIMEIRO
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

    console.log(`✅ [ROUTES V2 INTELLIGENT] ${completedPoints.length} pontos já concluídos preservados`);
    
    if (completedPoints.length === 0) {
      // Se nenhum ponto foi concluído, substituir completamente
      console.log(`🔄 [ROUTES V2 INTELLIGENT] Nenhum ponto concluído, atualizando rota completa`);
      
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
    
    // PRESERVAR pontos concluídos e adicionar novos pontos
    console.log(`🔄 [ROUTES V2 INTELLIGENT] Preservando ${completedPoints.length} pontos concluídos`);
    
    // Deletar APENAS pontos não concluídos
    await client.query(
      'DELETE FROM route_points WHERE route_id = $1 AND (completed = false OR completed IS NULL)',
      [routeId]
    );
    
    // Encontrar a maior ordem dos pontos concluídos
    const maxCompletedOrder = Math.max(...completedPoints.map(p => p.order));
    
    // Filtrar novos pontos que devem vir APÓS os pontos concluídos
    const newPointsToAdd = newPoints.filter(p => p.order > maxCompletedOrder);
    
    console.log(`🆕 [ROUTES V2 INTELLIGENT] Adicionando ${newPointsToAdd.length} novos pontos após ordem ${maxCompletedOrder}`);
    
    // Inserir apenas os novos pontos não concluídos
    for (const point of newPointsToAdd) {
      await client.query(
        `INSERT INTO route_points (route_id, address, lat, lng, point_order, type, completed)
         VALUES ($1, $2, $3, $4, $5, $6, false)`,
        [routeId, point.address, point.lat, point.lng, point.order, point.type || 'waypoint']
      );
    }
    
    // Atualizar timestamp da rota
    await client.query(
      'UPDATE routes SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [routeId]
    );
    
    console.log(`✅ [ROUTES V2 INTELLIGENT] Rota atualizada preservando ${completedPoints.length} pontos concluídos`);
    
  } catch (error) {
    console.error('❌ [ROUTES V2 INTELLIGENT] Erro na atualização inteligente:', error);
    throw error;
  }
}

router.put('/:id', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const { name, description, points, totalDistance, estimatedTime, estimatedDuration, optimizedOrder, polyline, status } = req.body;
    
    console.log(`🔄 [ROUTES V2 UPDATE] Atualizando rota ${id} com ${points?.length || 0} pontos`);
    
    // Verificar se a rota está sendo usada por algum caminhão
    const trucksUsingRoute = await client.query(
      'SELECT id, name FROM trucks WHERE current_route_id = $1',
      [id]
    );
    
    if (trucksUsingRoute.rows.length > 0) {
      console.log(`📍 [ROUTES V2 UPDATE] Rota em uso por ${trucksUsingRoute.rows.length} caminhão(ões) - aplicando preservação inteligente`);
      
      // Aplicar atualização inteligente preservando pontos concluídos
      await handleIntelligentRouteUpdate(client, id, points);
    } else {
      console.log(`🔄 [ROUTES V2 UPDATE] Rota não está em uso - atualizando normalmente`);
      
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
    
    console.log(`✅ [ROUTES V2 UPDATE] Route updated with intelligent preservation: ${responseRoute.name}`);
    res.json(responseRoute);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ [ROUTES V2 UPDATE] Error updating route:', error);
    res.status(500).json({ error: 'Erro ao atualizar rota' });
  } finally {
    client.release();
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // First check if route is referenced by any schedules
    const scheduleCheck = await pool.query(
      'SELECT COUNT(*) as count FROM schedules WHERE route_id = $1', 
      [id]
    );
    
    if (parseInt(scheduleCheck.rows[0].count) > 0) {
      return res.status(400).json({ 
        error: 'Não é possível excluir esta rota pois ela possui agendamentos vinculados. Remova os agendamentos primeiro.' 
      });
    }
    
    // Delete related route_points first
    await pool.query('DELETE FROM route_points WHERE route_id = $1', [id]);
    
    // Then delete the route
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

// Endpoint para resetar rota manualmente
router.post('/:id/reset', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    
    console.log(`🔄 [ROUTES V2 RESET] Resetando rota ${id} manualmente`);
    
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
    
    console.log(`✅ [ROUTES V2 RESET] Rota ${id} resetada com sucesso`);
    res.json({ 
      message: 'Rota resetada com sucesso',
      pointsReset: resetResult.rowCount || 0
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ [ROUTES V2 RESET] Erro ao resetar rota:', error);
    res.status(500).json({ error: 'Erro ao resetar rota' });
  } finally {
    client.release();
  }
});

// Endpoint de otimização ATUALIZADO para Routes API v2
router.post('/:id/optimize', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`🚀 [ROUTES V2 OPTIMIZE] Iniciando otimização com Routes API v2 da rota ${id}`);
    
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

    // Usar Routes API v2
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
      
      console.log(`✅ [ROUTES V2 OPTIMIZE] Rota ${id} otimizada com Routes API v2`);
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
    console.error('❌ [ROUTES V2 OPTIMIZE] Erro na otimização:', error);
    res.status(500).json({ error: 'Erro ao otimizar rota com Routes API v2' });
  }
});

// Endpoint de otimização completa ATUALIZADO para Routes API v2
router.post('/:id/full-optimize', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    
    console.log(`🎯 [ROUTES V2 FULL OPTIMIZE] Iniciando otimização completa com Routes API v2 da rota ${id}`);
    
    // Buscar todos os pontos da rota
    const pointsResult = await client.query(
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
            p.point_order === pointsResult.rows.length - 1 ? 'destination' : 'waypoint'
    }));
    
    if (points.length < 2) {
      await client.query('COMMIT');
      return res.json({ message: 'Rota tem poucos pontos para otimizar' });
    }
    
    // Resetar status de completed para permitir reotimização completa
    await client.query(
      'UPDATE route_points SET completed = false, completed_at = NULL WHERE route_id = $1',
      [id]
    );
    
    // Usar Routes API v2 para otimização completa
    const optimized = await googleMapsOptimizer.optimizeRouteWithGoogleAPIs(points);
    
    // Atualizar ordem dos pontos
    await client.query('DELETE FROM route_points WHERE route_id = $1', [id]);
    
    for (const point of optimized.optimizedPoints) {
      await client.query(
        `INSERT INTO route_points (route_id, address, lat, lng, point_order, type, completed)
         VALUES ($1, $2, $3, $4, $5, $6, false)`,
        [id, point.address, point.lat, point.lng, point.order, point.type]
      );
    }
    
    // Atualizar JSONB da rota também
    const jsonbPoints = optimized.optimizedPoints.map(point => ({
      id: point.id,
      address: point.address,
      lat: point.lat,
      lng: point.lng,
      order: point.order,
      type: point.type,
      completed: false
    }));
    
    await client.query(
      `UPDATE routes SET 
       points = $1, 
       total_distance = $2,
       estimated_duration = $3,
       polyline = $4,
       optimized_order = $5,
       updated_at = CURRENT_TIMESTAMP 
       WHERE id = $6`,
      [
        JSON.stringify(jsonbPoints), 
        optimized.totalDistance,
        optimized.totalDuration,
        optimized.polyline,
        JSON.stringify(optimized.optimizedOrder),
        id
      ]
    );
    
    await client.query('COMMIT');
    
    console.log(`✅ [ROUTES V2 FULL OPTIMIZE] Rota ${id} otimizada completamente com Routes API v2`);
    res.json({ 
      message: 'Rota otimizada completamente com Routes API v2', 
      optimizedPoints: optimized.optimizedPoints.length,
      totalDistance: optimized.totalDistance,
      totalDuration: Math.round(optimized.totalDuration / 60) + ' min',
      newOrder: optimized.optimizedOrder
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ [ROUTES V2 FULL OPTIMIZE] Erro na otimização completa:', error);
    res.status(500).json({ error: 'Erro ao otimizar rota completamente com Routes API v2' });
  } finally {
    client.release();
  }
});

function calculateDistance(point1: any, point2: any): number {
  const lat1 = parseFloat(point1.lat);
  const lng1 = parseFloat(point1.lng);
  const lat2 = parseFloat(point2.lat);
  const lng2 = parseFloat(point2.lng);
  
  const deltaLat = lat2 - lat1;
  const deltaLng = lng2 - lng1;
  
  return Math.sqrt(deltaLat * deltaLat + deltaLng * deltaLng);
}

export default router;
