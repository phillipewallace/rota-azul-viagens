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

// ✅ NOVO ENDPOINT - VERIFICAR SE ROTA ESTÁ EM USO
router.get('/:id/check-usage', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`🔍 [ROUTE USAGE] Verificando uso da rota ${id}`);
    
    const trucksUsingRoute = await pool.query(
      'SELECT id, name, plate FROM trucks WHERE current_route_id = $1',
      [id]
    );
    
    const inUse = trucksUsingRoute.rows.length > 0;
    
    console.log(`${inUse ? '🚛' : '🆓'} [ROUTE USAGE] Rota ${id} ${inUse ? 'EM USO' : 'LIVRE'} por ${trucksUsingRoute.rows.length} caminhão(ões)`);
    
    res.json({
      inUse: inUse,
      trucksCount: trucksUsingRoute.rows.length,
      trucks: trucksUsingRoute.rows
    });
    
  } catch (error) {
    console.error('❌ [ROUTE USAGE] Erro ao verificar uso da rota:', error);
    res.status(500).json({ error: 'Erro ao verificar uso da rota' });
  }
});

// ✅ NOVO ENDPOINT - OTIMIZAÇÃO INTELIGENTE PRIORITÁRIA
router.post('/:id/optimize-intelligent', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const { points } = req.body;
    
    console.log(`🧠 [INTELLIGENT OPTIMIZE] ========================================`);
    console.log(`🧠 [INTELLIGENT OPTIMIZE] Iniciando otimização inteligente para rota ${id}`);
    console.log(`🧠 [INTELLIGENT OPTIMIZE] Pontos recebidos: ${points?.length || 0}`);
    
    if (!points || points.length < 2) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'É necessário pelo menos 2 pontos' });
    }

    // ✅ VERIFICAR SE ROTA EXISTE
    const routeCheck = await client.query('SELECT id, name FROM routes WHERE id = $1', [id]);
    if (routeCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Rota não encontrada' });
    }

    // ✅ VERIFICAR SE ESTÁ EM USO
    const trucksUsingRoute = await client.query(
      'SELECT id, name, plate FROM trucks WHERE current_route_id = $1',
      [id]
    );

    if (trucksUsingRoute.rows.length === 0) {
      await client.query('ROLLBACK');
      console.log(`🆓 [INTELLIGENT OPTIMIZE] Rota não está em uso - usar otimização tradicional`);
      return res.status(400).json({ 
        error: 'Rota não está em uso - usar otimização tradicional',
        useTraditional: true 
      });
    }

    console.log(`🚛 [INTELLIGENT OPTIMIZE] Rota em uso por ${trucksUsingRoute.rows.length} caminhão(ões)`);

    // ✅ APLICAR PRESERVAÇÃO INTELIGENTE
    const finalPoints = await preserveCompletedPointsIntelligently(client, id, points);

    // ✅ CALCULAR MÉTRICAS
    const totalDistance = calculateTotalDistanceFromPoints(finalPoints);
    const estimatedDuration = totalDistance * 60; // 1 km/min estimate
    const hours = Math.floor(estimatedDuration / 3600);
    const minutes = Math.floor((estimatedDuration % 3600) / 60);
    const estimatedTime = hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`;

    // ✅ ATUALIZAR ROTA COM DADOS PRESERVADOS
    await client.query(
      `UPDATE routes SET 
       points = $1, 
       total_distance = $2, 
       estimated_time = $3, 
       estimated_duration = $4,
       updated_at = CURRENT_TIMESTAMP 
       WHERE id = $5`,
      [
        JSON.stringify(finalPoints),
        totalDistance,
        estimatedTime,
        Math.round(estimatedDuration),
        id
      ]
    );

    await client.query('COMMIT');

    console.log(`✅ [INTELLIGENT OPTIMIZE] Otimização inteligente concluída com preservação`);
    console.log(`📊 [INTELLIGENT OPTIMIZE] ${finalPoints.filter(p => p.completed).length} pontos preservados`);
    console.log(`📊 [INTELLIGENT OPTIMIZE] ${finalPoints.filter(p => !p.completed).length} pontos otimizados`);
    console.log(`🧠 [INTELLIGENT OPTIMIZE] ========================================`);

    res.json({
      message: 'Otimização inteligente concluída',
      points: finalPoints,
      optimizedOrder: finalPoints.map(p => p.id),
      totalDistance: totalDistance,
      estimatedTime: estimatedTime,
      preservedPoints: finalPoints.filter(p => p.completed).length,
      optimizedPoints: finalPoints.filter(p => !p.completed).length
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ [INTELLIGENT OPTIMIZE] Erro na otimização inteligente:', error);
    res.status(500).json({ error: 'Erro na otimização inteligente' });
  } finally {
    client.release();
  }
});

// ✅ FUNÇÃO AUXILIAR - CALCULAR DISTÂNCIA TOTAL
function calculateTotalDistanceFromPoints(points: any[]): number {
  if (points.length < 2) return 0;
  
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += calculateDistance(points[i], points[i + 1]);
  }
  return total;
}

function calculateDistance(point1: any, point2: any): number {
  const R = 6371;
  const dLat = toRadians(point2.lat - point1.lat);
  const dLng = toRadians(point2.lng - point1.lng);
  
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
           Math.cos(toRadians(point1.lat)) * Math.cos(toRadians(point2.lat)) *
           Math.sin(dLng/2) * Math.sin(dLng/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

async function preserveCompletedPointsIntelligently(client: any, routeId: string, newPoints: any[]) {
  try {
    console.log(`🛡️ [INTELLIGENT PRESERVATION] Iniciando preservação ROBUSTA para rota ${routeId}`);
    
    // 1️⃣ BUSCAR PONTOS REALMENTE CONCLUÍDOS DO BANCO
    const completedPointsQuery = `
      SELECT rp.*, 
             CASE 
               WHEN rp.completed = true OR rp.completed = 't' OR rp.completed = 'true' THEN true
               ELSE false
             END as is_truly_completed
      FROM route_points rp 
      WHERE rp.route_id = $1 
      AND (rp.completed = true OR rp.completed = 't' OR rp.completed = 'true')
      ORDER BY rp.point_order ASC
    `;
    
    const completedResult = await client.query(completedPointsQuery, [routeId]);
    const trulyCompletedPoints = completedResult.rows;
    
    console.log(`🔒 [INTELLIGENT PRESERVATION] ${trulyCompletedPoints.length} pontos REALMENTE concluídos no banco`);
    
    // Log detalhado dos pontos concluídos
    trulyCompletedPoints.forEach((point, index) => {
      console.log(`🔒 [PRESERVATION] Ponto concluído ${index + 1}: {
  id: '${point.id}',
  order: ${point.point_order},
  address: '${point.address.substring(0, 40)}...',
  completed: ${point.completed},
  completed_at: ${point.completed_at}
}`);
    });

    // 2️⃣ SE NÃO HÁ PONTOS CONCLUÍDOS, FAZER ATUALIZAÇÃO NORMAL
    if (trulyCompletedPoints.length === 0) {
      console.log(`🆕 [INTELLIGENT PRESERVATION] Nenhum ponto concluído - atualização normal`);
      
      await client.query('DELETE FROM route_points WHERE route_id = $1', [routeId]);
      
      for (const point of newPoints) {
        await client.query(
          `INSERT INTO route_points (route_id, address, lat, lng, point_order, type, completed)
           VALUES ($1, $2, $3, $4, $5, $6, false)`,
          [routeId, point.address, point.lat, point.lng, point.order, point.type || 'waypoint']
        );
      }
      
      return newPoints;
    }

    // 3️⃣ ENCONTRAR O ÚLTIMO PONTO CONCLUÍDO
    const lastCompletedPoint = trulyCompletedPoints[trulyCompletedPoints.length - 1];
    const lastCompletedOrder = lastCompletedPoint.point_order;
    
    console.log(`📍 [INTELLIGENT PRESERVATION] Último ponto concluído na ordem: ${lastCompletedOrder}`);

    // 4️⃣ CRIAR LISTA DE PONTOS PRESERVADOS (CONCLUÍDOS)
    const preservedPoints = trulyCompletedPoints.map(p => ({
      id: p.id,
      address: p.address,
      lat: parseFloat(p.lat),
      lng: parseFloat(p.lng),
      order: p.point_order,
      type: p.type,
      completed: true,
      completedAt: p.completed_at
    }));

    // 5️⃣ IDENTIFICAR NOVOS PONTOS QUE VÊM APÓS OS CONCLUÍDOS
    const pendingNewPoints = newPoints
      .filter(p => p.order > lastCompletedOrder)
      .map((p, index) => ({
        ...p,
        order: lastCompletedOrder + index + 1,
        completed: false,
        completedAt: null
      }));
    
    console.log(`🎯 [INTELLIGENT PRESERVATION] ${pendingNewPoints.length} novos pontos para inserir após concluídos`);

    // 6️⃣ OTIMIZAR APENAS OS PONTOS PENDENTES SE NECESSÁRIO
    let optimizedPendingPoints = pendingNewPoints;
    
    if (pendingNewPoints.length > 1) {
      try {
        console.log(`🚀 [INTELLIGENT PRESERVATION] Otimizando ${pendingNewPoints.length} pontos pendentes`);
        
        const optimizationResult = await googleMapsOptimizer.optimizePartialRoute(
          [preservedPoints[preservedPoints.length - 1]], // Último concluído como origem
          pendingNewPoints
        );
        
        optimizedPendingPoints = optimizationResult.optimizedPoints
          .filter(p => !p.completed)
          .map((p, index) => ({
            ...p,
            order: lastCompletedOrder + index + 1,
            completed: false,
            completedAt: null
          }));
        
        console.log(`✅ [INTELLIGENT PRESERVATION] ${optimizedPendingPoints.length} pontos otimizados`);
        
      } catch (optimizationError) {
        console.error(`⚠️ [INTELLIGENT PRESERVATION] Erro na otimização:`, optimizationError);
        // Manter ordem original em caso de erro
      }
    }

    // 7️⃣ APLICAR MUDANÇAS NO BANCO - PRESERVANDO PONTOS CONCLUÍDOS
    console.log(`💾 [INTELLIGENT PRESERVATION] Aplicando mudanças no banco`);
    
    // ✅ REMOVER APENAS PONTOS NÃO CONCLUÍDOS
    await client.query(
      `DELETE FROM route_points 
       WHERE route_id = $1 
       AND (completed = false OR completed IS NULL OR completed = 'f')`,
      [routeId]
    );
    
    console.log(`🗑️ [INTELLIGENT PRESERVATION] Pontos não concluídos removidos`);
    
    // ✅ INSERIR APENAS NOVOS PONTOS OTIMIZADOS
    for (const point of optimizedPendingPoints) {
      await client.query(
        `INSERT INTO route_points (route_id, address, lat, lng, point_order, type, completed, completed_at)
         VALUES ($1, $2, $3, $4, $5, $6, false, NULL)`,
        [routeId, point.address, point.lat, point.lng, point.order, point.type || 'waypoint']
      );
    }
    
    console.log(`✅ [INTELLIGENT PRESERVATION] ${optimizedPendingPoints.length} novos pontos inseridos`);

    // 8️⃣ RESULTADO FINAL - PONTOS PRESERVADOS + NOVOS OTIMIZADOS
    const finalPoints = [...preservedPoints, ...optimizedPendingPoints];
    
    console.log(`🎯 [INTELLIGENT PRESERVATION] Resultado final: ${preservedPoints.length} preservados + ${optimizedPendingPoints.length} novos = ${finalPoints.length} total`);
    
    return finalPoints;
    
  } catch (error) {
    console.error('❌ [INTELLIGENT PRESERVATION] Erro crítico:', error);
    throw error;
  }
}

router.put('/:id', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const { name, description, points, totalDistance, estimatedTime, estimatedDuration, optimizedOrder, polyline, status } = req.body;
    
    console.log(`🔄 [ROUTE UPDATE] ========================================`);
    console.log(`🔄 [ROUTE UPDATE] Atualizando rota ${id} com ${points?.length || 0} pontos`);
    
    // Verificar se a rota existe
    const routeExists = await client.query('SELECT id, name FROM routes WHERE id = $1', [id]);
    if (routeExists.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Rota não encontrada' });
    }
    
    // ✅ VERIFICAR SE A ROTA ESTÁ SENDO USADA POR ALGUM CAMINHÃO
    const trucksUsingRoute = await client.query(
      'SELECT id, name, plate FROM trucks WHERE current_route_id = $1',
      [id]
    );
    
    let finalPoints = points || [];
    
    if (trucksUsingRoute.rows.length > 0 && points && points.length > 0) {
      console.log(`🚛 [ROUTE UPDATE] Rota em uso por ${trucksUsingRoute.rows.length} caminhão(ões):`);
      trucksUsingRoute.rows.forEach(truck => {
        console.log(`   - ${truck.name} (${truck.plate})`);
      });
      
      // ✅ APLICAR PRESERVAÇÃO INTELIGENTE ROBUSTA
      finalPoints = await preserveCompletedPointsIntelligently(client, id, points);
      
    } else {
      console.log(`🆓 [ROUTE UPDATE] Rota livre - atualização normal`);
      
      // Atualização normal para rotas não em uso
      if (points && points.length > 0) {
        await client.query('DELETE FROM route_points WHERE route_id = $1', [id]);
        
        for (const point of points) {
          await client.query(
            `INSERT INTO route_points (route_id, address, lat, lng, point_order, type, completed)
             VALUES ($1, $2, $3, $4, $5, $6, false)`,
            [id, point.address, point.lat, point.lng, point.order, point.type || 'waypoint']
          );
        }
      }
    }
    
    // ✅ BUSCAR PONTOS FINAIS DO BANCO (COM ESTADO CORRETO)
    const finalPointsFromDB = await client.query(
      `SELECT address, lat, lng, point_order, type, 
              CASE 
                WHEN completed = true OR completed = 't' OR completed = 'true' THEN true
                ELSE false
              END as completed, 
              completed_at 
       FROM route_points 
       WHERE route_id = $1 
       ORDER BY point_order ASC`,
      [id]
    );

    const updatedPoints = finalPointsFromDB.rows.map(p => ({
      address: p.address,
      lat: parseFloat(p.lat),
      lng: parseFloat(p.lng),
      order: p.point_order,
      type: p.type,
      completed: p.completed,
      completedAt: p.completed_at
    }));

    console.log(`📊 [ROUTE UPDATE] Pontos finais no banco: ${updatedPoints.length} total`);
    console.log(`📊 [ROUTE UPDATE] Pontos concluídos: ${updatedPoints.filter(p => p.completed).length}`);
    console.log(`📊 [ROUTE UPDATE] Pontos pendentes: ${updatedPoints.filter(p => !p.completed).length}`);

    // Atualizar dados da rota principal
    const updateQuery = `
      UPDATE routes 
      SET name = $1, description = $2, points = $3, total_distance = $4, 
          estimated_time = $5, estimated_duration = $6, optimized_order = $7, 
          polyline = $8, status = $9, updated_at = CURRENT_TIMESTAMP
      WHERE id = $10
      RETURNING *
    `;
    
    const result = await client.query(updateQuery, [
      name,
      description,
      JSON.stringify(updatedPoints),
      parseFloat(totalDistance) || 0,
      estimatedTime,
      parseInt(estimatedDuration) || 0,
      JSON.stringify(optimizedOrder || []),
      polyline,
      status || 'active',
      id
    ]);
    
    await client.query('COMMIT');
    
    const responseRoute = {
      ...result.rows[0],
      totalDistance: parseFloat(result.rows[0].total_distance) || 0,
      estimatedDuration: parseInt(result.rows[0].estimated_duration) || 0
    };
    
    console.log(`✅ [ROUTE UPDATE] Rota "${responseRoute.name}" atualizada com preservação inteligente`);
    console.log(`✅ [ROUTE UPDATE] ========================================`);
    
    res.json(responseRoute);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ [ROUTE UPDATE] Erro ao atualizar rota:', error);
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

// ✅ ENDPOINT DE RESET - ÚNICO LOCAL AUTORIZADO A RESETAR PONTOS
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
    
    // ✅ RESET COMPLETO - Resetar TODOS os pontos da rota (completed = false)
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

// Endpoint de otimização 
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
