
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
  private readonly MAX_INTERMEDIATES = 25; // Routes API v2 limit

  async optimizeRouteWithGoogleAPIs(points: OptimizationPoint[]): Promise<OptimizationResult> {
    console.log(`🎯 [OPTIMIZER V2] Otimizando ${points.length} pontos com Routes API v2`);
    
    if (points.length < 2) {
      throw new Error('Necessário pelo menos 2 pontos para otimizar');
    }

    // Para rotas simples (2 pontos)
    if (points.length === 2) {
      return await this.optimizeTwoPointRoute(points);
    }

    // Para rotas com muitos pontos, dividir em segmentos
    if (points.length > this.MAX_INTERMEDIATES + 2) {
      console.log(`📊 [OPTIMIZER V2] Rota grande (${points.length} pontos) - processando em segmentos`);
      return await this.handleLargeRouteV2(points);
    }

    // Para rotas normais, usar Routes API v2 diretamente
    return await this.optimizeWithRoutesAPIv2(points);
  }

  private async optimizeTwoPointRoute(points: OptimizationPoint[]): Promise<OptimizationResult> {
    const [origin, destination] = points;
    
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
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_UNAWARE',
      computeAlternativeRoutes: false,
      languageCode: 'pt-BR',
      units: 'METRIC'
    };

    try {
      const response = await fetch(this.ROUTES_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.apiKey,
          'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [OPTIMIZER V2] Routes API error:`, errorText);
        throw new Error(`Routes API v2 error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.routes?.length) {
        throw new Error('Nenhuma rota encontrada');
      }

      const route = data.routes[0];
      const totalDistance = route.distanceMeters / 1000;
      const totalDuration = parseInt(route.duration?.replace('s', '') || '0');

      return {
        optimizedPoints: [
          { ...origin, order: 0, type: 'origin' },
          { ...destination, order: 1, type: 'destination' }
        ],
        totalDistance,
        totalDuration,
        polyline: route.polyline?.encodedPolyline || '',
        optimizedOrder: [origin.id, destination.id]
      };

    } catch (error) {
      console.error('❌ [OPTIMIZER V2] Erro na otimização 2 pontos:', error);
      throw error;
    }
  }

  private async optimizeWithRoutesAPIv2(points: OptimizationPoint[]): Promise<OptimizationResult> {
    const origin = points.find(p => p.type === 'origin') || points[0];
    const destination = points.find(p => p.type === 'destination') || points[points.length - 1];
    const waypoints = points.filter(p => 
      p.type === 'waypoint' || (p.id !== origin.id && p.id !== destination.id)
    );

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
      intermediates: waypoints.slice(0, this.MAX_INTERMEDIATES).map(wp => ({
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

    try {
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
        const errorText = await response.text();
        console.error(`❌ [OPTIMIZER V2] Routes API error:`, errorText);
        throw new Error(`Routes API v2 error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.routes?.length) {
        throw new Error('Nenhuma rota encontrada');
      }

      const route = data.routes[0];
      let optimizedPoints = [{ ...origin, order: 0, type: 'origin' as const }];

      // Reordenar waypoints conforme otimização do Google
      if (route.optimizedIntermediateWaypointIndex && waypoints.length > 0) {
        const reorderedWaypoints = route.optimizedIntermediateWaypointIndex
          .slice(0, Math.min(route.optimizedIntermediateWaypointIndex.length, waypoints.length))
          .map((index: number, newOrder: number) => ({
            ...waypoints[index],
            order: newOrder + 1,
            type: 'waypoint' as const
          }));
        optimizedPoints.push(...reorderedWaypoints);
      } else {
        optimizedPoints.push(
          ...waypoints.map((wp, index) => ({
            ...wp,
            order: index + 1,
            type: 'waypoint' as const
          }))
        );
      }

      // Adicionar waypoints excedentes que não puderam ser otimizados
      if (waypoints.length > this.MAX_INTERMEDIATES) {
        const excessWaypoints = waypoints.slice(this.MAX_INTERMEDIATES).map((wp, index) => ({
          ...wp,
          order: optimizedPoints.length + index,
          type: 'waypoint' as const
        }));
        optimizedPoints.push(...excessWaypoints);
      }

      // Garantir que o destino seja sempre o último
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

    } catch (error) {
      console.error('❌ [OPTIMIZER V2] Erro na otimização Routes API v2:', error);
      throw error;
    }
  }

  private async handleLargeRouteV2(points: OptimizationPoint[]): Promise<OptimizationResult> {
    console.log(`📊 [OPTIMIZER V2] Processando rota grande com ${points.length} pontos`);
    
    const origin = points.find(p => p.type === 'origin') || points[0];
    const destination = points.find(p => p.type === 'destination') || points[points.length - 1];
    const waypoints = points.filter(p => 
      p.type === 'waypoint' || (p.id !== origin.id && p.id !== destination.id)
    );

    // Dividir waypoints em segmentos
    const segments = this.divideIntoSegments(waypoints, this.MAX_INTERMEDIATES);
    let totalDistance = 0;
    let totalDuration = 0;
    let allOptimizedPoints: OptimizationPoint[] = [];

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const segmentOrigin = i === 0 ? origin : allOptimizedPoints[allOptimizedPoints.length - 1];
      const segmentDestination = i === segments.length - 1 ? destination : segment[segment.length - 1];
      
      const segmentPoints = [
        segmentOrigin,
        ...segment.slice(0, -1),
        segmentDestination
      ];

      try {
        const segmentResult = await this.optimizeWithRoutesAPIv2(segmentPoints);
        
        totalDistance += segmentResult.totalDistance;
        totalDuration += segmentResult.totalDuration;
        
        if (i === 0) {
          allOptimizedPoints.push(...segmentResult.optimizedPoints);
        } else {
          allOptimizedPoints.push(...segmentResult.optimizedPoints.slice(1));
        }
        
        // Pequena pausa para não sobrecarregar a API
        if (i < segments.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
      } catch (error) {
        console.error(`❌ [OPTIMIZER V2] Erro no segmento ${i + 1}:`, error);
        // Continuar com próximo segmento em caso de erro
      }
    }

    // Recalcular ordens
    const finalOptimizedPoints = allOptimizedPoints.map((point, index) => ({
      ...point,
      order: index
    }));

    return {
      optimizedPoints: finalOptimizedPoints,
      totalDistance,
      totalDuration,
      polyline: '',
      optimizedOrder: finalOptimizedPoints.map(p => p.id)
    };
  }

  private divideIntoSegments(waypoints: OptimizationPoint[], maxPerSegment: number): OptimizationPoint[][] {
    const segments: OptimizationPoint[][] = [];
    
    for (let i = 0; i < waypoints.length; i += maxPerSegment) {
      segments.push(waypoints.slice(i, i + maxPerSegment));
    }
    
    return segments;
  }

  // CORRIGIDO: Preservação de pontos concluídos no remapeamento
  async optimizePartialRoute(
    completedPoints: OptimizationPoint[], 
    remainingPoints: OptimizationPoint[]
  ): Promise<OptimizationResult> {
    console.log(`🎯 [OPTIMIZER PARTIAL] Remapeamento preservando ${completedPoints.length} concluídos, otimizando ${remainingPoints.length} restantes`);
    
    if (remainingPoints.length === 0) {
      return {
        optimizedPoints: completedPoints,
        totalDistance: 0,
        totalDuration: 0,
        polyline: '',
        optimizedOrder: completedPoints.map(p => p.id)
      };
    }

    if (remainingPoints.length === 1) {
      const allPoints = [
        ...completedPoints,
        { ...remainingPoints[0], order: completedPoints.length }
      ];
      
      return {
        optimizedPoints: allPoints,
        totalDistance: 0,
        totalDuration: 0,
        polyline: '',
        optimizedOrder: allPoints.map(p => p.id)
      };
    }

    // CHAVE: Usar último ponto concluído como origem para otimização
    const lastCompletedPoint = completedPoints[completedPoints.length - 1];
    
    // Criar nova lista com último concluído como origin, restantes como waypoints/destination
    const pointsToOptimize = [
      { ...lastCompletedPoint, type: 'origin' as const },
      ...remainingPoints.slice(0, -1).map(p => ({ ...p, type: 'waypoint' as const })),
      { ...remainingPoints[remainingPoints.length - 1], type: 'destination' as const }
    ];

    console.log(`🔄 [OPTIMIZER PARTIAL] Otimizando ${pointsToOptimize.length} pontos a partir do último concluído`);

    try {
      const optimizedRemaining = await this.optimizeRouteWithGoogleAPIs(pointsToOptimize);
      
      // Combinar pontos concluídos (exceto o último) + pontos otimizados
      const finalPoints = [
        ...completedPoints.slice(0, -1), // Todos concluídos exceto o último
        ...optimizedRemaining.optimizedPoints.map((p, index) => ({
          ...p,
          order: completedPoints.length - 1 + index,
          completed: index === 0 ? true : false // Primeiro ponto (último concluído) mantém completed=true
        }))
      ];

      console.log(`✅ [OPTIMIZER PARTIAL] Remapeamento concluído: ${finalPoints.filter(p => p.completed).length} preservados, ${finalPoints.filter(p => !p.completed).length} novos`);

      return {
        optimizedPoints: finalPoints,
        totalDistance: optimizedRemaining.totalDistance,
        totalDuration: optimizedRemaining.totalDuration,
        polyline: optimizedRemaining.polyline,
        optimizedOrder: finalPoints.map(p => p.id)
      };
      
    } catch (error) {
      console.error('❌ [OPTIMIZER PARTIAL] Erro no remapeamento:', error);
      
      // Fallback: manter ordem atual
      const fallbackPoints = [
        ...completedPoints,
        ...remainingPoints.map((p, index) => ({
          ...p,
          order: completedPoints.length + index
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
}

export const googleMapsOptimizer = new GoogleMapsOptimizer();
