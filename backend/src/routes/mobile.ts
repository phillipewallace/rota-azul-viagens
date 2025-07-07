
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
        
        // Buscar pontos da rota da nova tabela ou do JSONB
        let points = [];
        
        // Tentar buscar da tabela route_points primeiro
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
        
        if (pointsResult.rows.length > 0) {
          // Usar pontos da tabela route_points
          points = pointsResult.rows.map((point) => ({
            id: point.id,
            address: point.address,
            lat: Number(point.lat),
            lng: Number(point.lng),
            order: Number(point.order),
            type: point.type,
            completed: point.completed === true || point.completed === 't' || point.completed === 'true'
          }));
        } else {
          // Fallback para JSONB se não encontrar na tabela
          const routeWithPoints = await pool.query(
            'SELECT points FROM routes WHERE id = $1',
            [truck.current_route_id]
          );
          
          if (routeWithPoints.rows[0]?.points) {
            points = routeWithPoints.rows[0].points.map((point: any, index: number) => ({
              id: point.id || `point-${index}`,
              address: point.address || '',
              lat: Number(point.lat || 0),
              lng: Number(point.lng || 0),
              order: Number(point.order || index),
              type: point.type || 'waypoint',
              completed: false // JSONB não tem campo completed
            }));
          }
        }
        
        console.log(`📍 [MOBILE API] Pontos da rota encontrados: ${points.length}`);
        
        // Log detalhado dos pontos para debug
        points.forEach((point) => {
          console.log(`📍 [MOBILE API] Ponto:`, {
            id: point.id,
            order: point.order,
            address: point.address.substring(0, 50) + '...',
            completed: point.completed,
            type: point.type
          });
        });
        
        const completedCount = points.filter(p => p.completed === true).length;
        console.log(`📊 [MOBILE API] Status final: ${completedCount}/${points.length} pontos concluídos`);
        
        currentRoute = {
          id: route.id,
          name: route.name,
          description: route.description || null,
          points: points
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

    console.log(`🎯 [MOBILE API] Atualizando ponto ${pointId} do caminhão ${truckId} para completed: ${completed}`);

    // Garantir que completed seja boolean
    const completedValue = Boolean(completed);

    // Tentar atualizar na tabela route_points primeiro
    const updateRoutePointsResult = await pool.query(
      'UPDATE route_points SET completed = $1, completed_at = $2 WHERE id = $3 RETURNING *',
      [completedValue, completedValue ? new Date() : null, pointId]
    );

    if (updateRoutePointsResult.rows.length > 0) {
      console.log(`✅ [MOBILE API] Ponto ${pointId} atualizado na tabela route_points`);
      res.json({ success: true, point: updateRoutePointsResult.rows[0] });
      return;
    }

    // Se não encontrou na route_points, verificar se existe na rota do caminhão via JSONB
    const verifyQuery = `
      SELECT r.id, r.points
      FROM routes r
      JOIN trucks t ON t.current_route_id = r.id
      WHERE t.id = $1
    `;
    
    const verifyResult = await pool.query(verifyQuery, [truckId]);
    
    if (verifyResult.rows.length === 0) {
      console.log(`❌ [MOBILE API] Rota não encontrada para caminhão: ${truckId}`);
      return res.status(404).json({ error: 'Rota não encontrada' });
    }

    const route = verifyResult.rows[0];
    const points = route.points || [];
    
    // Encontrar e atualizar o ponto no JSONB
    const updatedPoints = points.map((point: any) => {
      if (point.id === pointId) {
        return { ...point, completed: completedValue };
      }
      return point;
    });

    // Atualizar o JSONB na tabela routes
    await pool.query(
      'UPDATE routes SET points = $1 WHERE id = $2',
      [JSON.stringify(updatedPoints), route.id]
    );

    console.log(`✅ [MOBILE API] Ponto ${pointId} atualizado via JSONB`);
    res.json({ success: true, updated_via: 'jsonb' });
    
  } catch (error) {
    console.error('❌ [MOBILE API] Erro ao atualizar ponto da rota:', error);
    res.status(500).json({ error: 'Erro ao atualizar ponto da rota' });
  }
});

// Finish route - tratamento melhorado de dependências
router.post('/truck/:truckId/finish-route', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { truckId } = req.params;
    
    console.log(`🏁 [MOBILE API] Iniciando finalização da rota para caminhão ${truckId}`);
    
    // Buscar a rota atual do caminhão
    const truckResult = await client.query(
      'SELECT current_route_id FROM trucks WHERE id = $1',
      [truckId]
    );
    
    if (truckResult.rows.length === 0) {
      console.log(`❌ [MOBILE API] Caminhão não encontrado: ${truckId}`);
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Caminhão não encontrado' });
    }
    
    const currentRouteId = truckResult.rows[0].current_route_id;
    console.log(`📋 [MOBILE API] Rota atual: ${currentRouteId}`);
    
    // 1. Primeiro, desvincular o caminhão da rota
    await client.query(
      'UPDATE trucks SET current_route_id = NULL, status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['available', truckId]
    );
    
    console.log(`✅ [MOBILE API] Caminhão ${truckId} desvinculado da rota`);
    
    // 2. Resetar pontos da rota (tanto na tabela route_points quanto no JSONB)
    if (currentRouteId) {
      // Resetar na tabela route_points
      const resetPointsResult = await client.query(
        'UPDATE route_points SET completed = false, completed_at = NULL WHERE route_id = $1 RETURNING id',
        [currentRouteId]
      );
      
      if (resetPointsResult.rows.length > 0) {
        console.log(`🔄 [MOBILE API] ${resetPointsResult.rows.length} pontos resetados na tabela route_points`);
      }
      
      // Resetar também no JSONB como fallback
      const routeResult = await client.query(
        'SELECT points FROM routes WHERE id = $1',
        [currentRouteId]
      );
      
      if (routeResult.rows[0]?.points) {
        const points = routeResult.rows[0].points;
        const resetPoints = points.map((point: any) => ({
          ...point,
          completed: false
        }));
        
        await client.query(
          'UPDATE routes SET points = $1 WHERE id = $2',
          [JSON.stringify(resetPoints), currentRouteId]
        );
        
        console.log(`🔄 [MOBILE API] Pontos resetados também no JSONB`);
      }
    }
    
    await client.query('COMMIT');
    
    console.log(`🏁 [MOBILE API] Rota finalizada com sucesso para caminhão ${truckId}`);
    res.json({ 
      success: true, 
      message: 'Rota finalizada com sucesso',
      resetPoints: currentRouteId ? true : false
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
