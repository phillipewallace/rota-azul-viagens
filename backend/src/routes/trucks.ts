import { Router } from 'express';
import { pool } from '../config/database';

const router = Router();

// Get all trucks
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM trucks ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('❌ [TRUCKS] Error fetching trucks:', error);
    res.status(500).json({ error: 'Erro ao buscar caminhões' });
  }
});

// Get single truck by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM trucks WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Caminhão não encontrado' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ [TRUCKS] Error fetching truck:', error);
    res.status(500).json({ error: 'Erro ao buscar caminhão' });
  }
});

// Create a new truck
router.post('/', async (req, res) => {
  try {
    const { name, plate, model } = req.body;
    const result = await pool.query(
      'INSERT INTO trucks (name, plate, model) VALUES ($1, $2, $3) RETURNING *',
      [name, plate, model]
    );
    console.log('✅ [TRUCKS] Truck created:', result.rows[0].name);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('❌ [TRUCKS] Error creating truck:', error);
    res.status(500).json({ error: 'Erro ao criar caminhão' });
  }
});

// Update truck
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, plate, model } = req.body;
    
    const result = await pool.query(
      'UPDATE trucks SET name = $1, plate = $2, model = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *',
      [name, plate, model, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Caminhão não encontrado' });
    }
    
    console.log('✅ [TRUCKS] Truck updated:', result.rows[0].name);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ [TRUCKS] Error updating truck:', error);
    res.status(500).json({ error: 'Erro ao atualizar caminhão' });
  }
});

// Delete truck
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM trucks WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Caminhão não encontrado' });
    }
    
    console.log('✅ [TRUCKS] Truck deleted:', result.rows[0].name);
    res.json({ message: 'Caminhão excluído com sucesso' });
  } catch (error) {
    console.error('❌ [TRUCKS] Error deleting truck:', error);
    res.status(500).json({ error: 'Erro ao excluir caminhão' });
  }
});

// Get truck by plate number (for mobile app)
router.get('/mobile/truck/:plate', async (req, res) => {
  try {
    const { plate } = req.params;
    
    console.log(`📱 [MOBILE TRUCK] Buscando caminhão com placa ${plate}`);
    
    const truckResult = await pool.query('SELECT id, name, plate, model, current_route_id FROM trucks WHERE plate = $1', [plate]);
    
    if (truckResult.rows.length === 0) {
      console.log(`❌ [MOBILE TRUCK] Caminhão com placa ${plate} não encontrado`);
      return res.status(404).json({ error: 'Caminhão não encontrado' });
    }
    
    const truck = truckResult.rows[0];
    
    if (truck.current_route_id) {
      console.log(`🚚 [MOBILE TRUCK] Caminhão ${truck.name} tem rota ${truck.current_route_id}`);
      
      const routeQuery = `
        SELECT 
          id, name, points, polyline
        FROM routes 
        WHERE id = $1
      `;
      
      const routeResult = await pool.query(routeQuery, [truck.current_route_id]);
      
      if (routeResult.rows.length > 0) {
        const route = routeResult.rows[0];
        
        truck.currentRoute = {
          id: route.id,
          name: route.name,
          polyline: route.polyline || '',
          points: route.points || []
        };
        
        console.log(`🗺️ [MOBILE TRUCK] Rota ${route.name} anexada ao caminhão`);
      } else {
        console.warn(`⚠️ [MOBILE TRUCK] Rota ${truck.current_route_id} não encontrada`);
        truck.currentRoute = null;
      }
    } else {
      console.log(`📍 [MOBILE TRUCK] Caminhão ${truck.name} sem rota`);
      truck.currentRoute = null;
    }
    
    console.log(`✅ [MOBILE TRUCK] Dados do caminhão ${truck.name} enviados`);
    res.json(truck);
    
  } catch (error) {
    console.error('❌ [MOBILE TRUCK] Erro ao buscar caminhão para mobile:', error);
    res.status(500).json({ error: 'Erro ao buscar caminhão' });
  }
});

// Link route to truck with unique validation
router.post('/:id/link-route', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const { routeId } = req.body;
    
    console.log(`🔗 [TRUCK LINK] Tentando vincular rota ${routeId} ao caminhão ${id}`);
    
    if (!routeId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Route ID é obrigatório' });
    }
    
    // ✅ NOVA VALIDAÇÃO: Verificar se a rota já está vinculada a outro caminhão
    const existingLinkQuery = `
      SELECT t.id, t.name, t.plate 
      FROM trucks t 
      WHERE t.current_route_id = $1 AND t.id != $2
    `;
    
    const existingLink = await client.query(existingLinkQuery, [routeId, id]);
    
    if (existingLink.rows.length > 0) {
      const linkedTruck = existingLink.rows[0];
      await client.query('ROLLBACK');
      
      console.log(`❌ [TRUCK LINK] Rota ${routeId} já está vinculada ao caminhão ${linkedTruck.name} (${linkedTruck.plate})`);
      
      return res.status(409).json({ 
        error: 'Esta rota já está vinculada a outro caminhão',
        linkedTruck: {
          id: linkedTruck.id,
          name: linkedTruck.name,
          plate: linkedTruck.plate
        },
        code: 'ROUTE_ALREADY_LINKED'
      });
    }
    
    // Verificar se o caminhão existe
    const truckCheck = await client.query('SELECT id, name FROM trucks WHERE id = $1', [id]);
    if (truckCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Caminhão não encontrado' });
    }
    
    // Verificar se a rota existe
    const routeCheck = await client.query('SELECT id, name FROM routes WHERE id = $1', [routeId]);
    if (routeCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Rota não encontrada' });
    }
    
    // Vincular rota ao caminhão
    await client.query(
      'UPDATE trucks SET current_route_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [routeId, id]
    );
    
    await client.query('COMMIT');
    
    console.log(`✅ [TRUCK LINK] Rota "${routeCheck.rows[0].name}" vinculada ao caminhão "${truckCheck.rows[0].name}"`);
    
    res.json({ 
      message: 'Rota vinculada com sucesso',
      truckName: truckCheck.rows[0].name,
      routeName: routeCheck.rows[0].name
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ [TRUCK LINK] Erro ao vincular rota:', error);
    res.status(500).json({ error: 'Erro ao vincular rota ao caminhão' });
  } finally {
    client.release();
  }
});

// Unlink route from truck
router.post('/:id/unlink-route', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`🔗 [TRUCK UNLINK] Tentando desvincular rota do caminhão ${id}`);
    
    // Verificar se o caminhão existe
    const truckCheck = await pool.query('SELECT id, name, current_route_id FROM trucks WHERE id = $1', [id]);
    if (truckCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Caminhão não encontrado' });
    }
    
    const truck = truckCheck.rows[0];
    
    if (!truck.current_route_id) {
      console.log(`⚠️ [TRUCK UNLINK] Caminhão ${truck.name} já não tem rota vinculada`);
      return res.status(400).json({ error: 'Caminhão já não tem rota vinculada' });
    }
    
    // Desvincular rota do caminhão
    await pool.query(
      'UPDATE trucks SET current_route_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    );
    
    console.log(`✅ [TRUCK UNLINK] Rota desvinculada do caminhão "${truck.name}"`);
    
    res.json({ message: 'Rota desvinculada com sucesso', truckName: truck.name });
    
  } catch (error) {
    console.error('❌ [TRUCK UNLINK] Erro ao desvincular rota:', error);
    res.status(500).json({ error: 'Erro ao desvincular rota do caminhão' });
  }
});

export default router;
