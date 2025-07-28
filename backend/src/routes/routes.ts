import { Router } from 'express';
import { pool } from '../config/database';
import { googleMapsOptimizer } from '../services/googleMapsOptimizer';
import { blockOptimizerService } from '../services/blockOptimizer';

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

// ✅ NOVO ENDPOINT - Otimização inteligente por blocos
router.post('/:id/optimize-intelligent', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const { points } = req.body;
    
    console.log(`🧠 [INTELLIGENT OPTIMIZE] ========================================`);
    console.log(`🧠 [INTELLIGENT OPTIMIZE] Iniciando otimização inteligente por blocos para rota ${id}`);
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

    // ✅ BUSCAR PONTOS CONCLUÍDOS REAIS DO BANCO
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
    
    const completedResult = await client.query(completedPointsQuery, [id]);
    const trulyCompletedPoints = completedResult.rows;
    
    console.log(`🔒 [INTELLIGENT OPTIMIZE] ${trulyCompletedPoints.length} pontos REALMENTE concluídos no banco`);

    // ✅ PREPARAR PONTOS PARA OTIMIZAÇÃO POR BLOCOS
    const pointsForOptimization = points.map((point: any, index: number) => {
      const isCompleted = trulyCompletedPoints.some(cp => 
        cp.address === point.address && 
        Math.abs(cp.lat - point.lat) < 0.001 && 
        Math.abs(cp.lng - point.lng) < 0.001
      );

      return {
        id: point.id || `point-${Date.now()}-${index}`,
        address: point.address || '',
        cep: point.cep || '',
        lat: isValidCoordinate(point.lat) ? point.lat : 0,
        lng: isValidCoordinate(point.lng) ? point.lng : 0,
        order: index,
        type: point.type || 'waypoint',
        completed: isCompleted,
        completedAt: isCompleted ? new Date().toISOString() : null
      };
    });

    console.log(`📊 [INTELLIGENT OPTIMIZE] ${pointsForOptimization.filter(p => p.completed).length} pontos preservados`);
    console.log(`📊 [INTELLIGENT OPTIMIZE] ${pointsForOptimization.filter(p => !p.completed).length} pontos para otimizar`);

    // ✅ APLICAR OTIMIZAÇÃO POR BLOCOS
    const optimizationResult = await blockOptimizerService.optimizeRouteInBlocks(
      pointsForOptimization,
      id
    );

    // ✅ CALCULAR MÉTRICAS TOTAIS
    const totalDistance = optimizationResult.totalDistance;
    const totalDuration = optimizationResult.totalDuration;
    const hours = Math.floor(totalDuration / 3600);
    const minutes = Math.floor((totalDuration % 3600) / 60);
    const estimatedTime = hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`;

    // ✅ EXTRAIR PONTOS FINAIS DE TODOS OS BLOCOS
    const finalPoints = optimizationResult.optimizedBlocks.reduce((acc, block) => {
      return acc.concat(block.points);
    }, [] as any[]);

    // ✅ ATUALIZAR ROTA COM DADOS OTIMIZADOS
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
        Math.round(totalDuration),
        id
      ]
    );

    // ✅ ATUALIZAR PONTOS NA TABELA route_points
    await client.query('DELETE FROM route_points WHERE route_id = $1', [id]);
    
    for (const point of finalPoints) {
      await client.query(
        `INSERT INTO route_points (route_id, address, lat, lng, point_order, type, completed, completed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [id, point.address, point.lat, point.lng, point.order, point.type || 'waypoint', point.completed || false, point.completedAt]
      );
    }

    await client.query('COMMIT');

    console.log(`✅ [INTELLIGENT OPTIMIZE] Otimização inteligente por blocos concluída`);
    console.log(`📊 [INTELLIGENT OPTIMIZE] ${optimizationResult.optimizedBlocks.length} blocos processados`);
    console.log(`📊 [INTELLIGENT OPTIMIZE] ${optimizationResult.preservedPoints} pontos preservados`);
    console.log(`📊 [INTELLIGENT OPTIMIZE] ${optimizationResult.optimizedPoints} pontos otimizados`);
    console.log(`🧠 [INTELLIGENT OPTIMIZE] ========================================`);

    res.json({
      message: 'Otimização inteligente por blocos concluída',
      points: finalPoints,
      optimizedOrder: finalPoints.map(p => p.id),
      totalDistance: totalDistance,
      estimatedTime: estimatedTime,
      blocksProcessed: optimizationResult.optimizedBlocks.length,
      preservedPoints: optimizationResult.preservedPoints,
      optimizedPoints: optimizationResult.optimizedPoints
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ [INTELLIGENT OPTIMIZE] Erro na otimização inteligente por blocos:', error);
    res.status(500).json({ error: 'Erro na otimização inteligente por blocos' });
  } finally {
    client.release();
  }
});

