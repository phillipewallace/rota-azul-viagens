
import { geoClusterService } from './geoCluster';

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

interface OptimizationResult {
  optimizedPoints: OptimizationPoint[];
  totalDistance: number;
  totalDuration: number;
  polyline: string;
  optimizedOrder: string[];
}

class GoogleMapsOptimizer {
  private apiKey = 'AIzaSyAbITueefJWwTTyXO-9Nz9pgzbgKZ5sV9w';
  private readonly ROUTES_API_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';
  private readonly MAX_WAYPOINTS = 25;

  /**
   * ✅ NOVA IMPLEMENTAÇÃO: Otimização inteligente com clusterização geográfica
   */
  async optimizeRouteWithGoogleAPIs(points: OptimizationPoint[]): Promise<OptimizationResult> {
    console.log(`🎯 [OPTIMIZER V3] Iniciando otimização inteligente com ${points.length} pontos`);
    
    if (points.length < 2) {
      throw new Error('Necessário pelo menos 2 pontos para otimizar');
    }

    // Para rotas pequenas, usar otimização direta
    if (points.length <= this.MAX_WAYPOINTS) {
      console.log(`🚀 [OPTIMIZER V3] Rota pequena (${points.length} pontos) - otimização direta`);
      return await this.optimizeDirectRoute(points);
    }

    // Para rotas grandes, usar clusterização geográfica
    console.log(`🌍 [OPTIMIZER V3] Rota grande (${points.length} pontos) - usando clusterização`);
    return await this.optimizeWithClustering(points);
  }

  /**
   * ✅ NOVA IMPLEMENTAÇÃO: Otimização com clusterização geográfica
   */
  private async optimizeWithClustering(points: OptimizationPoint[]): Promise<OptimizationResult> {
    try {
      // 1. Clusterizar pontos geograficamente
      console.log(`🎯 [OPTIMIZER V3] Iniciando clusterização geográfica`);
      const clusters = await geoClusterService.clusterizePoints(points);
      
      console.log(`📊 [OPTIMIZER V3] Criados ${clusters.length} clusters`);
      clusters.forEach((cluster, index) => {
        console.log(`   Cluster ${index + 1}: ${cluster.points.length} pontos`);
      });

      // 2. Otimizar cada cluster individualmente
      const optimizedClusters = [];
      let totalDistance = 0;
      let totalDuration = 0;
      let combinedPolyline = '';

      for (let i = 0; i < clusters.length; i++) {
        const cluster = clusters[i];
        console.log(`🔄 [OPTIMIZER V3] Otimizando cluster ${i + 1}/${clusters.length} (${cluster.points.length} pontos)`);
        
        try {
          // Otimizar cluster usando Routes API v2
          const clusterResult = await this.optimizeDirectRoute(cluster.points);
          
          optimizedClusters.push({
            cluster: cluster,
            result: clusterResult
          });

          totalDistance += clusterResult.totalDistance;
          totalDuration += clusterResult.totalDuration;
          
          if (clusterResult.polyline) {
            combinedPolyline += clusterResult.polyline;
          }

          console.log(`✅ [OPTIMIZER V3] Cluster ${i + 1} otimizado: ${clusterResult.totalDistance.toFixed(1)}km`);
          
        } catch (error) {
          console.error(`❌ [OPTIMIZER V3] Erro no cluster ${i + 1}:`, error);
          
          // Fallback: usar ordem original do cluster
          optimizedClusters.push({
            cluster: cluster,
            result: {
              optimizedPoints: cluster.points.map((p, index) => ({ ...p, order: index })),
              totalDistance: 0,
              totalDuration: 0,
              polyline: '',
              optimizedOrder: cluster.points.map(p => p.id)
            }
          });
        }
      }

      // 3. Conectar clusters de forma inteligente
      console.log(`🔗 [OPTIMIZER V3] Conectando ${optimizedClusters.length} clusters`);
      const finalOptimizedPoints = await this.connectClusters(optimizedClusters);
      
      console.log(`✅ [OPTIMIZER V3] Otimização com clusterização concluída: ${finalOptimizedPoints.length} pontos, ${totalDistance.toFixed(1)}km`);

      return {
        optimizedPoints: finalOptimizedPoints,
        totalDistance,
        totalDuration,
        polyline: combinedPolyline,
        optimizedOrder: finalOptimizedPoints.map(p => p.id)
      };

    } catch (error) {
      console.error('❌ [OPTIMIZER V3] Erro na otimização com clusterização:', error);
      
      // Fallback: retornar pontos na ordem original
      return {
        optimizedPoints: points.map((p, index) => ({ ...p, order: index })),
        totalDistance: 0,
        totalDuration: 0,
        polyline: '',
        optimizedOrder: points.map(p => p.id)
      };
    }
  }

