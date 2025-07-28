import express from 'express';
import { Request, Response } from 'express';
import { googleMapsService } from '../../src/services/googleMaps';
import { routesService } from '../../src/services/routes';
import { RoutePoint } from '../../src/hooks/useRoutes';
import { blockOptimizerService } from '../../src/services/blockOptimizer';

const router = express.Router();

router.get('/geocoding/cep/:cep', async (req: Request, res: Response) => {
  try {
    const { cep } = req.params;
    const address = await googleMapsService.getAddressByCep(cep);
    res.json(address);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/geocoding/optimize', async (req, res) => {
  const { points } = req.body;
  
  console.log('🔄 [GEOCODING FALLBACK] ========================================');
  console.log('🔄 [GEOCODING FALLBACK] ATENÇÃO: Este endpoint deveria ser usado apenas como FALLBACK');
  console.log('🔄 [GEOCODING FALLBACK] Se você está vendo isso, significa que a otimização inteligente falhou');
  console.log('🔄 [GEOCODING FALLBACK] ========================================');
  console.log(`🔄 [GEOCODING FALLBACK] Processando ${points.length} pontos com otimização por blocos`);

  try {
    // ✅ NOVA LÓGICA: Usar otimização por blocos no fallback também
    if (points.length > 25) {
      console.log('🧩 [GEOCODING FALLBACK] Rota grande detectada, usando otimização por blocos');
      
      const blockResult = await blockOptimizerService.optimizeRouteInBlocks(points);
      
      // Combinar todos os pontos dos blocos
      const finalPoints: any[] = [];
      let globalOrder = 0;
      
      for (const block of blockResult.optimizedBlocks) {
        for (const point of block.points) {
          finalPoints.push({
            ...point,
            order: globalOrder++
          });
        }
      }
      
      console.log('✅ [GEOCODING FALLBACK] Otimização por blocos concluída');
      console.log(`📊 [GEOCODING FALLBACK] ${blockResult.optimizedBlocks.length} blocos processados`);
      console.log(`📊 [GEOCODING FALLBACK] ${blockResult.preservedPoints} pontos preservados`);
      console.log(`📊 [GEOCODING FALLBACK] ${blockResult.optimizedPoints} pontos otimizados`);
      console.log(`📊 [GEOCODING FALLBACK] Distância total: ${blockResult.totalDistance.toFixed(1)}km`);
      
      const hours = Math.floor(blockResult.totalDuration / 3600);
      const minutes = Math.floor((blockResult.totalDuration % 3600) / 60);
      const estimatedTime = hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`;
      
      console.log('📤 [GEOCODING FALLBACK] Enviando resposta de fallback com blocos');
      
      res.json({
        optimizedOrder: finalPoints.map(p => p.id),
        totalDistance: blockResult.totalDistance,
        estimatedTime: estimatedTime,
        polyline: '', // Polyline combinada seria muito complexa, deixar vazio
        points: finalPoints,
        blocksProcessed: blockResult.optimizedBlocks.length,
        preservedPoints: blockResult.preservedPoints,
        optimizedPoints: blockResult.optimizedPoints
      });
      
    } else {
      // ✅ ROTA PEQUENA: Usar otimização tradicional
      console.log('📍 [GEOCODING FALLBACK] Rota pequena, usando otimização tradicional');
      
      const formattedPoints = points.map((point: any, index: number) => ({
        id: point.id,
        address: point.address,
        lat: point.lat,
        lng: point.lng,
        order: index,
        type: point.type || 'waypoint',
        completed: point.completed || false,
        completedAt: point.completedAt || null,
      }));
      
      console.log(`🎯 [GEOCODING FALLBACK] Pontos formatados: ${formattedPoints.length}`);
      
      const optimizationResult = await googleMapsOptimizer.optimizeRouteWithGoogleAPIs(formattedPoints);
      
      console.log(`✅ [GEOCODING FALLBACK] Fallback concluído: ${optimizationResult.totalDistance.toFixed(1)}km, ${Math.round(optimizationResult.totalDuration/60)}min`);
      
      const hours = Math.floor(optimizationResult.totalDuration / 3600);
      const minutes = Math.floor((optimizationResult.totalDuration % 3600) / 60);
      const estimatedTime = hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`;
      
      console.log('📤 [GEOCODING FALLBACK] Enviando resposta de fallback tradicional');
      
      res.json({
        optimizedOrder: optimizationResult.optimizedOrder,
        totalDistance: optimizationResult.totalDistance,
        estimatedTime: estimatedTime,
        polyline: optimizationResult.polyline,
        points: optimizationResult.optimizedPoints.map((p: any, index: number) => ({
          id: p.id,
          address: p.address,
          cep: points.find((orig: any) => orig.id === p.id)?.cep || '',
          lat: p.lat,
          lng: p.lng,
          order: index,
          type: p.type,
          completed: p.completed || false,
          completedAt: p.completedAt || null,
        })),
        blocksProcessed: 1,
        preservedPoints: optimizationResult.optimizedPoints.filter((p: any) => p.completed).length,
        optimizedPoints: optimizationResult.optimizedPoints.filter((p: any) => !p.completed).length
      });
    }
    
  } catch (error) {
    console.error('❌ [GEOCODING FALLBACK] Erro no fallback:', error);
    res.status(500).json({ 
      error: 'Erro na otimização da rota',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
  
  console.log('🔄 [GEOCODING FALLBACK] ========================================');
});

router.post('/routes/:routeId/reset', async (req: Request, res: Response) => {
  const { routeId } = req.params;

  try {
    // Buscar a rota pelo ID
    const route = await routesService.getRoutes().then(routes => routes.find(r => r.id === routeId));

    if (!route) {
      return res.status(404).json({ error: 'Rota não encontrada' });
    }

    // Resetar o status 'completed' de todos os pontos da rota
    const resetPoints = route.points.map(point => ({
      ...point,
      completed: false,
      completedAt: null,
    }));

    // Atualizar a rota com os pontos resetados
    const updatedRoute = await routesService.updateRoute(routeId, { points: resetPoints });

    if (!updatedRoute) {
      return res.status(500).json({ error: 'Erro ao atualizar rota' });
    }

    res.json({ message: 'Rota resetada com sucesso', route: updatedRoute });
  } catch (error: any) {
    console.error("Erro ao resetar a rota:", error);
    res.status(500).json({ error: 'Erro ao resetar a rota', details: error.message });
  }
});

export default router;
