
import { Router } from 'express';
import { pool } from '../config/database';

const router = Router();

// Endpoint para reordenar pontos de uma rota específica
router.post('/:id/reorder-points', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`🔧 [ROUTE MAINTENANCE] Reordenando pontos da rota ${id}`);
    
    const result = await pool.query(
      'SELECT reorder_route_points($1) as points_updated',
      [id]
    );
    
    const pointsUpdated = result.rows[0].points_updated;
    
    console.log(`✅ [ROUTE MAINTENANCE] ${pointsUpdated} pontos reordenados`);
    
    res.json({
      message: 'Pontos reordenados com sucesso',
      pointsUpdated: pointsUpdated
    });
    
  } catch (error) {
    console.error('❌ [ROUTE MAINTENANCE] Erro ao reordenar pontos:', error);
    res.status(500).json({ error: 'Erro ao reordenar pontos da rota' });
  }
});

// Endpoint para limpeza de pontos órfãos/duplicados
router.post('/:id/cleanup-points', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`🧹 [ROUTE MAINTENANCE] Limpando pontos da rota ${id}`);
    
    const result = await pool.query(
      'SELECT cleanup_route_points($1) as cleanup_result',
      [id]
    );
    
    const cleanupResult = result.rows[0].cleanup_result;
    
    console.log(`✅ [ROUTE MAINTENANCE] Limpeza concluída:`, cleanupResult);
    
    res.json({
      message: 'Limpeza de pontos concluída',
      ...cleanupResult
    });
    
  } catch (error) {
    console.error('❌ [ROUTE MAINTENANCE] Erro na limpeza:', error);
    res.status(500).json({ error: 'Erro na limpeza de pontos' });
  }
});

// Endpoint para limpeza geral (todas as rotas)
router.post('/cleanup-all', async (req, res) => {
  try {
    console.log(`🧹 [ROUTE MAINTENANCE] Limpeza geral de todas as rotas`);
    
    const result = await pool.query('SELECT cleanup_route_points() as cleanup_result');
    const cleanupResult = result.rows[0].cleanup_result;
    
    console.log(`✅ [ROUTE MAINTENANCE] Limpeza geral concluída:`, cleanupResult);
    
    res.json({
      message: 'Limpeza geral concluída',
      ...cleanupResult
    });
    
  } catch (error) {
    console.error('❌ [ROUTE MAINTENANCE] Erro na limpeza geral:', error);
    res.status(500).json({ error: 'Erro na limpeza geral' });
  }
});

export default router;