  /**
   * ✅ NOVA IMPLEMENTAÇÃO: Conecta clusters de forma inteligente
   */
  private async connectClusters(optimizedClusters: any[]): Promise<OptimizationPoint[]> {
    let finalPoints: OptimizationPoint[] = [];
    let currentOrder = 0;

    // Ordenar clusters por proximidade geográfica
    const orderedClusters = this.orderClustersByProximity(optimizedClusters);
    
    console.log(`🔗 [OPTIMIZER V3] Conectando clusters na ordem otimizada`);

    for (const { result } of orderedClusters) {
      // Adicionar pontos do cluster com ordem sequencial
      const clusterPoints = result.optimizedPoints.map((point: OptimizationPoint) => ({
        ...point,
        order: currentOrder++
      }));
      
      finalPoints.push(...clusterPoints);
    }

    return finalPoints;
  }

  /**
   * ✅ NOVA IMPLEMENTAÇÃO: Ordena clusters por proximidade geográfica
   */
  private orderClustersByProximity(clusters: any[]): any[] {
    if (clusters.length <= 1) return clusters;

    const ordered = [];
    const remaining = [...clusters];
    
    // Começar com o cluster que contém o ponto de origem
    let currentCluster = remaining.find(c => 
      c.cluster.points.some((p: OptimizationPoint) => p.type === 'origin')
    ) || remaining[0];
    
    ordered.push(currentCluster);
    remaining.splice(remaining.indexOf(currentCluster), 1);

    // Ordenar clusters restantes por proximidade
    while (remaining.length > 0) {
      const currentCentroid = currentCluster.cluster.centroid;
      
      let closestCluster = remaining[0];
      let minDistance = this.calculateDistance(currentCentroid, closestCluster.cluster.centroid);
      
      for (const cluster of remaining) {
        const distance = this.calculateDistance(currentCentroid, cluster.cluster.centroid);
        if (distance < minDistance) {
          minDistance = distance;
          closestCluster = cluster;
        }
      }
      
      ordered.push(closestCluster);
      remaining.splice(remaining.indexOf(closestCluster), 1);
      currentCluster = closestCluster;
    }

    return ordered;
  }

  /**
   * ✅ OTIMIZAÇÃO DIRETA: Para rotas <= 25 pontos
   */
  private async optimizeDirectRoute(points: OptimizationPoint[]): Promise<OptimizationResult> {
    const origin = points.find(p => p.type === 'origin') || points[0];
    const destination = points.find(p => p.type === 'destination') || points[points.length - 1];
    const waypoints = points.filter(p => 
      p.type === 'waypoint' || (p.id !== origin.id && p.id !== destination.id)
    );

    // Limitar waypoints a 25 (máximo da API)
    const limitedWaypoints = waypoints.slice(0, this.MAX_WAYPOINTS);

    const requestBody = {
      origin: {
        location: {
          latLng: {
            latitude: origin.lat,
            longitude: origin.lng
          }
        }
      },
      destination: {
        location: {
          latLng: {
            latitude: destination.lat,
            longitude: destination.lng
          }
        }
      },
      intermediates: limitedWaypoints.map(wp => ({
        location: {
          latLng: {
            latitude: wp.lat,
            longitude: wp.lng
          }
        }
      })),
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_UNAWARE',
      optimizeWaypointOrder: true,
      computeAlternativeRoutes: false,
      languageCode: 'pt-BR',
      units: 'METRIC'
    };

    const response = await fetch(this.ROUTES_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': this.apiKey,
        'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.optimizedIntermediateWaypointIndex'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Routes API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.routes?.length) {
      throw new Error('Nenhuma rota encontrada');
    }

    const route = data.routes[0];
    let optimizedPoints = [{ ...origin, order: 0, type: 'origin' as const }];

    // Reordenar waypoints conforme otimização
    if (route.optimizedIntermediateWaypointIndex && limitedWaypoints.length > 0) {
      const reorderedWaypoints = route.optimizedIntermediateWaypointIndex
        .map((index: number, newOrder: number) => ({
          ...limitedWaypoints[index],
          order: newOrder + 1,
          type: 'waypoint' as const
        }));
      optimizedPoints.push(...reorderedWaypoints);
    }

    // Adicionar destino
    optimizedPoints.push({
      ...destination,
      order: optimizedPoints.length,
      type: 'destination' as const
    });

    const totalDistance = route.distanceMeters / 1000;
    const totalDuration = parseInt(route.duration?.replace('s', '') || '0');

    return {
      optimizedPoints,
      totalDistance,
      totalDuration,
      polyline: route.polyline?.encodedPolyline || '',
      optimizedOrder: optimizedPoints.map(p => p.id)
    };
  }

