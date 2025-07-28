
import { geoClusterService } from './geoCluster';
import { googleMapsOptimizer } from './googleMapsOptimizer';

interface Point {
  id: string;
  address: string;
  cep?: string;
  lat: number;
  lng: number;
  order: number;
  type?: string;
  completed?: boolean;
  completedAt?: string | null;
}

interface OptimizedBlock {
  blockId: number;
  points: Point[];
  totalDistance: number;
  totalDuration: number;
  polyline?: string;
}

interface BlockOptimizationResult {
  optimizedBlocks: OptimizedBlock[];
  totalDistance: number;
  totalDuration: number;
  totalPoints: number;
  preservedPoints: number;
  optimizedPoints: number;
}

export class BlockOptimizerService {
  private readonly MAX_POINTS_PER_BLOCK = 25;

  async optimizeRouteInBlocks(
    allPoints: Point[],
    routeId?: string
  ): Promise<BlockOptimizationResult> {
    console.log(`🧩 [BLOCK OPTIMIZER] ========================================`);
    console.log(`🧩 [BLOCK OPTIMIZER] Iniciando otimização por blocos`);
    console.log(`🧩 [BLOCK OPTIMIZER] Total de pontos: ${allPoints.length}`);
    console.log(`🧩 [BLOCK OPTIMIZER] Route ID: ${routeId || 'NOVA ROTA'}`);

    if (allPoints.length <= this.MAX_POINTS_PER_BLOCK) {
      console.log(`📦 [BLOCK OPTIMIZER] Pontos <= ${this.MAX_POINTS_PER_BLOCK}, otimização simples`);
      return await this.optimizeSingleBlock(allPoints);
    }

    const blocks = await this.divideIntoSmartBlocks(allPoints);
    console.log(`📦 [BLOCK OPTIMIZER] Criados ${blocks.length} blocos inteligentes`);

    const optimizedBlocks: OptimizedBlock[] = [];
    let totalDistance = 0;
    let totalDuration = 0;
    let preservedPoints = 0;
    let optimizedPoints = 0;

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      console.log(`🔄 [BLOCK OPTIMIZER] Otimizando bloco ${i + 1}/${blocks.length} (${block.points.length} pontos)`);

      try {
        const blockResult = await this.optimizeBlock(block, i);
        optimizedBlocks.push(blockResult);
        
        totalDistance += blockResult.totalDistance;
        totalDuration += blockResult.totalDuration;
        
        // Count preserved vs optimized points
        const blockPreserved = blockResult.points.filter(p => p.completed).length;
        const blockOptimized = blockResult.points.filter(p => !p.completed).length;
        
        preservedPoints += blockPreserved;
        optimizedPoints += blockOptimized;

        console.log(`✅ [BLOCK OPTIMIZER] Bloco ${i + 1} otimizado: ${blockResult.totalDistance.toFixed(1)}km`);
        
      } catch (error) {
        console.error(`❌ [BLOCK OPTIMIZER] Erro no bloco ${i + 1}:`, error);
        
        // Fallback: manter pontos sem otimização
        const fallbackBlock: OptimizedBlock = {
          blockId: i,
          points: block.points.map((p, idx) => ({ ...p, order: idx })),
          totalDistance: 0,
          totalDuration: 0,
          polyline: ''
        };
        
        optimizedBlocks.push(fallbackBlock);
        optimizedPoints += block.points.length;
      }
    }

    // Reorder all points globally
    const finalPoints = this.reorderGlobalPoints(optimizedBlocks);

    console.log(`✅ [BLOCK OPTIMIZER] Otimização por blocos concluída`);
    console.log(`📊 [BLOCK OPTIMIZER] ${optimizedBlocks.length} blocos, ${finalPoints.length} pontos`);
    console.log(`📊 [BLOCK OPTIMIZER] ${preservedPoints} preservados, ${optimizedPoints} otimizados`);
    console.log(`📊 [BLOCK OPTIMIZER] Distância total: ${totalDistance.toFixed(1)}km`);
    console.log(`🧩 [BLOCK OPTIMIZER] ========================================`);

