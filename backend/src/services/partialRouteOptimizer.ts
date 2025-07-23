
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
  cep?: string;
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
    const startTime = Date.now();
    console.log(`🧠 [PARTIAL OPTIMIZER] ===== INICIANDO OTIMIZAÇÃO INTELIGENTE =====`);
    console.log(`🧠 [PARTIAL OPTIMIZER] Total de pontos recebidos: ${allPoints.length}`);
    console.log(`🧠 [PARTIAL OPTIMIZER] Timestamp: ${new Date().toISOString()}`);
    
    try {
      // ✅ SEPARAR PONTOS CONCLUÍDOS DOS PENDENTES
      const completedPoints = allPoints
        .filter(p => p.completed === true)
        .sort((a, b) => a.order - b.order);
      
      const pendingPoints = allPoints
        .filter(p => p.completed !== true)
        .sort((a, b) => a.order - b.order);
      
      console.log(`✅ [PARTIAL OPTIMIZER] Pontos concluídos (preservados): ${completedPoints.length}`);
      console.log(`⏳ [PARTIAL OPTIMIZER] Pontos pendentes (para otimizar): ${pendingPoints.length}`);
      
      // ✅ CENÁRIO 1: TODOS OS PONTOS JÁ CONCLUÍDOS
      if (pendingPoints.length === 0) {
        console.log(`🎉 [PARTIAL OPTIMIZER] Todos os pontos já foram concluídos!`);
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
      
      // ✅ CENÁRIO 2: APENAS 1 PONTO PENDENTE
      if (pendingPoints.length === 1) {
        console.log(`📍 [PARTIAL OPTIMIZER] Apenas 1 ponto pendente - adicionando ao final dos concluídos`);
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
      
      // ✅ CENÁRIO 3: MÚLTIPLOS PONTOS PENDENTES - OTIMIZAR
      console.log(`🔄 [PARTIAL OPTIMIZER] Otimizando ${pendingPoints.length} pontos pendentes...`);
      
      let pointsToOptimize = [...pendingPoints];
      
      // Se há pontos concluídos, usar o último como ponto de partida
      if (completedPoints.length > 0) {
        const lastCompleted = completedPoints[completedPoints.length - 1];
        console.log(`🎯 [PARTIAL OPTIMIZER] Usando último ponto concluído como origem: ${lastCompleted.address}`);
        
        // Adicionar o último ponto concluído como origem para continuidade
        pointsToOptimize = [
          { ...lastCompleted, type: 'origin' as const },
          ...pendingPoints.map(p => ({ ...p, type: 'waypoint' as const }))
        ];
        
        // Marcar o último ponto como destino se necessário
        if (pointsToOptimize.length > 2) {
          pointsToOptimize[pointsToOptimize.length - 1].type = 'destination';
        }
      } else {
        console.log(`🔄 [PARTIAL OPTIMIZER] Nenhum ponto concluído - otimizando todos os pendentes`);
        // Configurar tipos apropriados para otimização
        if (pointsToOptimize.length >= 2) {
          pointsToOptimize[0].type = 'origin';
          pointsToOptimize[pointsToOptimize.length - 1].type = 'destination';
        }
      }
      
      // ✅ CHAMAR O GOOGLE MAPS OPTIMIZER
      console.log(`📡 [PARTIAL OPTIMIZER] Chamando Google Maps Optimizer com ${pointsToOptimize.length} pontos...`);
      const optimizationResult = await googleMapsOptimizer.optimizeRouteWithGoogleAPIs(pointsToOptimize);
      console.log(`✅ [PARTIAL OPTIMIZER] Google Maps Optimizer retornou resultado com sucesso`);
      
      // ✅ COMBINAR RESULTADOS: PRESERVAR CONCLUÍDOS + ADICIONAR OTIMIZADOS
      let finalPoints: OptimizationPoint[];
      
      if (completedPoints.length > 0) {
        // Remover o ponto de referência (último concluído) do resultado da otimização
        const optimizedWithoutReference = optimizationResult.optimizedPoints.slice(1);
        
        finalPoints = [
          ...completedPoints, // Preservar todos os pontos concluídos na ordem original
          ...optimizedWithoutReference.map((p, index) => ({
            ...p,
            order: completedPoints.length + index,
            completed: false, // Marcar como não concluído
            completedAt: null
          }))
        ];
        
        console.log(`🔗 [PARTIAL OPTIMIZER] Combinados: ${completedPoints.length} preservados + ${optimizedWithoutReference.length} otimizados`);
      } else {
        finalPoints = optimizationResult.optimizedPoints.map((p, index) => ({
          ...p,
          order: index,
          completed: false,
          completedAt: null
        }));
        
        console.log(`🔗 [PARTIAL OPTIMIZER] Todos os ${finalPoints.length} pontos foram otimizados (nenhum preservado)`);
      }
      
      const processingTime = Date.now() - startTime;
      
      const result = {
        optimizedPoints: finalPoints,
        totalDistance: optimizationResult.totalDistance,
        totalDuration: optimizationResult.totalDuration,
        polyline: optimizationResult.polyline || '',
        optimizedOrder: finalPoints.map(p => p.id),
        preservedPoints: completedPoints.length,
        optimizedPointsCount: pendingPoints.length
      };
      
      console.log(`✅✅✅ [PARTIAL OPTIMIZER] OTIMIZAÇÃO CONCLUÍDA COM SUCESSO!`);
      console.log(`   📊 Pontos preservados: ${result.preservedPoints}`);
      console.log(`   📊 Pontos otimizados: ${result.optimizedPointsCount}`);
      console.log(`   📊 Total final: ${result.optimizedPoints.length}`);
      console.log(`   📊 Distância: ${result.totalDistance}km`);
      console.log(`   📊 Duração: ${Math.round(result.totalDuration / 60)}min`);
      console.log(`   📊 Tempo de processamento: ${processingTime}ms`);
      console.log(`🧠 [PARTIAL OPTIMIZER] ===== OTIMIZAÇÃO INTELIGENTE FINALIZADA =====`);
      
      return result;
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error('❌❌❌ [PARTIAL OPTIMIZER] ERRO NA OTIMIZAÇÃO:');
      console.error(`   💥 Erro: ${error.message}`);
      console.error(`   💥 Stack: ${error.stack}`);
      console.error(`   💥 Tempo até o erro: ${processingTime}ms`);
      
      // ✅ FALLBACK ROBUSTO: MANTER ORDEM ATUAL
      console.log(`🔄 [PARTIAL OPTIMIZER] Aplicando fallback - mantendo ordem atual`);
      
      const completedPoints = allPoints.filter(p => p.completed === true).sort((a, b) => a.order - b.order);
      const pendingPoints = allPoints.filter(p => p.completed !== true).sort((a, b) => a.order - b.order);
      
      const fallbackPoints = [
        ...completedPoints,
        ...pendingPoints.map((p, index) => ({
          ...p,
          order: completedPoints.length + index,
          completed: false,
          completedAt: null
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
  
  // ✅ CÁLCULO DE DISTÂNCIA MELHORADO
  private static calculateDistance(points: OptimizationPoint[]): number {
    if (points.length < 2) return 0;
    
    let totalDistance = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const distance = this.haversineDistance(points[i], points[i + 1]);
      totalDistance += distance;
    }
    
    return Math.round(totalDistance * 100) / 100; // Arredondar para 2 casas decimais
  }
  
  // ✅ FÓRMULA HAVERSINE PARA DISTÂNCIA ENTRE COORDENADAS
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
