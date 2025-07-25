
import express from 'express';
import { pool } from '../config/database';
import { googleMapsOptimizer } from '../services/googleMapsOptimizer';

const router = express.Router();

interface RoutePoint {
  id: string;
  address: string;
  lat: number;
  lng: number;
  order: number;
  type: 'origin' | 'destination' | 'waypoint';
  completed?: boolean;
  completedAt?: string;
}

// ✅ ROTA PARA OTIMIZAÇÃO INTELIGENTE COM CLUSTERIZAÇÃO
router.post('/:id/optimize-intelligent', async (req, res) => {
  try {
    const { id } = req.params;
    const { points } = req.body;

    console.log(`🧠 [ROUTES] ========================================`);
    console.log(`🧠 [ROUTES] OTIMIZAÇÃO INTELIGENTE INICIADA`);
    console.log(`🧠 [ROUTES] Route ID: ${id}`);
    console.log(`🧠 [ROUTES] Pontos recebidos: ${points.length}`);

    // Validar dados de entrada
    if (!points || !Array.isArray(points) || points.length < 2) {
      return res.status(400).json({ 
        error: 'É necessário pelo menos 2 pontos para otimizar a rota',
        useTraditional: true 
      });
    }

    // Buscar rota existente
    const existingRoute = await pool.query(
      'SELECT * FROM routes WHERE id = $1',
      [id]
    );

    if (existingRoute.rows.length === 0) {
      console.log(`⚠️ [ROUTES] Rota não encontrada, usando otimização tradicional`);
      return res.status(404).json({ 
        error: 'Rota não encontrada',
        useTraditional: true 
      });
    }

    // Buscar pontos existentes da rota
    const existingPointsResult = await pool.query(
      'SELECT * FROM route_points WHERE route_id = $1 ORDER BY "order"',
      [id]
    );

    const existingPoints = existingPointsResult.rows;
    console.log(`📊 [ROUTES] Pontos existentes no banco: ${existingPoints.length}`);

    // Identificar pontos concluídos e pendentes
    const completedPoints = existingPoints.filter(p => p.completed === true);
    const newPoints = points.filter(p => !existingPoints.some(ep => ep.id === p.id));
    const updatedPoints = points.filter(p => existingPoints.some(ep => ep.id === p.id && !ep.completed));

    console.log(`📈 [ROUTES] Análise dos pontos:`);
    console.log(`   - Concluídos: ${completedPoints.length}`);
    console.log(`   - Novos: ${newPoints.length}`);
    console.log(`   - Atualizados: ${updatedPoints.length}`);

    // Se não há pontos concluídos, usar otimização tradicional
    if (completedPoints.length === 0) {
      console.log(`🆓 [ROUTES] Nenhum ponto concluído - usando otimização tradicional`);
      return res.status(200).json({ 
        message: 'Sem pontos concluídos, use otimização tradicional',
        useTraditional: true 
      });
    }

    // Determinar pontos pendentes para otimização
    const pendingPoints = [...newPoints, ...updatedPoints];
    
    if (pendingPoints.length === 0) {
      console.log(`✅ [ROUTES] Todos os pontos já foram concluídos`);
      return res.status(200).json({
        points: completedPoints,
        optimizedOrder: completedPoints.map(p => p.id),
        totalDistance: existingRoute.rows[0].total_distance || 0,
        estimatedTime: existingRoute.rows[0].estimated_time || '0min',
        polyline: existingRoute.rows[0].polyline || ''
      });
    }

    console.log(`🎯 [ROUTES] Aplicando otimização inteligente: ${completedPoints.length} preservados + ${pendingPoints.length} para otimizar`);

    // ✅ USAR OTIMIZAÇÃO INTELIGENTE COM CLUSTERIZAÇÃO
    const optimizationResult = await googleMapsOptimizer.optimizePartialRoute(
      completedPoints,
      pendingPoints
    );

    // Salvar pontos otimizados no banco
    await pool.query('DELETE FROM route_points WHERE route_id = $1', [id]);
    
    for (const point of optimizationResult.optimizedPoints) {
      await pool.query(
        `INSERT INTO route_points (
          id, route_id, address, cep, lat, lng, "order", type, completed, completed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          point.id,
          id,
          point.address,
          point.cep || '',
          point.lat,
          point.lng,
          point.order,
          point.type,
          point.completed || false,
          point.completedAt || null
        ]
      );
    }

    // Atualizar rota com novos dados
    await pool.query(
      `UPDATE routes SET 
        total_distance = $1,
        estimated_time = $2,
        polyline = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4`,
      [
        optimizationResult.totalDistance,
        optimizationResult.estimatedTime || `${Math.round(optimizationResult.totalDuration / 60)}min`,
        optimizationResult.polyline || '',
        id
      ]
    );

    console.log(`✅ [ROUTES] OTIMIZAÇÃO INTELIGENTE CONCLUÍDA`);
    console.log(`📊 [ROUTES] Resultado: ${optimizationResult.optimizedPoints.length} pontos, ${optimizationResult.totalDistance.toFixed(1)}km`);
    console.log(`🧠 [ROUTES] ========================================`);

    res.json({
      points: optimizationResult.optimizedPoints,
      optimizedOrder: optimizationResult.optimizedOrder,
      totalDistance: optimizationResult.totalDistance,
      estimatedTime: optimizationResult.estimatedTime || `${Math.round(optimizationResult.totalDuration / 60)}min`,
      polyline: optimizationResult.polyline || ''
    });

  } catch (error) {
    console.error('❌ [ROUTES] Erro na otimização inteligente:', error);
    res.status(500).json({ 
      error: 'Erro interno na otimização inteligente',
      useTraditional: true 
    });
  }
});

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM routes');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar rotas' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, description, points, totalDistance, estimatedTime, optimizedOrder, status, polyline } = req.body;

    const result = await pool.query(
      `INSERT INTO routes (name, description, points, total_distance, estimated_time, optimized_order, status, polyline) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [name, description, points, totalDistance, estimatedTime, optimizedOrder, status, polyline]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao criar rota' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM routes WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Rota não encontrada' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar rota' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, points, totalDistance, estimatedTime, optimizedOrder, status, polyline } = req.body;
    const result = await pool.query(
      `UPDATE routes SET name = $1, description = $2, points = $3, total_distance = $4, 
       estimated_time = $5, optimized_order = $6, status = $7, polyline = $8 WHERE id = $9 RETURNING *`,
      [name, description, points, totalDistance, estimatedTime, optimizedOrder, status, polyline, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Rota não encontrada' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar rota' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM routes WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Rota não encontrada' });
    }
    res.json({ message: 'Rota deletada com sucesso' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao deletar rota' });
  }
});

export default router;