    return {
      optimizedBlocks,
      totalDistance,
      totalDuration,
      totalPoints: finalPoints.length,
      preservedPoints,
      optimizedPoints
    };
  }

  private async divideIntoSmartBlocks(points: Point[]): Promise<{ blockId: number; points: Point[] }[]> {
    console.log(`🎯 [BLOCK OPTIMIZER] Dividindo ${points.length} pontos em blocos inteligentes`);
    
    // Separar pontos concluídos e pendentes
    const completedPoints = points.filter(p => p.completed).sort((a, b) => a.order - b.order);
    const pendingPoints = points.filter(p => !p.completed);
    
    console.log(`🔒 [BLOCK OPTIMIZER] ${completedPoints.length} pontos concluídos (preservados)`);
    console.log(`🎯 [BLOCK OPTIMIZER] ${pendingPoints.length} pontos pendentes para otimizar`);

    const blocks: { blockId: number; points: Point[] }[] = [];

    // Bloco 1: Pontos concluídos (sempre preservados)
    if (completedPoints.length > 0) {
      blocks.push({
        blockId: 0,
        points: completedPoints
      });
      console.log(`📦 [BLOCK OPTIMIZER] Bloco 1 (preservado): ${completedPoints.length} pontos`);
    }

    // Se não há pontos pendentes, retornar apenas o bloco preservado
    if (pendingPoints.length === 0) {
      return blocks;
    }

    // Clusterização geográfica dos pontos pendentes
    let clusters;
    if (pendingPoints.length > this.MAX_POINTS_PER_BLOCK) {
      console.log(`🌐 [BLOCK OPTIMIZER] Aplicando clusterização geográfica aos pontos pendentes`);
      clusters = await geoClusterService.clusterPoints(pendingPoints, this.MAX_POINTS_PER_BLOCK);
      
      // Otimizar ordem dos clusters baseado na proximidade
      const lastCompletedPoint = completedPoints.length > 0 ? completedPoints[completedPoints.length - 1] : null;
      clusters = geoClusterService.optimizeClusterOrder(clusters, lastCompletedPoint);
    } else {
      // Criar um único cluster para poucos pontos
      clusters = [{
        id: 0,
        points: pendingPoints,
        centroid: { lat: 0, lng: 0 }
      }];
    }

    // Converter clusters em blocos
    clusters.forEach((cluster, index) => {
      blocks.push({
        blockId: blocks.length,
        points: cluster.points
      });
      console.log(`📦 [BLOCK OPTIMIZER] Bloco ${blocks.length} (cluster ${index + 1}): ${cluster.points.length} pontos`);
    });

    return blocks;
  }

  private async optimizeBlock(
    block: { blockId: number; points: Point[] },
    blockIndex: number
  ): Promise<OptimizedBlock> {
    const { blockId, points } = block;
    
    // Se o bloco tem apenas pontos concluídos, preservar ordem
    if (points.every(p => p.completed)) {
      console.log(`🔒 [BLOCK OPTIMIZER] Bloco ${blockId} preservado (todos concluídos)`);
      return {
        blockId,
        points: points.map((p, idx) => ({ ...p, order: idx })),
        totalDistance: 0,
        totalDuration: 0,
        polyline: ''
      };
    }

    // Se tem poucos pontos, otimizar diretamente
    if (points.length <= 2) {
      console.log(`📍 [BLOCK OPTIMIZER] Bloco ${blockId} simples (${points.length} pontos)`);
      return {
        blockId,
        points: points.map((p, idx) => ({ ...p, order: idx })),
        totalDistance: 0,
        totalDuration: 0,
        polyline: ''
      };
    }

    // Otimizar com Google Maps API
    console.log(`🚀 [BLOCK OPTIMIZER] Otimizando bloco ${blockId} com Google Maps`);
    
    const optimizationResult = await googleMapsOptimizer.optimizeRouteWithGoogleAPIs(
      points.map(p => ({
        id: p.id,
        address: p.address,
        lat: p.lat,
        lng: p.lng,
        order: p.order,
        type: p.type || 'waypoint',
        completed: p.completed,
        completedAt: p.completedAt
      }))
    );

    return {
      blockId,
      points: optimizationResult.optimizedPoints.map(p => ({
        ...p,
        cep: points.find(orig => orig.id === p.id)?.cep || ''
      })),
      totalDistance: optimizationResult.totalDistance,
      totalDuration: optimizationResult.totalDuration,
      polyline: optimizationResult.polyline
    };
  }

  private async optimizeSingleBlock(points: Point[]): Promise<BlockOptimizationResult> {
    console.log(`📦 [BLOCK OPTIMIZER] Otimização de bloco único (${points.length} pontos)`);
    
    try {
      const optimizationResult = await googleMapsOptimizer.optimizeRouteWithGoogleAPIs(
        points.map(p => ({
          id: p.id,
          address: p.address,
          lat: p.lat,
          lng: p.lng,
          order: p.order,
          type: p.type || 'waypoint',
          completed: p.completed,
          completedAt: p.completedAt
        }))
      );

      const optimizedBlock: OptimizedBlock = {
        blockId: 0,
        points: optimizationResult.optimizedPoints.map(p => ({
          ...p,
          cep: points.find(orig => orig.id === p.id)?.cep || ''
        })),
        totalDistance: optimizationResult.totalDistance,
        totalDuration: optimizationResult.totalDuration,
        polyline: optimizationResult.polyline
      };

      const preservedPoints = optimizedBlock.points.filter(p => p.completed).length;
      const optimizedPoints = optimizedBlock.points.filter(p => !p.completed).length;

      return {
        optimizedBlocks: [optimizedBlock],
        totalDistance: optimizationResult.totalDistance,
        totalDuration: optimizationResult.totalDuration,
        totalPoints: points.length,
        preservedPoints,
        optimizedPoints
      };
      
    } catch (error) {
      console.error(`❌ [BLOCK OPTIMIZER] Erro na otimização simples:`, error);
      
      // Fallback: retornar pontos sem otimização
      const fallbackBlock: OptimizedBlock = {
        blockId: 0,
        points: points.map((p, idx) => ({ ...p, order: idx })),
        totalDistance: 0,
        totalDuration: 0,
        polyline: ''
      };

      return {
        optimizedBlocks: [fallbackBlock],
        totalDistance: 0,
        totalDuration: 0,
        totalPoints: points.length,
        preservedPoints: points.filter(p => p.completed).length,
        optimizedPoints: points.filter(p => !p.completed).length
      };
    }
  }

  private reorderGlobalPoints(optimizedBlocks: OptimizedBlock[]): Point[] {
    const allPoints: Point[] = [];
    let globalOrder = 0;

    for (const block of optimizedBlocks) {
      for (const point of block.points) {
        allPoints.push({
          ...point,
          order: globalOrder++
        });
      }
    }

    return allPoints;
  }
}

export const blockOptimizerService = new BlockOptimizerService();
