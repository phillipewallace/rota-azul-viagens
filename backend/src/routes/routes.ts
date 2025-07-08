
import { Router } from 'express';
import { pool } from '../config/database';

const router = Router();

// Get all routes
router.get('/', async (req, res) => {
  try {
    console.log('🛣️ Fetching all routes...');
    
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

    console.log(`✅ Found ${routes.length} routes`);
    res.json(routes);
  } catch (error) {
    console.error('❌ Error fetching routes:', error);
    res.status(500).json({ error: 'Erro ao buscar rotas' });
  }
});

// Get single route by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
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
    
    res.json(route);
  } catch (error) {
    console.error('❌ Error fetching route:', error);
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
    
    console.log('✅ Route created:', responseRoute.name);
    res.status(201).json(responseRoute);
  } catch (error) {
    console.error('❌ Error creating route:', error);
    res.status(500).json({ error: 'Erro ao criar rota' });
  }
});

router.put('/:id', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const { name, description, points, totalDistance, estimatedTime, estimatedDuration, optimizedOrder, polyline, status } = req.body;
    
    console.log(`🔄 [ROUTE UPDATE] Atualizando rota ${id} com ${points?.length || 0} pontos`);
    
    // Verificar se a rota está sendo usada por algum caminhão
    const trucksUsingRoute = await client.query(
      'SELECT id, name FROM trucks WHERE current_route_id = $1',
      [id]
    );
    
    if (trucksUsingRoute.rows.length > 0) {
      console.log(`📍 [ROUTE UPDATE] Rota em uso por ${trucksUsingRoute.rows.length} caminhão(ões)`);
      
      // Para cada caminhão usando a rota, fazer atualização inteligente
      for (const truck of trucksUsingRoute.rows) {
        await handleIntelligentRouteUpdate(client, id, truck.id, points);
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
    
    // Update route points
    if (points && points.length > 0) {
      // Delete existing points
      await client.query('DELETE FROM route_points WHERE route_id = $1', [id]);
      
      // Insert new points
      for (const point of points) {
        await client.query(
          `INSERT INTO route_points (route_id, address, lat, lng, point_order, type)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [id, point.address, point.lat, point.lng, point.order, point.type || 'waypoint']
        );
      }
    }
    
    await client.query('COMMIT');
    
    const responseRoute = {
      ...result.rows[0],
      totalDistance: parseFloat(result.rows[0].total_distance) || 0,
      estimatedDuration: parseInt(result.rows[0].estimated_duration) || 0
    };
    
    console.log('✅ Route updated with intelligent sync:', responseRoute.name);
    res.json(responseRoute);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error updating route:', error);
    res.status(500).json({ error: 'Erro ao atualizar rota' });
  } finally {
    client.release();
  }
});

// Função para atualização inteligente de rota em uso
async function handleIntelligentRouteUpdate(client: any, routeId: string, truckId: string, newPoints: any[]) {
  try {
    console.log(`🧠 [INTELLIGENT UPDATE] Processando atualização para caminhão ${truckId}`);
    
    // Buscar pontos atuais já concluídos
    const completedPointsResult = await client.query(
      'SELECT * FROM route_points WHERE route_id = $1 AND completed = true ORDER BY point_order',
      [routeId]
    );
    
    const completedPoints = completedPointsResult.rows;
    console.log(`✅ [INTELLIGENT UPDATE] ${completedPoints.length} pontos já concluídos`);
    
    if (completedPoints.length === 0) {
      // Se nenhum ponto foi concluído, pode atualizar normalmente
      console.log(`🔄 [INTELLIGENT UPDATE] Nenhum ponto concluído, atualizando rota completa`);
      return;
    }
    
    // Encontrar próximos pontos não concluídos
    const pendingPointsResult = await client.query(
      'SELECT * FROM route_points WHERE route_id = $1 AND completed = false ORDER BY point_order',
      [routeId]
    );
    
    const pendingPoints = pendingPointsResult.rows;
    console.log(`⏳ [INTELLIGENT UPDATE] ${pendingPoints.length} pontos pendentes`);
    
    // Manter pontos concluídos e otimizar apenas os novos + pendentes
    const lastCompletedOrder = completedPoints.length > 0 ? 
      Math.max(...completedPoints.map(p => p.point_order)) : 0;
    
    // Novos pontos que vêm depois dos concluídos
    const newPointsToAdd = newPoints.filter(p => p.order > lastCompletedOrder);
    
    if (newPointsToAdd.length > 0) {
      console.log(`➕ [INTELLIGENT UPDATE] Adicionando ${newPointsToAdd.length} novos pontos`);
      
      // Reordenar apenas os pontos pendentes + novos para otimização
      const pointsToOptimize = [...pendingPoints, ...newPointsToAdd];
      
      // Aqui você pode implementar a lógica de otimização
      // Por simplicidade, vou apenas reordenar por ordem atual
      let currentOrder = lastCompletedOrder + 1;
      
      for (const point of pointsToOptimize) {
        if (point.id) {
          // Atualizar ponto existente
          await client.query(
            'UPDATE route_points SET point_order = $1 WHERE id = $2',
            [currentOrder, point.id]
          );
        } else {
          // Inserir novo ponto
          await client.query(
            `INSERT INTO route_points (route_id, address, lat, lng, point_order, type, completed)
             VALUES ($1, $2, $3, $4, $5, $6, false)`,
            [routeId, point.address, point.lat, point.lng, currentOrder, point.type || 'waypoint']
          );
        }
        currentOrder++;
      }
      
      console.log(`🎯 [INTELLIGENT UPDATE] Pontos reordenados mantendo ${completedPoints.length} concluídos`);
    }
    
  } catch (error) {
    console.error('❌ [INTELLIGENT UPDATE] Erro na atualização inteligente:', error);
    throw error;
  }
}

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

router.post('/:id/optimize', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get route points
    const pointsResult = await pool.query(
      'SELECT * FROM route_points WHERE route_id = $1 ORDER BY point_order',
      [id]
    );
    
    const points = pointsResult.rows;
    
    // Simple optimization - for now just return the points as is
    // In a real implementation, you would use a routing service like Google Maps or OSRM
    const optimizedOrder = points.map((_, index) => index);
    
    // Update the route with optimized order
    await pool.query(
      'UPDATE routes SET optimized_order = $1 WHERE id = $2',
      [JSON.stringify(optimizedOrder), id]
    );
    
    res.json({ optimizedOrder, points });
  } catch (error) {
    console.error('❌ Error optimizing route:', error);
    res.status(500).json({ error: 'Erro ao otimizar rota' });
  }
});

// Novo endpoint para otimização completa ao finalizar rota
router.post('/:id/full-optimize', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    
    console.log(`🎯 [FULL OPTIMIZE] Iniciando otimização completa da rota ${id}`);
    
    // Buscar todos os pontos da rota
    const pointsResult = await client.query(
      'SELECT * FROM route_points WHERE route_id = $1 ORDER BY point_order',
      [id]
    );
    
    const points = pointsResult.rows;
    
    if (points.length < 2) {
      await client.query('COMMIT');
      return res.json({ message: 'Rota tem poucos pontos para otimizar' });
    }
    
    // Resetar status de completed para permitir reotimização
    await client.query(
      'UPDATE route_points SET completed = false, completed_at = NULL WHERE route_id = $1',
      [id]
    );
    
    // Aqui você implementaria a lógica de otimização real
    // Por exemplo, usando algoritmo de TSP ou chamada para Google Maps Directions API
    
    // Por simplicidade, vou fazer uma otimização básica por distância
    const optimizedPoints = await optimizePointsByDistance(points);
    
    // Atualizar ordem dos pontos
    for (let i = 0; i < optimizedPoints.length; i++) {
      await client.query(
        'UPDATE route_points SET point_order = $1 WHERE id = $2',
        [i + 1, optimizedPoints[i].id]
      );
    }
    
    // Atualizar JSONB da rota também
    const jsonbPoints = optimizedPoints.map((point, index) => ({
      id: point.id,
      address: point.address,
      lat: parseFloat(point.lat),
      lng: parseFloat(point.lng),
      order: index + 1,
      type: point.type,
      completed: false
    }));
    
    await client.query(
      'UPDATE routes SET points = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [JSON.stringify(jsonbPoints), id]
    );
    
    await client.query('COMMIT');
    
    console.log(`✅ [FULL OPTIMIZE] Rota ${id} otimizada com ${optimizedPoints.length} pontos`);
    res.json({ 
      message: 'Rota otimizada com sucesso', 
      optimizedPoints: optimizedPoints.length,
      newOrder: optimizedPoints.map(p => p.id)
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ [FULL OPTIMIZE] Erro na otimização completa:', error);
    res.status(500).json({ error: 'Erro ao otimizar rota' });
  } finally {
    client.release();
  }
});

// Função básica de otimização por distância
async function optimizePointsByDistance(points: any[]) {
  if (points.length <= 2) return points;
  
  // Algoritmo simples: começar do primeiro ponto e sempre ir para o mais próximo não visitado
  const optimized = [];
  const remaining = [...points];
  
  // Começar com o primeiro ponto (origem)
  let current = remaining.shift();
  optimized.push(current);
  
  while (remaining.length > 0) {
    let nearestIndex = 0;
    let nearestDistance = calculateDistance(current, remaining[0]);
    
    for (let i = 1; i < remaining.length; i++) {
      const distance = calculateDistance(current, remaining[i]);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = i;
      }
    }
    
    current = remaining.splice(nearestIndex, 1)[0];
    optimized.push(current);
  }
  
  return optimized;
}

// Calcular distância euclidiana simples entre dois pontos
function calculateDistance(point1: any, point2: any) {
  const lat1 = parseFloat(point1.lat);
  const lng1 = parseFloat(point1.lng);
  const lat2 = parseFloat(point2.lat);
  const lng2 = parseFloat(point2.lng);
  
  const deltaLat = lat2 - lat1;
  const deltaLng = lng2 - lng1;
  
  return Math.sqrt(deltaLat * deltaLat + deltaLng * deltaLng);
}

export default router;
