
import { Router } from 'express';
import { pool } from '../config/database';

const router = Router();

// Get truck data by plate for mobile app
router.get('/truck/:plate', async (req, res) => {
  try {
    const { plate } = req.params;
    
    console.log(`🔍 [MOBILE API] Buscando caminhão com placa: ${plate}`);
    
    // Query para buscar dados do caminhão
    const truckQuery = `
      SELECT 
        t.id,
        t.name,
        t.plate,
        t.model,
        t.year,
        COALESCE(t.status, 'available') as status,
        t.current_route_id,
        d.name as driver_name,
        t.updated_at as truck_updated_at
      FROM trucks t
      LEFT JOIN drivers d ON t.current_driver_id = d.id
      WHERE UPPER(REPLACE(t.plate, '-', '')) = UPPER(REPLACE($1, '-', ''))
    `;
    
    const truckResult = await pool.query(truckQuery, [plate]);

    if (truckResult.rows.length === 0) {
      console.log(`❌ [MOBILE API] Caminhão não encontrado: ${plate}`);
      return res.status(404).json({ error: 'Caminhão não encontrado' });
    }

    const truck = truckResult.rows[0];
    console.log(`✅ [MOBILE API] Caminhão encontrado: ${truck.name} (${truck.plate})`);
    
    // Buscar dados da rota se existir
    let currentRoute: any = null;
    
    if (truck.current_route_id) {
      console.log(`📋 [MOBILE API] Buscando rota: ${truck.current_route_id}`);
      
      const routeQuery = `
        SELECT 
          r.id,
          r.name,
          r.description,
          r.updated_at as route_updated_at
        FROM routes r
        WHERE r.id = $1
      `;
      
      const routeResult = await pool.query(routeQuery, [truck.current_route_id]);
      
      if (routeResult.rows.length > 0) {
        const route = routeResult.rows[0];
        
        // ✅ CRÍTICO: Buscar pontos COM ESTADO COMPLETED CORRETO DIRETO DO BANCO
        const pointsQuery = `
          SELECT 
            rp.id,
            rp.address,
            COALESCE(rp.lat, 0) as lat,
            COALESCE(rp.lng, 0) as lng,
            COALESCE(rp.point_order, 0) as point_order,
            COALESCE(rp.type, 'waypoint') as type,
            CASE 
              WHEN rp.completed = true OR rp.completed = 't' OR rp.completed = 'true' THEN true
              ELSE false
            END as completed,
            rp.completed_at
          FROM route_points rp
          WHERE rp.route_id = $1
          ORDER BY rp.point_order ASC
        `;
        
        const pointsResult = await pool.query(pointsQuery, [truck.current_route_id]);
        console.log(`📍 [MOBILE API] Pontos da rota encontrados: ${pointsResult.rows.length}`);
        
        let points: any[] = [];
        let completedCount = 0;
        
        if (pointsResult.rows.length > 0) {
          points = pointsResult.rows.map((point) => {
            const isCompleted = point.completed === true;
            
            if (isCompleted) {
              completedCount++;
            }
            
            console.log(`📍 [MOBILE API] Ponto: {
  id: '${point.id}',
  order: ${point.point_order},
  address: '${point.address.substring(0, 50)}...',
  completed: ${isCompleted},
  type: '${point.type}'
}`);
            
            return {
              id: point.id,
              address: point.address,
              lat: Number(point.lat),
              lng: Number(point.lng),
              order: Number(point.point_order),
              type: point.type,
              completed: isCompleted,
              completedAt: point.completed_at
            };
          });
        }
        
        console.log(`📊 [MOBILE API] Status final: ${completedCount}/${points.length} pontos concluídos`);
        
        currentRoute = {
          id: route.id,
          name: route.name,
          description: route.description || null,
          points: points,
          pointsCount: points.length,
          completedPoints: completedCount,
          lastUpdated: route.route_updated_at
        };
      }
    }

    const response = {
      id: truck.id,
      name: truck.name,
      plate: truck.plate,
      model: truck.model,
      year: truck.year,
      status: truck.status,
      driver: truck.driver_name || null,
      currentRoute,
      lastUpdated: truck.truck_updated_at
    };

    console.log(`📱 [MOBILE API] Enviando resposta: {
  id: '${response.id}',
  name: '${response.name}',
  plate: '${response.plate}',
  model: '${response.model}',
  year: ${response.year},
  status: '${response.status}',
  driver: ${response.driver},
  currentRoute: ${response.currentRoute ? `{
    id: '${response.currentRoute.id}',
    name: '${response.currentRoute.name}',
    pointsCount: ${response.currentRoute.pointsCount},
    completedPoints: ${response.currentRoute.completedPoints},
    lastUpdated: ${response.currentRoute.lastUpdated}
  }` : 'null'},
  lastUpdated: ${response.lastUpdated}
}`);

    res.json(response);
    
  } catch (error) {
    console.error('❌ [MOBILE API] Erro ao buscar caminhão:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Update truck location
router.put('/truck/:id/location', async (req, res) => {
  try {
    const { id } = req.params;
    const { lat, lng } = req.body;

    console.log(`📍 [MOBILE API] Atualizando localização do caminhão ${id}: { lat: ${lat}, lng: ${lng} }`);

    await pool.query(
      'UPDATE trucks SET location_lat = $1, location_lng = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
      [lat, lng, id]
    );

    console.log(`✅ [MOBILE API] Localização atualizada para caminhão ${id}`);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ [MOBILE API] Erro ao atualizar localização:', error);
    res.status(500).json({ error: 'Erro ao atualizar localização' });
  }
});

// ✅ IMPLEMENTAÇÃO BRUTA E ASSERTIVA - VALIDAÇÃO COMPLETA DE PONTOS
async function validatePointCompletionInDatabase(client: any, pointId: string, expectedCompleted: boolean, truckId: string) {
  const timestamp = new Date().toISOString();
  
  console.log(`🔍 [DB VALIDATION] ========================================`);
  console.log(`🔍 [DB VALIDATION] Iniciando validação COMPLETA do ponto ${pointId}`);
  console.log(`🔍 [DB VALIDATION] Esperado completed: ${expectedCompleted}`);
  console.log(`🔍 [DB VALIDATION] Caminhão: ${truckId}`);
  console.log(`🔍 [DB VALIDATION] Timestamp: ${timestamp}`);
  
  try {
    // 1️⃣ VERIFICAR SE O PONTO EXISTE
    const pointExistsQuery = `
      SELECT 
        rp.id,
        rp.route_id,
        rp.address,
        rp.point_order,
        rp.type,
        rp.completed,
        rp.completed_at,
        rp.created_at,
        r.name as route_name,
        t.name as truck_name,
        t.plate as truck_plate
      FROM route_points rp
      LEFT JOIN routes r ON rp.route_id = r.id
      LEFT JOIN trucks t ON r.id = t.current_route_id
      WHERE rp.id = $1
    `;
    
    const pointExistsResult = await client.query(pointExistsQuery, [pointId]);
    
    if (pointExistsResult.rows.length === 0) {
      console.error(`❌ [DB VALIDATION] ERRO CRÍTICO: Ponto ${pointId} não existe no banco!`);
      throw new Error(`Ponto ${pointId} não encontrado no banco de dados`);
    }
    
    const currentPointData = pointExistsResult.rows[0];
    console.log(`✅ [DB VALIDATION] Ponto encontrado:`);
    console.log(`   - ID: ${currentPointData.id}`);
    console.log(`   - Endereço: ${currentPointData.address}`);
    console.log(`   - Ordem: ${currentPointData.point_order}`);
    console.log(`   - Tipo: ${currentPointData.type}`);
    console.log(`   - Completed ATUAL: ${currentPointData.completed}`);
    console.log(`   - Completed_at ATUAL: ${currentPointData.completed_at}`);
    console.log(`   - Rota: ${currentPointData.route_name} (${currentPointData.route_id})`);
    console.log(`   - Caminhão: ${currentPointData.truck_name} (${currentPointData.truck_plate})`);
    
    // 2️⃣ VERIFICAR SE O CAMINHÃO ESTÁ REALMENTE VINCULADO À ROTA
    const truckRouteValidation = `
      SELECT 
        t.id as truck_id,
        t.current_route_id,
        r.id as route_id,
        r.name as route_name
      FROM trucks t
      LEFT JOIN routes r ON t.current_route_id = r.id
      WHERE t.id = $1 AND r.id = $2
    `;
    
    const truckRouteResult = await client.query(truckRouteValidation, [truckId, currentPointData.route_id]);
    
    if (truckRouteResult.rows.length === 0) {
      console.error(`❌ [DB VALIDATION] ERRO CRÍTICO: Caminhão ${truckId} não está vinculado à rota ${currentPointData.route_id}!`);
      throw new Error(`Caminhão não vinculado à rota do ponto`);
    }
    
    console.log(`✅ [DB VALIDATION] Vinculação caminhão-rota confirmada`);
    
    // 3️⃣ ATUALIZAR O PONTO COM VALIDAÇÃO TRIPLA
    const updateTimestamp = expectedCompleted ? new Date() : null;
    
    console.log(`🔄 [DB VALIDATION] Executando UPDATE com:`);
    console.log(`   - completed: ${expectedCompleted}`);
    console.log(`   - completed_at: ${updateTimestamp}`);
    
    const updateResult = await client.query(
      'UPDATE route_points SET completed = $1, completed_at = $2 WHERE id = $3 RETURNING *',
      [expectedCompleted, updateTimestamp, pointId]
    );
    
    if (updateResult.rows.length === 0) {
      console.error(`❌ [DB VALIDATION] ERRO CRÍTICO: UPDATE falhou para ponto ${pointId}!`);
      throw new Error(`Falha ao atualizar ponto no banco`);
    }
    
    const updatedPoint = updateResult.rows[0];
    console.log(`✅ [DB VALIDATION] UPDATE executado com sucesso`);
    
    // 4️⃣ VERIFICAÇÃO PÓS-UPDATE - LEITURA IMEDIATA DO BANCO
    const verificationQuery = `
      SELECT 
        id,
        completed,
        completed_at,
        CASE 
          WHEN completed = true OR completed = 't' OR completed = 'true' THEN true
          ELSE false
        END as completed_normalized
      FROM route_points 
      WHERE id = $1
    `;
    
    const verificationResult = await client.query(verificationQuery, [pointId]);
    
    if (verificationResult.rows.length === 0) {
      console.error(`❌ [DB VALIDATION] ERRO CRÍTICO: Ponto desapareceu após UPDATE!`);
      throw new Error(`Ponto não encontrado após UPDATE`);
    }
    
    const verifiedPoint = verificationResult.rows[0];
    const actualCompleted = verifiedPoint.completed_normalized;
    
    console.log(`🔍 [DB VALIDATION] Verificação pós-UPDATE:`);
    console.log(`   - completed (bruto): ${verifiedPoint.completed}`);
    console.log(`   - completed (normalizado): ${actualCompleted}`);
    console.log(`   - completed_at: ${verifiedPoint.completed_at}`);
    console.log(`   - Esperado: ${expectedCompleted}`);
    
    // 5️⃣ VALIDAÇÃO FINAL - COMPARAÇÃO ASSERTIVA
    if (actualCompleted !== expectedCompleted) {
      console.error(`❌ [DB VALIDATION] DISCREPÂNCIA CRÍTICA DETECTADA!`);
      console.error(`   - Esperado: ${expectedCompleted}`);
      console.error(`   - Atual no banco: ${actualCompleted}`);
      console.error(`   - Valor bruto no banco: ${verifiedPoint.completed}`);
      
      // Log detalhado da discrepância
      console.error(`🚨 [DB VALIDATION] DADOS PARA DEBUG:`);
      console.error(`   - Point ID: ${pointId}`);
      console.error(`   - Truck ID: ${truckId}`);
      console.error(`   - Route ID: ${currentPointData.route_id}`);
      console.error(`   - Update Timestamp: ${updateTimestamp}`);
      console.error(`   - Verification Result: ${JSON.stringify(verifiedPoint)}`);
      
      throw new Error(`Discrepância crítica: esperado ${expectedCompleted}, encontrado ${actualCompleted}`);
    }
    
    // 6️⃣ ATUALIZAR TIMESTAMP DA ROTA
    await client.query(
      'UPDATE routes SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [currentPointData.route_id]
    );
    
    console.log(`✅ [DB VALIDATION] Timestamp da rota atualizado`);
    
    // 7️⃣ LOG DE SUCESSO COMPLETO
    console.log(`🎯 [DB VALIDATION] VALIDAÇÃO COMPLETA REALIZADA COM SUCESSO!`);
    console.log(`   - Ponto ${pointId} atualizado para completed: ${actualCompleted}`);
    console.log(`   - Completed_at: ${verifiedPoint.completed_at}`);
    console.log(`   - Rota ${currentPointData.route_id} timestamp atualizado`);
    console.log(`   - Caminhão ${truckId} mantém vinculação correta`);
    console.log(`🔍 [DB VALIDATION] ========================================`);
    
    return {
      success: true,
      pointId: pointId,
      actualCompleted: actualCompleted,
      completedAt: verifiedPoint.completed_at,
      routeId: currentPointData.route_id,
      truckId: truckId
    };
    
  } catch (error) {
    console.error(`❌ [DB VALIDATION] ERRO NA VALIDAÇÃO:`, error);
    console.error(`🔍 [DB VALIDATION] ========================================`);
    throw error;
  }
}

// Update route point status with BRUTAL VALIDATION
router.put('/truck/:truckId/route/point/:pointId', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { truckId, pointId } = req.params;
    const { completed } = req.body;

    const completedValue = Boolean(completed);

    console.log(`🎯 [MOBILE API] ========================================`);
    console.log(`🎯 [MOBILE API] ATUALIZAÇÃO DE PONTO COM VALIDAÇÃO BRUTA`);
    console.log(`🎯 [MOBILE API] Ponto: ${pointId}`);
    console.log(`🎯 [MOBILE API] Caminhão: ${truckId}`);
    console.log(`🎯 [MOBILE API] Novo status: ${completedValue}`);
    console.log(`🎯 [MOBILE API] Timestamp: ${new Date().toISOString()}`);

    // ✅ EXECUTAR VALIDAÇÃO COMPLETA E BRUTA
    const validationResult = await validatePointCompletionInDatabase(
      client, 
      pointId, 
      completedValue, 
      truckId
    );

    await client.query('COMMIT');

    console.log(`✅ [MOBILE API] SUCESSO TOTAL - PONTO VALIDADO E ATUALIZADO`);
    console.log(`   - Point ID: ${validationResult.pointId}`);
    console.log(`   - Status final: ${validationResult.actualCompleted}`);
    console.log(`   - Completed at: ${validationResult.completedAt}`);
    console.log(`   - Route ID: ${validationResult.routeId}`);
    console.log(`   - Truck ID: ${validationResult.truckId}`);
    console.log(`🎯 [MOBILE API] ========================================`);

    res.json({ 
      success: true, 
      point: {
        id: validationResult.pointId,
        completed: validationResult.actualCompleted,
        completedAt: validationResult.completedAt
      },
      validation: {
        verified: true,
        routeUpdated: true,
        truckValidated: true
      }
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    
    console.error(`❌ [MOBILE API] FALHA CRÍTICA NA ATUALIZAÇÃO DO PONTO`);
    console.error(`   - Point ID: ${req.params.pointId}`);
    console.error(`   - Truck ID: ${req.params.truckId}`);
    console.error(`   - Erro: ${error.message}`);
    console.error(`   - Stack: ${error.stack}`);
    console.log(`🎯 [MOBILE API] ========================================`);
    
    res.status(500).json({ 
      error: 'Erro crítico ao atualizar ponto da rota',
      details: error.message,
      pointId: req.params.pointId,
      truckId: req.params.truckId,
      timestamp: new Date().toISOString()
    });
  } finally {
    client.release();
  }
});

// Finish route
router.post('/truck/:truckId/finish-route', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { truckId } = req.params;
    
    console.log(`🏁 [MOBILE API] Finalizando rota do caminhão ${truckId}`);
    
    // Buscar a rota atual do caminhão
    const truckResult = await client.query(
      'SELECT current_route_id FROM trucks WHERE id = $1',
      [truckId]
    );
    
    if (truckResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Caminhão não encontrado' });
    }
    
    const currentRouteId = truckResult.rows[0].current_route_id;
    
    if (!currentRouteId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Caminhão não possui rota ativa' });
    }
    
    // Resetar TODOS os pontos da rota
    const resetPointsResult = await client.query(
      'UPDATE route_points SET completed = false, completed_at = NULL WHERE route_id = $1 RETURNING id',
      [currentRouteId]
    );
    
    console.log(`🔄 [MOBILE API] ${resetPointsResult.rows.length} pontos resetados na rota ${currentRouteId}`);
    
    // Desvincular o caminhão da rota
    await client.query(
      'UPDATE trucks SET current_route_id = NULL, status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['available', truckId]
    );
    
    await client.query('COMMIT');
    
    console.log(`✅ [MOBILE API] Rota finalizada para caminhão ${truckId}`);
    
    res.json({ 
      success: true, 
      message: 'Rota finalizada e pontos resetados com sucesso',
      pointsReset: resetPointsResult.rows.length
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ [MOBILE API] Erro ao finalizar rota:', error);
    res.status(500).json({ error: 'Erro ao finalizar rota' });
  } finally {
    client.release();
  }
});

// Adicionar parada extra à rota (MOBILE)
router.post('/route/:routeId/extra-stop', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { routeId } = req.params;
    const { name, stopType, location, insertBeforeId, truckId, source } = req.body;
    
    console.log(`➕ [MOBILE API] Adicionando parada extra à rota ${routeId}`);
    console.log(`📋 [MOBILE API] Dados recebidos:`, { name, stopType, location, insertBeforeId, truckId, source });
    
    // Validar campos obrigatórios
    if (!name || !name.trim()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Nome do cliente/ponto é obrigatório' });
    }
    
    if (!location || !location.trim()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Endereço ou localização é obrigatório' });
    }
    
    // Verificar se rota existe
    const routeCheck = await client.query(
      'SELECT id, name FROM routes WHERE id = $1',
      [routeId]
    );
    
    if (routeCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      console.error(`❌ [MOBILE API] Rota ${routeId} não encontrada`);
      return res.status(404).json({ error: 'Rota não encontrada' });
    }
    
    // Se truckId foi fornecido, verificar vínculo (mas não obrigatório)
    if (truckId) {
      const truckCheck = await client.query(
        'SELECT id, name FROM trucks WHERE id = $1 AND current_route_id = $2',
        [truckId, routeId]
      );
      
      if (truckCheck.rows.length === 0) {
        console.warn(`⚠️ [MOBILE API] Caminhão ${truckId} não vinculado à rota ${routeId}, mas continuando...`);
      }
    }
    
    // Extrair coordenadas do link de localização
    let lat = 0;
    let lng = 0;
    let address = location.trim();
    
    const patterns = [
      /maps\?q=(-?\d+\.?\d*),(-?\d+\.?\d*)/,                    // ?q=lat,lng
      /@(-?\d+\.?\d*),(-?\d+\.?\d*)/,                            // @lat,lng
      /maps\/place\/[^\/]+\/@(-?\d+\.?\d*),(-?\d+\.?\d*)/,       // place/@lat,lng
      /q=(-?\d+\.?\d*),(-?\d+\.?\d*)/,                           // q=lat,lng
      /(-?\d+\.\d{4,}),\s*(-?\d+\.\d{4,})/,                      // lat, lng (decimais)
    ];
    
    for (const pattern of patterns) {
      const match = location.match(pattern);
      if (match) {
        lat = parseFloat(match[1]);
        lng = parseFloat(match[2]);
        console.log(`📍 [MOBILE API] Coordenadas extraídas: ${lat}, ${lng}`);
        break;
      }
    }
    
    if (lat === 0 && lng === 0) {
      console.log(`📍 [MOBILE API] Sem coordenadas extraídas, usando endereço como texto: "${address}"`);
    }
    
    // Determinar ordem de inserção
    let insertOrder = 0;
    
    if (insertBeforeId && insertBeforeId !== 'end') {
      const beforePointResult = await client.query(
        'SELECT point_order FROM route_points WHERE id = $1 AND route_id = $2',
        [insertBeforeId, routeId]
      );
      
      if (beforePointResult.rows.length > 0) {
        insertOrder = beforePointResult.rows[0].point_order;
        
        await client.query(
          'UPDATE route_points SET point_order = point_order + 1 WHERE route_id = $1 AND point_order >= $2',
          [routeId, insertOrder]
        );
        
        console.log(`📍 [MOBILE API] Inserindo antes do ponto ${insertBeforeId} na ordem ${insertOrder}`);
      } else {
        const maxOrderResult = await client.query(
          'SELECT COALESCE(MAX(point_order), -1) + 1 as next_order FROM route_points WHERE route_id = $1',
          [routeId]
        );
        insertOrder = maxOrderResult.rows[0].next_order;
      }
    } else {
      const maxOrderResult = await client.query(
        'SELECT COALESCE(MAX(point_order), -1) + 1 as next_order FROM route_points WHERE route_id = $1',
        [routeId]
      );
      insertOrder = maxOrderResult.rows[0].next_order;
      
      console.log(`📍 [MOBILE API] Adicionando no final na ordem ${insertOrder}`);
    }
    
    // Inserir novo ponto
    const insertResult = await client.query(
      `INSERT INTO route_points (route_id, address, lat, lng, point_order, type, completed, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, false, NULL)
       RETURNING id, address, lat, lng, point_order, type, completed`,
      [routeId, address, lat, lng, insertOrder, 'waypoint']
    );
    
    const newPoint = insertResult.rows[0];
    
    // Atualizar timestamp da rota
    await client.query(
      'UPDATE routes SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [routeId]
    );
    
    await client.query('COMMIT');
    
    console.log(`✅ [MOBILE API] Parada extra adicionada com sucesso: ${newPoint.id}`);
    
    res.json({
      id: newPoint.id,
      address: newPoint.address,
      lat: Number(newPoint.lat) || 0,
      lng: Number(newPoint.lng) || 0,
      order: Number(newPoint.point_order),
      type: newPoint.type,
      completed: newPoint.completed || false,
      name: name.trim(),
      stopType: stopType || 'Entrega'
    });
    
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('❌ [MOBILE API] Erro ao adicionar parada extra:', error);
    res.status(500).json({ 
      error: 'Erro ao adicionar parada extra',
      details: error.message || 'Erro interno do servidor'
    });
  } finally {
    client.release();
  }
});


export default router;
