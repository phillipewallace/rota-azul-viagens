
import { pool } from '../config/database';
import { googleMapsOptimizer } from './googleMapsOptimizer';

interface RoutePoint {
  id: string;
  address: string;
  lat: number;
  lng: number;
  order: number;
  type: string;
  completed: boolean;
  completedAt?: string | null;
  batchOrder?: number;
}

interface BatchOptimizationResult {
  batchId: number;
  points: RoutePoint[];
  totalDistance: number;
  estimatedTime: string;
  optimizedOrder: string[];
}

export class ExtendedRouteOptimizer {
  private static readonly MAX_BATCH_SIZE = 23; // Deixa 2 pontos para origem/destino
  
  static async optimizeExtendedRoute(routeId: string, allPoints: RoutePoint[]): Promise<{
    totalDistance: number;
    estimatedTime: string;
    optimizedOrder: string[];
    points: RoutePoint[];
    batchCount: number;
  }> {
    console.log(`🔢 [EXTENDED OPTIMIZER] Otimizando rota extensa: ${allPoints.length} pontos`);
    
    if (allPoints.length <= 25) {
      console.log(`📝 [EXTENDED OPTIMIZER] Rota pequena, usando otimização normal`);
      return await this.standardOptimization(allPoints);
    }
    
    console.log(`🎯 [EXTENDED OPTIMIZER] Rota extensa detectada - dividindo em lotes`);
    
    // Separar pontos concluídos dos pendentes
    const completedPoints = allPoints.filter(p => p.completed).sort((a, b) => a.order - b.order);
    const pendingPoints = allPoints.filter(p => !p.completed).sort((a, b) => a.order - b.order);
    
    console.log(`✅ [EXTENDED OPTIMIZER] ${completedPoints.length} pontos preservados`);
    console.log(`⏳ [EXTENDED OPTIMIZER] ${pendingPoints.length} pontos para otimizar`);
    
    if (pendingPoints.length === 0) {
      console.log(`🎉 [EXTENDED OPTIMIZER] Todos os pontos concluídos!`);
      return {
        totalDistance: this.calculateTotalDistance(completedPoints),
        estimatedTime: this.formatTime(completedPoints.length * 10), // 10min por ponto
        optimizedOrder: completedPoints.map(p => p.id),
        points: completedPoints,
        batchCount: 0
      };
    }
    
    // Dividir pontos pendentes em lotes
    const batches = this.createBatches(pendingPoints);
    console.log(`📦 [EXTENDED OPTIMIZER] Criados ${batches.length} lotes`);
    
    // Otimizar cada lote
    const optimizedBatches: BatchOptimizationResult[] = [];
    let lastCompletedPoint = completedPoints[completedPoints.length - 1];
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`🚀 [EXTENDED OPTIMIZER] Otimizando lote ${i + 1}/${batches.length} (${batch.length} pontos)`);
      