// ✅ NOVA FUNÇÃO - VALIDAR COORDENADAS
function isValidCoordinate(coord: any): boolean {
  return typeof coord === 'number' && !isNaN(coord) && isFinite(coord);
}

// ✅ MELHORAR preserveCompletedPointsIntelligently para usar blocos
async function preserveCompletedPointsIntelligently(client: any, routeId: string, newPoints: any[]) {
  try {
    console.log(`🛡️ [INTELLIGENT PRESERVATION] Iniciando preservação com otimização por blocos para rota ${routeId}`);
    
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

    // 2️⃣ PREPARAR PONTOS PARA OTIMIZAÇÃO POR BLOCOS
    const pointsForOptimization = newPoints.map((point: any, index: number) => {
      const isCompleted = trulyCompletedPoints.some(cp => 
        cp.address === point.address && 
        Math.abs(cp.lat - point.lat) < 0.001 && 
        Math.abs(cp.lng - point.lng) < 0.001
      );

      return {
        id: point.id || `point-${Date.now()}-${index}`,
        address: point.address || '',
        cep: point.cep || '',
        lat: isValidCoordinate(point.lat) ? point.lat : 0,
        lng: isValidCoordinate(point.lng) ? point.lng : 0,
        order: index,
        type: point.type || 'waypoint',
        completed: isCompleted,
        completedAt: isCompleted ? new Date().toISOString() : null
      };
    });

    // 3️⃣ SE NÃO HÁ PONTOS CONCLUÍDOS, APLICAR OTIMIZAÇÃO NORMAL
    if (trulyCompletedPoints.length === 0) {
      console.log(`🆕 [INTELLIGENT PRESERVATION] Nenhum ponto concluído - usando otimização por blocos`);
      
      const optimizationResult = await blockOptimizerService.optimizeRouteInBlocks(
        pointsForOptimization,
        routeId
      );

      return optimizationResult.optimizedBlocks.reduce((acc, block) => {
        return acc.concat(block.points);
      }, [] as any[]);
    }

    // 4️⃣ APLICAR OTIMIZAÇÃO POR BLOCOS COM PRESERVAÇÃO
    console.log(`🧩 [INTELLIGENT PRESERVATION] Aplicando otimização por blocos com preservação`);
    
    const optimizationResult = await blockOptimizerService.optimizeRouteInBlocks(
      pointsForOptimization,
      routeId
    );

    // 5️⃣ APLICAR MUDANÇAS NO BANCO
    console.log(`💾 [INTELLIGENT PRESERVATION] Aplicando mudanças no banco`);
    
    // Extrair pontos finais de todos os blocos
    const finalPoints = optimizationResult.optimizedBlocks.reduce((acc, block) => {
      return acc.concat(block.points);
    }, [] as any[]);

    // ✅ REMOVER APENAS PONTOS NÃO CONCLUÍDOS
    await client.query(
      `DELETE FROM route_points 
       WHERE route_id = $1 
       AND (completed = false OR completed IS NULL OR completed = 'f')`,
      [routeId]
    );
    
    // ✅ INSERIR NOVOS PONTOS OTIMIZADOS
    for (const point of finalPoints.filter(p => !p.completed)) {
      await client.query(
        `INSERT INTO route_points (route_id, address, lat, lng, point_order, type, completed, completed_at)
         VALUES ($1, $2, $3, $4, $5, $6, false, NULL)`,
        [routeId, point.address, point.lat, point.lng, point.order, point.type || 'waypoint']
      );
    }

    console.log(`✅ [INTELLIGENT PRESERVATION] Preservação com blocos concluída: ${finalPoints.length} pontos finais`);
    
    return finalPoints;
    
  } catch (error) {
    console.error('❌ [INTELLIGENT PRESERVATION] Erro na preservação com blocos:', error);
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

export default router;
