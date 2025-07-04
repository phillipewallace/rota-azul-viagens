
import { Router } from 'express';
import { pool } from '../config/database';

const router = Router();

// Get truck data by plate for mobile app
router.get('/truck/:plate', async (req, res) => {
  try {
    const { plate } = req.params;
    
    const truckResult = await pool.query(`
      SELECT t.*, d.name as driver_name, r.name as route_name, r.points as route_points
      FROM trucks t
      LEFT JOIN drivers d ON t.driver_id::text = d.id::text
      LEFT JOIN routes r ON t.current_route_id::text = r.id::text
      WHERE UPPER(t.plate) = UPPER($1)
    `, [plate]);

    if (truckResult.rows.length === 0) {
      return res.status(404).json({ error: 'Caminhão não encontrado' });
    }

    const truck = truckResult.rows[0];
    
    let currentRoute = null;
    if (truck.route_points) {
      currentRoute = {
        id: truck.current_route_id,
        name: truck.route_name,
        points: truck.route_points.map((point: any, index: number) => ({
          ...point,
          completed: false // Implementar lógica de controle depois
        }))
      };
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

    res.json(response);
  } catch (error) {
    console.error('Error fetching truck by plate:', error);
    res.status(500).json({ error: 'Erro ao buscar dados do caminhão' });
  }
});

// Update truck location
router.put('/truck/:id/location', async (req, res) => {
  try {
    const { id } = req.params;
    const { lat, lng } = req.body;

    await pool.query(
      'UPDATE trucks SET location_lat = $1, location_lng = $2 WHERE id = $3',
      [lat, lng, id]
    );

    console.log(`📍 Localização atualizada para caminhão ${id}: ${lat}, ${lng}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating truck location:', error);
    res.status(500).json({ error: 'Erro ao atualizar localização' });
  }
});

// Update route point status
router.put('/truck/:truckId/route/point/:pointId', async (req, res) => {
  try {
    const { truckId, pointId } = req.params;
    const { completed } = req.body;

    // Implementar lógica de atualização de pontos da rota
    // Por enquanto, apenas retorna sucesso
    console.log(`✅ Ponto ${pointId} marcado como ${completed ? 'concluído' : 'pendente'} para caminhão ${truckId}`);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating route point:', error);
    res.status(500).json({ error: 'Erro ao atualizar ponto da rota' });
  }
});

// Finish route
router.post('/truck/:truckId/finish-route', async (req, res) => {
  try {
    const { truckId } = req.params;
    
    // Update truck status and remove current route
    await pool.query(
      'UPDATE trucks SET status = $1, current_route_id = NULL WHERE id = $2',
      ['available', truckId]
    );
    
    // Mark route as completed if exists
    const truckResult = await pool.query(
      'SELECT current_route_id FROM trucks WHERE id = $1',
      [truckId]
    );
    
    if (truckResult.rows[0]?.current_route_id) {
      await pool.query(
        'UPDATE routes SET status = $1 WHERE id = $2',
        ['completed', truckResult.rows[0].current_route_id]
      );
    }
    
    console.log(`🏁 Rota finalizada para caminhão ${truckId}`);
    res.json({ success: true, message: 'Rota finalizada com sucesso' });
  } catch (error) {
    console.error('Error finishing route:', error);
    res.status(500).json({ error: 'Erro ao finalizar rota' });
  }
});

export default router;
