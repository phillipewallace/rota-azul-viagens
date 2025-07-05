
import { Router } from 'express';
import { pool } from '../config/database';

const router = Router();

// Get truck data by plate for mobile app
router.get('/truck/:plate', async (req, res) => {
  try {
    const { plate } = req.params;
    
    console.log(`🔍 Buscando caminhão com placa: ${plate}`);
    
    // Query simplificada para buscar dados do caminhão
    const truckQuery = `
      SELECT 
        t.id,
        t.name,
        t.plate,
        t.model,
        t.year,
        t.status,
        t.current_route_id,
        d.name as driver_name
      FROM trucks t
      LEFT JOIN drivers d ON t.current_driver_id = d.id
      WHERE UPPER(REPLACE(t.plate, '-', '')) = UPPER(REPLACE($1, '-', ''))
    `;
    
    const truckResult = await pool.query(truckQuery, [plate]);

    if (truckResult.rows.length === 0) {
      console.log(`❌ Caminhão não encontrado: ${plate}`);
      return res.status(404).json({ error: 'Caminhão não encontrado' });
    }

    const truck = truckResult.rows[0];
    console.log(`✅ Caminhão encontrado: ${truck.name} (${truck.plate})`);
    
    // Buscar dados da rota se existir
    let currentRoute: {
      id: any;
      name: any;
      description: any;
      points: any;
    } | null = null;
    
    if (truck.current_route_id) {
      const routeQuery = `
        SELECT 
          r.id,
          r.name,
          r.description,
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', rp.id,
              'address', rp.address,
              'lat', rp.lat,
              'lng', rp.lng,
              'order', rp.point_order,
              'type', rp.type,
              'completed', rp.completed
            ) ORDER BY rp.point_order
          ) as points
        FROM routes r
        LEFT JOIN route_points rp ON r.id = rp.route_id
        WHERE r.id = $1
        GROUP BY r.id, r.name, r.description
      `;
      
      const routeResult = await pool.query(routeQuery, [truck.current_route_id]);
      
      if (routeResult.rows.length > 0) {
        const route = routeResult.rows[0];
        currentRoute = {
          id: route.id,
          name: route.name,
          description: route.description,
          points: route.points || []
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
      driver: truck.driver_name,
      currentRoute
    };

    console.log(`📱 Enviando dados do caminhão:`, response);
    res.json(response);
    
  } catch (error) {
    console.error('❌ Erro ao buscar caminhão:', error);
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

    console.log(`📍 Localização atualizada para caminhão ${id}: ${lat}, ${lng}`);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Erro ao atualizar localização:', error);
    res.status(500).json({ error: 'Erro ao atualizar localização' });
  }
});

// Update route point status
router.put('/truck/:truckId/route/point/:pointId', async (req, res) => {
  try {
    const { truckId, pointId } = req.params;
    const { completed } = req.body;

    // Atualizar o status do ponto na rota
    await pool.query(
      'UPDATE route_points SET completed = $1, completed_at = $2 WHERE id = $3',
      [completed, completed ? new Date() : null, pointId]
    );

    console.log(`✅ Ponto ${pointId} marcado como ${completed ? 'concluído' : 'pendente'} para caminhão ${truckId}`);
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Erro ao atualizar ponto da rota:', error);
    res.status(500).json({ error: 'Erro ao atualizar ponto da rota' });
  }
});

// Finish route
router.post('/truck/:truckId/finish-route', async (req, res) => {
  try {
    const { truckId } = req.params;
    
    console.log(`🏁 Iniciando finalização da rota para caminhão ${truckId}`);
    
    // Buscar a rota atual do caminhão
    const truckResult = await pool.query(
      'SELECT current_route_id FROM trucks WHERE id = $1',
      [truckId]
    );
    
    if (truckResult.rows.length === 0) {
      console.log(`❌ Caminhão não encontrado: ${truckId}`);
      return res.status(404).json({ error: 'Caminhão não encontrado' });
    }
    
    const currentRouteId = truckResult.rows[0].current_route_id;
    console.log(`📋 Rota atual: ${currentRouteId}`);
    
    // Atualizar status do caminhão
    await pool.query(
      'UPDATE trucks SET status = $1, current_route_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['available', truckId]
    );
    
    // Marcar todos os pontos da rota como concluídos se existe rota
    if (currentRouteId) {
      await pool.query(
        'UPDATE route_points SET completed = true, completed_at = CURRENT_TIMESTAMP WHERE route_id = $1 AND completed = false',
        [currentRouteId]
      );
      console.log(`✅ Pontos da rota ${currentRouteId} marcados como concluídos`);
    }
    
    console.log(`🏁 Rota finalizada para caminhão ${truckId}`);
    res.json({ success: true, message: 'Rota finalizada com sucesso' });
  } catch (error) {
    console.error('❌ Erro ao finalizar rota:', error);
    res.status(500).json({ error: 'Erro ao finalizar rota' });
  }
});

export default router;
