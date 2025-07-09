
import { Router } from 'express';
import { pool } from '../config/database';

const router = Router();

// Get truck data by plate for mobile app
router.get('/truck/:plate', async (req, res) => {
  try {
    const { plate } = req.params;
    
    console.log(`🔍 [MOBILE] Buscando caminhão: ${plate}`);
    
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
      console.log(`❌ [MOBILE] Caminhão não encontrado: ${plate}`);
      return res.status(404).json({ error: 'Caminhão não encontrado' });
    }

    const truck = truckResult.rows[0];
    
    // Buscar dados da rota se existir
    let currentRoute = null;
    
    if (truck.current_route_id) {
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
        
        // Buscar pontos da rota sempre da tabela route_points para ter dados mais atualizados
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
            END as completed,
            rp.completed_at
          FROM route_points rp
          WHERE rp.route_id = $1
          ORDER BY rp.point_order ASC
        `;
        
        const pointsResult = await pool.query(pointsQuery, [truck.current_route_id]);
        
        let points = [];
        
        if (pointsResult.rows.length > 0) {
          points = pointsResult.rows.map((point) => ({
            id: point.id,
            address: point.address,
            lat: Number(point.lat),
            lng: Number(point.lng),
            order: Number(point.order),
            type: point.type,
            completed: point.completed === true || point.completed === 't' || point.completed === 'true',
            completedAt: point.completed_at
          }));
        }
        
        const completedCount = points.filter(p => p.completed === true).length;
        
        currentRoute = {
          id: route.id,
          name: route.name,
          description: route.description || null,
          points: points,
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

    console.log(`✅ [MOBILE] Resposta enviada - Rota: ${currentRoute ? 'Sim' : 'Não'}`);
    res.json(response);
    
  } catch (error) {
    console.error('❌ [MOBILE] Erro ao buscar caminhão:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Update truck location
router.put('/truck/:id/location', async (req, res) => {
  try {
    const { id } = req.params;
    const { lat, lng } = req.body;

    await pool.query(
      'UPDATE trucks SET location_lat = $1, location_lng = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
      [lat, lng, id]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('❌ [MOBILE] Erro ao atualizar localização:', error);
    res.status(500).json({ error: 'Erro ao atualizar localização' });
  }
});

// Update route point status
router.put('/truck/:truckId/route/point/:pointId', async (req, res) => {
  try {
    const { truckId, pointId } = req.params;
    const { completed } = req.body;

    console.log(`🎯 [MOBILE] Atualizando ponto ${pointId} - completed: ${completed}`);

    const completedValue = Boolean(completed);

    // Atualizar na tabela route_points
    const updateRoutePointsResult = await pool.query(
      'UPDATE route_points SET completed = $1, completed_at = $2 WHERE id = $3 RETURNING *',
      [completedValue, completedValue ? new Date() : null, pointId]
    );

    if (updateRoutePointsResult.rows.length > 0) {
      console.log(`✅ [MOBILE] Ponto ${pointId} atualizado`);
      res.json({ success: true, point: updateRoutePointsResult.rows[0] });
      return;
    }

    console.log(`❌ [MOBILE] Ponto ${pointId} não encontrado`);
    res.status(404).json({ error: 'Ponto não encontrado' });
    
  } catch (error) {
    console.error('❌ [MOBILE] Erro ao atualizar ponto:', error);
    res.status(500).json({ error: 'Erro ao atualizar ponto da rota' });
  }
});

// Finish route
router.post('/truck/:truckId/finish-route', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { truckId } = req.params;
    
    console.log(`🏁 [MOBILE] Finalizando rota para caminhão ${truckId}`);
    
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
    
    // Desvincular o caminhão da rota
    await client.query(
      'UPDATE trucks SET current_route_id = NULL, status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['available', truckId]
    );
    
    await client.query('COMMIT');
    
    console.log(`✅ [MOBILE] Rota finalizada - ${resetPointsResult.rows.length} pontos resetados`);
    res.json({ 
      success: true, 
      message: 'Rota finalizada e pontos resetados com sucesso',
      pointsReset: resetPointsResult.rows.length
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ [MOBILE] Erro ao finalizar rota:', error);
    res.status(500).json({ error: 'Erro ao finalizar rota' });
  } finally {
    client.release();
  }
});

export default router;