      try {
        const batchResult = await this.optimizeBatch(
          batch, 
          lastCompletedPoint, 
          i,
          i === batches.length - 1 // é o último lote?
        );
        
        optimizedBatches.push(batchResult);
        
        // Último ponto deste lote vira referência para próximo
        if (batchResult.points.length > 0) {
          lastCompletedPoint = batchResult.points[batchResult.points.length - 1];
        }
        
      } catch (error) {
        console.error(`❌ [EXTENDED OPTIMIZER] Erro no lote ${i + 1}:`, error);
        // Manter ordem original em caso de erro
        optimizedBatches.push({
          batchId: i,
          points: batch.map((p, idx) => ({ ...p, order: completedPoints.length + (i * this.MAX_BATCH_SIZE) + idx })),
          totalDistance: this.calculateTotalDistance(batch),
          estimatedTime: this.formatTime(batch.length * 10),
          optimizedOrder: batch.map(p => p.id)
        });
      }
    }
    
    // Combinar resultados
    const allOptimizedPoints = [
      ...completedPoints,
      ...optimizedBatches.flatMap(b => b.points)
    ];
    
    const totalDistance = completedPoints.length > 0 
      ? this.calculateTotalDistance(allOptimizedPoints)
      : optimizedBatches.reduce((sum, b) => sum + b.totalDistance, 0);
    
    const totalMinutes = allOptimizedPoints.length * 10; // Estimativa simples
    
    console.log(`✅ [EXTENDED OPTIMIZER] Otimização extensa concluída: ${allOptimizedPoints.length} pontos, ${batches.length} lotes`);
    
    return {
      totalDistance,
      estimatedTime: this.formatTime(totalMinutes),
      optimizedOrder: allOptimizedPoints.map(p => p.id),
      points: allOptimizedPoints,
      batchCount: batches.length
    };
  }
  
  private static createBatches(points: RoutePoint[]): RoutePoint[][] {
    const batches: RoutePoint[][] = [];
    
    for (let i = 0; i < points.length; i += this.MAX_BATCH_SIZE) {
      const batch = points.slice(i, i + this.MAX_BATCH_SIZE);
      batches.push(batch);
    }
    
    return batches;
  }
  
  private static async optimizeBatch(
    batch: RoutePoint[], 
    lastPoint: RoutePoint | null, 
    batchIndex: number,
    isLastBatch: boolean
  ): Promise<BatchOptimizationResult> {
    
    // Se há ponto anterior, usar como origem
    const pointsToOptimize = lastPoint ? [lastPoint, ...batch] : batch;
    
    try {
      const result = await googleMapsOptimizer.optimizeRouteWithGoogleAPIs(pointsToOptimize);
      
      // Remover ponto de referência do resultado se existir
      const optimizedPoints = lastPoint 
        ? result.optimizedPoints.filter(p => p.id !== lastPoint.id)
        : result.optimizedPoints;
      
      // Reordenar com base no índice do lote
      const finalPoints = optimizedPoints.map((p, idx) => ({
        ...p,
        order: lastPoint ? lastPoint.order + idx + 1 : batchIndex * this.MAX_BATCH_SIZE + idx,
        batchOrder: batchIndex
      }));
      
      return {
        batchId: batchIndex,
        points: finalPoints,
        totalDistance: result.totalDistance,
        estimatedTime: result.estimatedTime || this.formatTime(finalPoints.length * 10),
        optimizedOrder: finalPoints.map(p => p.id)
      };
      
    } catch (error) {
      console.error(`❌ [EXTENDED OPTIMIZER] Erro na otimização do lote ${batchIndex}:`, error);
      throw error;
    }
  }
  
  private static async standardOptimization(points: RoutePoint[]) {
    console.log(`📝 [EXTENDED OPTIMIZER] Usando otimização padrão`);
    
    const result = await googleMapsOptimizer.optimizeRouteWithGoogleAPIs(points);
    
    return {
      totalDistance: result.totalDistance,
      estimatedTime: result.estimatedTime || this.formatTime(points.length * 10),
      optimizedOrder: result.optimizedOrder,
      points: result.optimizedPoints,
      batchCount: 1
    };
  }
  
  private static calculateTotalDistance(points: RoutePoint[]): number {
    if (points.length < 2) return 0;
    
    let total = 0;
    for (let i = 0; i < points.length - 1; i++) {
      total += this.haversineDistance(points[i], points[i + 1]);
    }
    return total;
  }
  
  private static haversineDistance(point1: RoutePoint, point2: RoutePoint): number {
    const R = 6371; // Raio da Terra em km
    const dLat = this.toRadians(point2.lat - point1.lat);
    const dLng = this.toRadians(point2.lng - point1.lng);
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
             Math.cos(this.toRadians(point1.lat)) * Math.cos(this.toRadians(point2.lat)) *
             Math.sin(dLng/2) * Math.sin(dLng/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
  
  private static toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
  
  private static formatTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    return hours > 0 ? `${hours}h ${mins}min` : `${mins}min`;
  }
}
