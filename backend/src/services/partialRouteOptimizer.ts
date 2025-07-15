
import { googleMapsOptimizer } from './googleMapsOptimizer';

interface OptimizationPoint {
  id: string;
  address: string;
  lat: number;
  lng: number;
  order: number;
  type: 'origin' | 'destination' | 'waypoint';
  completed?: boolean;
  completedAt?: string;
}

interface PartialOptimizationResult {
  optimizedPoints: OptimizationPoint[];
  totalDistance: number;
  totalDuration: number;
  polyline: string;
  optimizedOrder: string[];
  preservedPoints: number;
  optimizedPointsCount: number;
}

export class PartialRouteOptimizer {
  static async optimizeWithPreservation(
    allPoints: OptimizationPoint[]
  ): Promise<PartialOptimizationResult> {
    console.log(`🧠 [PARTIAL OPTIMIZER] Iniciando otimização com preservação - ${allPoints.length} pontos totais`);
    
    // Separar pontos concluídos dos pendentes
    const completedPoints = allPoints
      .filter(p => p.completed === true)
      .sort((a, b) => a.order - b.order);
    
    const pendingPoints = allPoints
      .filter(p => p.completed !== true)
      .sort((a, b) => a.order - b.order);
    
    console.log(`✅ [PARTIAL OPTIMIZER] ${completedPoints.length} pontos preservados`);
    console.log(`⏳ [PARTIAL OPTIMIZER] ${pendingPoints.length} pontos para otimizar`);
    
    // Se não há pontos pendentes, retornar os concluídos
    if (pendingPoints.length === 0) {
      console.log(`🎉 [PARTIAL OPTIMIZER] Todos os pontos já concluídos!`);
      return {
        optimizedPoints: completedPoints,
        totalDistance: this.calculateDistance(completedPoints),
        totalDuration: completedPoints.length * 600, // 10min por ponto
        polyline: '',
        optimizedOrder: completedPoints.map(p => p.id),
        preservedPoints: completedPoints.length,
        optimizedPointsCount: 0
      };
    }
    
    // Se há apenas 1 ponto pendente, apenas adicionar ao final
    if (pendingPoints.length === 1) {
      console.log(`📍 [PARTIAL OPTIMIZER] Apenas 1 ponto pendente - adicionando ao final`);
      const finalPoints = [
        ...completedPoints,
        { ...pendingPoints[0], order: completedPoints.length }
      ];
      
      return {
        optimizedPoints: finalPoints,
        totalDistance: this.calculateDistance(finalPoints),
        totalDuration: finalPoints.length * 600,
        polyline: '',
        optimizedOrder: finalPoints.map(p => p.id),
        preservedPoints: completedPoints.length,
        optimizedPointsCount: 1
      };
    }
    
    // Otimizar pontos pendentes a partir do último concluído
    try {
      let pointsToOptimize = pendingPoints;
      
      // Se há pontos concluídos, usar o último como origem
      if (completedPoints.length > 0) {
        const lastCompleted = completedPoints[completedPoints.length - 1];
        pointsToOptimize = [
          { ...lastCompleted, type: 'origin' as const },
          ...pendingPoints.slice(0, -1).map(p => ({ ...p, type: 'waypoint' as const })),
          { ...pendingPoints[pendingPoints.length - 1], type: 'destination' as const }
        ];
        
        console.log(`🚀 [PARTIAL OPTIMIZER] Otimizando ${pointsToOptimize.length} pontos a partir do último concluído`);
      } else {
        console.log(`🔄 [PARTIAL OPTIMIZER] Otimizando ${pointsToOptimize.length} pontos sem referência`);
      }
      
      const optimizationResult = await googleMapsOptimizer.optimizeRouteWithGoogleAPIs(pointsToOptimize);
      
      // Combinar resultados: pontos concluídos + pontos otimizados
      let finalPoints: OptimizationPoint[];
      
      if (completedPoints.length > 0) {
        // Remover o ponto de referência (último concluído) do resultado da otimização
        const optimizedWithoutReference = optimizationResult.optimizedPoints.slice(1);
        
        finalPoints = [
          ...completedPoints,
          ...optimizedWithoutReference.map((p, index) => ({
            ...p,
            order: completedPoints.length + index,
            completed: false
          }))
        ];
      } else {
        finalPoints = optimizationResult.optimizedPoints.map((p, index) => ({
          ...p,
          order: index,
          completed: false
        }));
      }
      
      console.log(`✅ [PARTIAL OPTIMIZER] Otimização concluída - ${finalPoints.length} pontos finais`);
      
      return {
        optimizedPoints: finalPoints,
        totalDistance: optimizationResult.totalDistance,
        totalDuration: optimizationResult.totalDuration,
        polyline: optimizationResult.polyline,
        optimizedOrder: finalPoints.map(p => p.id),
        preservedPoints: completedPoints.length,
        optimizedPointsCount: pendingPoints.length
      };
      
    } catch (error) {
      console.error('❌ [PARTIAL OPTIMIZER] Erro na otimização:', error);
      
      // Fallback: manter ordem atual
      const fallbackPoints = [
        ...completedPoints,
        ...pendingPoints.map((p, index) => ({
          ...p,
          order: completedPoints.length + index,
          completed: false
        }))
      ];
      
      return {
        optimizedPoints: fallbackPoints,
        totalDistance: this.calculateDistance(fallbackPoints),
        totalDuration: fallbackPoints.length * 600,
        polyline: '',
        optimizedOrder: fallbackPoints.map(p => p.id),
        preservedPoints: completedPoints.length,
        optimizedPointsCount: pendingPoints.length
      };
    }
  }
  
  private static calculateDistance(points: OptimizationPoint[]): number {
    if (points.length < 2) return 0;
    
    let total = 0;
    for (let i = 0; i < points.length - 1; i++) {
      total += this.haversineDistance(points[i], points[i + 1]);
    }
    return Math.round(total * 100) / 100;
  }
  
  private static haversineDistance(point1: OptimizationPoint, point2: OptimizationPoint): number {
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
}
