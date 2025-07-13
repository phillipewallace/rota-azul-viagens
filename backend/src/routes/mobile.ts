
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
    let currentRoute = null;
    
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
        
        let points = [];
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

// Update route point status
router.put('/truck/:truckId/route/point/:pointId', async (req, res) => {
  try {
    const { truckId, pointId } = req.params;
    const { completed } = req.body;

    const completedValue = Boolean(completed);

    console.log(`🎯 [MOBILE API] Atualizando ponto ${pointId} do caminhão ${truckId} para completed: ${completedValue}`);

    // ✅ CRÍTICO: Atualizar COM TIMESTAMP quando concluído
    const updateResult = await pool.query(
      'UPDATE route_points SET completed = $1, completed_at = $2 WHERE id = $3 RETURNING *',
      [completedValue, completedValue ? new Date() : null, pointId]
    );

    if (updateResult.rows.length > 0) {
      // ✅ CRÍTICO: Atualizar timestamp da rota também
      await pool.query(
        'UPDATE routes SET updated_at = CURRENT_TIMESTAMP WHERE id = (SELECT route_id FROM route_points WHERE id = $1)',
        [pointId]
      );

      console.log(`✅ [MOBILE API] Ponto ${pointId} atualizado na tabela route_points`);
      console.log(`✅ [MOBILE API] Timestamp da rota também atualizado`);

      res.json({ success: true, point: updateResult.rows[0] });
      return;
    }

    console.log(`❌ [MOBILE API] Ponto ${pointId} não encontrado`);
    res.status(404).json({ error: 'Ponto não encontrado' });
    
  } catch (error) {
    console.error('❌ [MOBILE API] Erro ao atualizar ponto:', error);
    res.status(500).json({ error: 'Erro ao atualizar ponto da rota' });
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

export default router;