  /**
   * ✅ OTIMIZAÇÃO PARCIAL INTELIGENTE: Preserva pontos concluídos
   */
  async optimizePartialRoute(
    completedPoints: OptimizationPoint[], 
    remainingPoints: OptimizationPoint[]
  ): Promise<OptimizationResult> {
    console.log(`🎯 [OPTIMIZER V3] Otimização parcial inteligente - ${completedPoints.length} concluídos, ${remainingPoints.length} pendentes`);
    
    if (remainingPoints.length === 0) {
      return {
        optimizedPoints: completedPoints,
        totalDistance: 0,
        totalDuration: 0,
        polyline: '',
        optimizedOrder: completedPoints.map(p => p.id)
      };
    }

    try {
      // Usar último ponto concluído como origem para otimização
      const lastCompletedPoint = completedPoints[completedPoints.length - 1];
      
      // Criar lista para otimização: último concluído + pontos pendentes
      const pointsToOptimize = [
        { ...lastCompletedPoint, type: 'origin' as const },
        ...remainingPoints.slice(0, -1).map(p => ({ ...p, type: 'waypoint' as const })),
        { ...remainingPoints[remainingPoints.length - 1], type: 'destination' as const }
      ];

      // Usar a otimização inteligente (com clusterização se necessário)
      const optimizationResult = await this.optimizeRouteWithGoogleAPIs(pointsToOptimize);
      
      // Combinar pontos concluídos + pontos otimizados
      const finalPoints = [
        ...completedPoints.slice(0, -1),
        ...optimizationResult.optimizedPoints.map((p, index) => ({
          ...p,
          order: completedPoints.length - 1 + index,
          completed: index === 0 ? true : false
        }))
      ];

      console.log(`✅ [OPTIMIZER V3] Otimização parcial inteligente concluída - ${finalPoints.length} pontos finais`);

      return {
        optimizedPoints: finalPoints,
        totalDistance: optimizationResult.totalDistance,
        totalDuration: optimizationResult.totalDuration,
        polyline: optimizationResult.polyline,
        optimizedOrder: finalPoints.map(p => p.id)
      };
      
    } catch (error) {
      console.error('❌ [OPTIMIZER V3] Erro na otimização parcial inteligente:', error);
      
      // Fallback: manter ordem atual
      const fallbackPoints = [
        ...completedPoints,
        ...remainingPoints.map((p, index) => ({
          ...p,
          order: completedPoints.length + index,
          completed: false
        }))
      ];
      
      return {
        optimizedPoints: fallbackPoints,
        totalDistance: 0,
        totalDuration: 0,
        polyline: '',
        optimizedOrder: fallbackPoints.map(p => p.id)
      };
    }
  }

  /**
   * ✅ FUNÇÃO AUXILIAR: Calcula distância entre dois pontos
   */
  private calculateDistance(point1: { lat: number; lng: number }, point2: { lat: number; lng: number }): number {
    const R = 6371; // Raio da Terra em km
    const dLat = this.toRadians(point2.lat - point1.lat);
    const dLng = this.toRadians(point2.lng - point1.lng);
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
             Math.cos(this.toRadians(point1.lat)) * Math.cos(this.toRadians(point2.lat)) *
             Math.sin(dLng/2) * Math.sin(dLng/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}

export const googleMapsOptimizer = new GoogleMapsOptimizer();
