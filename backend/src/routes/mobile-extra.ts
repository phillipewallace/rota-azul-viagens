import { Router } from 'express';
import { pool } from '../config/database';

const router = Router();

// Reordenar paradas da rota
router.put('/route/:routeId/reorder', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { routeId } = req.params;
    const { points } = req.body;
    
    console.log(`🔄 [MOBILE API] Reordenando paradas da rota ${routeId}`);
    console.log(`📋 [MOBILE API] Novos pontos:`, points);
    
    if (!Array.isArray(points) || points.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Lista de pontos inválida' });
    }
    
    // Verificar se a rota existe
    const routeCheck = await client.query(
      'SELECT id FROM routes WHERE id = $1',
      [routeId]
    );
    
    if (routeCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Rota não encontrada' });
    }
    
    // Atualizar ordem de cada ponto
    for (const point of points) {
      await client.query(
        'UPDATE route_points SET point_order = $1 WHERE id = $2 AND route_id = $3',
        [point.order, point.pointId, routeId]
      );
    }
    
    // Atualizar timestamp da rota
    await client.query(
      'UPDATE routes SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [routeId]
    );
    
    await client.query('COMMIT');
    
    console.log(`✅ [MOBILE API] Reordenação concluída para rota ${routeId}`);
    
    res.json({ 
      success: true,
      message: 'Ordem das paradas atualizada com sucesso',
      routeId,
      pointsUpdated: points.length
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ [MOBILE API] Erro ao reordenar paradas:', error);
    res.status(500).json({ error: 'Erro ao reordenar paradas' });
  } finally {
    client.release();
  }
});

// Adicionar parada extra à rota
router.post('/route/:routeId/extra-stop', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { routeId } = req.params;
    const { name, stopType, location, insertBeforeId, truckId, source } = req.body;
    
    console.log(`➕ [MOBILE API] Adicionando parada extra à rota ${routeId}`);
    console.log(`📋 [MOBILE API] Dados:`, { name, stopType, location, insertBeforeId, truckId, source });
    
    // Validar campos obrigatórios
    if (!name || !location) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Nome e localização são obrigatórios' });
    }
    
    // Verificar se rota existe e está vinculada ao caminhão
    const routeCheck = await client.query(
      `SELECT r.id, r.name, t.id as truck_id, t.name as truck_name
       FROM routes r
       LEFT JOIN trucks t ON t.current_route_id = r.id
       WHERE r.id = $1 AND t.id = $2`,
      [routeId, truckId]
    );
    
    if (routeCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ 
        error: 'Rota não encontrada ou não vinculada ao caminhão' 
      });
    }
    
    // Tentar extrair coordenadas do link de localização (Google Maps)
    let lat = 0;
    let lng = 0;
    let address = location;
    
    // Padrões de URL do Google Maps
    const patterns = [
      /maps\?q=(-?\d+\.\d+),(-?\d+\.\d+)/,           // ?q=lat,lng
      /@(-?\d+\.\d+),(-?\d+\.\d+)/,                   // @lat,lng
      /maps\/place\/[^\/]+\/@(-?\d+\.\d+),(-?\d+\.\d+)/, // place/@lat,lng
    ];
    
    for (const pattern of patterns) {
      const match = location.match(pattern);
      if (match) {
        lat = parseFloat(match[1]);
        lng = parseFloat(match[2]);
        console.log(`📍 [MOBILE API] Coordenadas extraídas do link: ${lat}, ${lng}`);
        break;
      }
    }
    
    // Se não conseguiu extrair coordenadas, usar localização como endereço
    if (lat === 0 && lng === 0) {
      console.log(`📍 [MOBILE API] Usando localização como endereço texto: ${address}`);
    }
    
    // Determinar ordem de inserção
    let insertOrder = 0;
    
    if (insertBeforeId) {
      // Inserir antes de um ponto específico
      const beforePointResult = await client.query(
        'SELECT point_order FROM route_points WHERE id = $1 AND route_id = $2',
        [insertBeforeId, routeId]
      );
      
      if (beforePointResult.rows.length > 0) {
        insertOrder = beforePointResult.rows[0].point_order;
        
        // Incrementar ordem dos pontos posteriores
        await client.query(
          'UPDATE route_points SET point_order = point_order + 1 WHERE route_id = $1 AND point_order >= $2',
          [routeId, insertOrder]
        );
        
        console.log(`📍 [MOBILE API] Inserindo antes do ponto ${insertBeforeId} na ordem ${insertOrder}`);
      } else {
        // Se ponto de referência não existe, adicionar no final
        const maxOrderResult = await client.query(
          'SELECT COALESCE(MAX(point_order), -1) + 1 as next_order FROM route_points WHERE route_id = $1',
          [routeId]
        );
        insertOrder = maxOrderResult.rows[0].next_order;
      }
    } else {
      // Adicionar no final
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
    
    console.log(`✅ [MOBILE API] Parada extra adicionada: ${newPoint.id}`);
    
    // Retornar ponto criado no formato esperado pelo frontend
    res.json({
      id: newPoint.id,
      address: newPoint.address,
      lat: Number(newPoint.lat),
      lng: Number(newPoint.lng),
      order: Number(newPoint.point_order),
      type: newPoint.type,
      completed: newPoint.completed,
      name: name,
      stopType: stopType
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ [MOBILE API] Erro ao adicionar parada extra:', error);
    res.status(500).json({ error: 'Erro ao adicionar parada extra' });
  } finally {
    client.release();
  }
});

export default router;
