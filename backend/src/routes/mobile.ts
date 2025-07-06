
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
        d.name as driver_name
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
    let currentRoute = null;
    
    if (truck.current_route_id) {
      console.log(`📋 [MOBILE API] Buscando rota: ${truck.current_route_id}`);
      
      const routeQuery = `
        SELECT 
          r.id,
          r.name,
          r.description
        FROM routes r
        WHERE r.id = $1
      `;
      
      const routeResult = await pool.query(routeQuery, [truck.current_route_id]);
      
      if (routeResult.rows.length > 0) {
        const route = routeResult.rows[0];
        
        // Buscar pontos da rota com conversão explícita de boolean
        const pointsQuery = `
          SELECT 
            rp.id,
            rp.address,
            COALESCE(rp.lat, 0) as lat,
            COALESCE(rp.lng, 0) as lng,
            COALESCE(rp.point_order, 0) as "order",
            COALESCE(rp.type, 'waypoint') as type,
            CASE 
              WHEN rp.completed IS TRUE THEN true
              ELSE false 
            END as completed
          FROM route_points rp
          WHERE rp.route_id = $1
          ORDER BY rp.point_order ASC
        `;
        
        const pointsResult = await pool.query(pointsQuery, [truck.current_route_id]);
        
        console.log(`📍 [MOBILE API] Pontos da rota encontrados: ${pointsResult.rows.length}`);
        
        // Log detalhado dos pontos para debug com conversão explícita
        const processedPoints = pointsResult.rows.map((point) => {
          const processedPoint = {
            id: point.id,
            address: point.address,
            lat: Number(point.lat),
            lng: Number(point.lng),
            order: Number(point.order),
            type: point.type,
            completed: point.completed === true || point.completed === 't' || point.completed === 'true'
          };
          
          console.log(`📍 [MOBILE API] Ponto processado:`, {
            id: processedPoint.id,
            order: processedPoint.order,
            address: processedPoint.address.substring(0, 50) + '...',
            completed: processedPoint.completed,
            completedType: typeof processedPoint.completed,
            originalCompleted: point.completed,
            originalCompletedType: typeof point.completed
          });
          
          return processedPoint;
        });
        
        // Log do status geral da rota
        const completedCount = processedPoints.filter(p => p.completed === true).length;
        console.log(`📊 [MOBILE API] Status final: ${completedCount}/${processedPoints.length} pontos concluídos`);
        
        currentRoute = {
          id: route.id,
          name: route.name,
          description: route.description || null,
          points: processedPoints
        };
      } else {
        console.log(`❌ [MOBILE API] Rota não encontrada: ${truck.current_route_id}`);
      }
    } else {
      console.log(`ℹ️ [MOBILE API] Caminhão sem rota atribuída`);
    }

    const response = {
      id: truck.id,
      name: truck.name,
      plate: truck.plate,
      model: truck.model,
      year: truck.year,
      status: truck.status,
      driver: truck.driver_name || null,
      currentRoute
    };

    console.log(`📱 [MOBILE API] Enviando resposta:`, {
      ...response,
      currentRoute: response.currentRoute ? {
        id: response.currentRoute.id,
        name: response.currentRoute.name,
        pointsCount: response.currentRoute.points?.length || 0,
        completedPoints: response.currentRoute.points?.filter(p => p.completed === true).length || 0
      } : null
    });
    
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

    console.log(`📍 [MOBILE API] Atualizando localização do caminhão ${id}:`, { lat, lng });

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

// Update route point status
router.put('/truck/:truckId/route/point/:pointId', async (req, res) => {
  try {
    const { truckId, pointId } = req.params;
    const { completed } = req.body;

    console.log(`🎯 [MOBILE API] Atualizando ponto ${pointId} do caminhão ${truckId} para completed: ${completed} (type: ${typeof completed})`);

    // Verificar se o ponto existe e pertence à rota do caminhão
    const verifyQuery = `
      SELECT rp.id, rp.route_id, t.current_route_id
      FROM route_points rp
      JOIN routes r ON rp.route_id = r.id
      JOIN trucks t ON t.current_route_id = r.id
      WHERE rp.id = $1 AND t.id = $2
    `;
    
    const verifyResult = await pool.query(verifyQuery, [pointId, truckId]);
    
    if (verifyResult.rows.length === 0) {
      console.log(`❌ [MOBILE API] Ponto não encontrado ou não pertence ao caminhão`);
      return res.status(404).json({ error: 'Ponto da rota não encontrado' });
    }

    // Garantir que completed seja boolean
    const completedValue = Boolean(completed);

    // Atualizar o status do ponto na rota
    const updateResult = await pool.query(
      'UPDATE route_points SET completed = $1, completed_at = $2 WHERE id = $3 RETURNING *',
      [completedValue, completedValue ? new Date() : null, pointId]
    );

    if (updateResult.rows.length === 0) {
      console.log(`❌ [MOBILE API] Falha ao atualizar ponto: ${pointId}`);
      return res.status(404).json({ error: 'Erro ao atualizar ponto da rota' });
    }

    console.log(`✅ [MOBILE API] Ponto ${pointId} atualizado com sucesso:`, {
      id: updateResult.rows[0].id,
      completed: updateResult.rows[0].completed,
      completed_at: updateResult.rows[0].completed_at
    });
    
    res.json({ success: true, point: updateResult.rows[0] });
  } catch (error) {
    console.error('❌ [MOBILE API] Erro ao atualizar ponto da rota:', error);
    res.status(500).json({ error: 'Erro ao atualizar ponto da rota' });
  }
});

// Finish route
router.post('/truck/:truckId/finish-route', async (req, res) => {
  try {
    const { truckId } = req.params;
    
    console.log(`🏁 [MOBILE API] Iniciando finalização da rota para caminhão ${truckId}`);
    
    // Buscar a rota atual do caminhão
    const truckResult = await pool.query(
      'SELECT current_route_id FROM trucks WHERE id = $1',
      [truckId]
    );
    
    if (truckResult.rows.length === 0) {
      console.log(`❌ [MOBILE API] Caminhão não encontrado: ${truckId}`);
      return res.status(404).json({ error: 'Caminhão não encontrado' });
    }
    
    const currentRouteId = truckResult.rows[0].current_route_id;
    console.log(`📋 [MOBILE API] Rota atual: ${currentRouteId}`);
    
    // Atualizar status do caminhão
    await pool.query(
      'UPDATE trucks SET status = $1, current_route_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['available', truckId]
    );
    
    // Marcar todos os pontos da rota como concluídos se existe rota
    if (currentRouteId) {
      const updatePointsResult = await pool.query(
        'UPDATE route_points SET completed = true, completed_at = CURRENT_TIMESTAMP WHERE route_id = $1 AND completed = false RETURNING id',
        [currentRouteId]
      );
      console.log(`✅ [MOBILE API] ${updatePointsResult.rows.length} pontos da rota ${currentRouteId} marcados como concluídos`);
    }
    
    console.log(`🏁 [MOBILE API] Rota finalizada com sucesso para caminhão ${truckId}`);
    res.json({ success: true, message: 'Rota finalizada com sucesso' });
  } catch (error) {
    console.error('❌ [MOBILE API] Erro ao finalizar rota:', error);
    res.status(500).json({ error: 'Erro ao finalizar rota' });
  }
});

export default router;
