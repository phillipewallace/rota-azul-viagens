
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
  private readonly MAX_WAYPOINTS = 25; // ✅ Routes API v2 suporta 25 waypoints intermediários

  async optimizeRouteWithGoogleAPIs(points: OptimizationPoint[]): Promise<OptimizationResult> {
    console.log(`🎯 [OPTIMIZER V2] Otimizando ${points.length} pontos com Routes API v2`);
    
    if (points.length < 2) {
      throw new Error('Necessário pelo menos 2 pontos para otimizar');
    }

    // Para rotas simples (2 pontos)
    if (points.length === 2) {
      return await this.optimizeTwoPointRoute(points);
    }

    // ✅ VERIFICAR SE EXCEDE LIMITE - Para uso com blocos, isso não deve acontecer
    if (points.length > this.MAX_WAYPOINTS + 2) {
      console.log(`⚠️ [OPTIMIZER V2] Rota excede limite de ${this.MAX_WAYPOINTS + 2} pontos, aplicando limite`);
      return await this.optimizeWithLimit(points);
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

    console.log(`🚀 [OPTIMIZER V2] Processando ${waypoints.length} waypoints`);

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
      intermediates: waypoints.map(wp => ({
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
      console.log(`📡 [OPTIMIZER V2] Enviando requisição para Routes API v2`);
      
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
        console.log(`🔄 [OPTIMIZER V2] Reordenando ${waypoints.length} waypoints conforme otimização`);
        
        const reorderedWaypoints = route.optimizedIntermediateWaypointIndex
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

      // Garantir que o destino seja sempre o último
      optimizedPoints.push({
        ...destination,
        order: optimizedPoints.length,
        type: 'destination' as const
      });

      const totalDistance = route.distanceMeters / 1000;
      const totalDuration = parseInt(route.duration?.replace('s', '') || '0');

      console.log(`✅ [OPTIMIZER V2] Otimizada: ${totalDistance.toFixed(1)}km, ${Math.round(totalDuration/60)}min`);

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

  // ✅ MELHORADO: Otimização com limite para casos excepcionais
  private async optimizeWithLimit(points: OptimizationPoint[]): Promise<OptimizationResult> {
    console.log(`⚠️ [OPTIMIZER V2] Aplicando limite de ${this.MAX_WAYPOINTS + 2} pontos`);
    
    const origin = points.find(p => p.type === 'origin') || points[0];
    const destination = points.find(p => p.type === 'destination') || points[points.length - 1];
    const waypoints = points.filter(p => 
      p.type === 'waypoint' || (p.id !== origin.id && p.id !== destination.id)
    );

    // Limitar waypoints
    const limitedWaypoints = waypoints.slice(0, this.MAX_WAYPOINTS);
    const excessWaypoints = waypoints.slice(this.MAX_WAYPOINTS);

    console.log(`📊 [OPTIMIZER V2] Otimizando ${limitedWaypoints.length} waypoints, ${excessWaypoints.length} serão adicionados sem otimização`);

    try {
      // Otimizar apenas os waypoints limitados
      const limitedPoints = [origin, ...limitedWaypoints, destination];
      const optimizationResult = await this.optimizeWithRoutesAPIv2(limitedPoints);

      // Adicionar waypoints excedentes no final
      const finalPoints = [
        ...optimizationResult.optimizedPoints.slice(0, -1), // Todos exceto o destino
        ...excessWaypoints.map((wp, index) => ({
          ...wp,
          order: optimizationResult.optimizedPoints.length - 1 + index,
          type: 'waypoint' as const
        })),
        ...optimizationResult.optimizedPoints.slice(-1) // Destino por último
      ];

      // Reordenar globalmente
      const reorderedPoints = finalPoints.map((point, index) => ({
        ...point,
        order: index
      }));

      return {
        optimizedPoints: reorderedPoints,
        totalDistance: optimizationResult.totalDistance,
        totalDuration: optimizationResult.totalDuration,
        polyline: optimizationResult.polyline,
        optimizedOrder: reorderedPoints.map(p => p.id)
      };

    } catch (error) {
      console.error('❌ [OPTIMIZER V2] Erro na otimização com limite:', error);
      
      // Fallback: retornar pontos na ordem original
      const fallbackPoints = points.map((point, index) => ({
        ...point,
        order: index
      }));
      
      return {
        optimizedPoints: fallbackPoints,
        totalDistance: 0,
        totalDuration: 0,
        polyline: '',
        optimizedOrder: fallbackPoints.map(p => p.id)
      };
    }
  }

  // ✅ IMPLEMENTAÇÃO MELHORADA: Otimização parcial para usar com blocos
  async optimizePartialRoute(
    completedPoints: OptimizationPoint[], 
    remainingPoints: OptimizationPoint[]
  ): Promise<OptimizationResult> {
    console.log(`🎯 [OPTIMIZER PARTIAL] Otimização parcial - ${completedPoints.length} concluídos, ${remainingPoints.length} restantes`);
    
    if (remainingPoints.length === 0) {
      console.log(`✅ [OPTIMIZER PARTIAL] Nenhum ponto pendente - retornando pontos concluídos`);
      return {
        optimizedPoints: completedPoints,
        totalDistance: 0,
        totalDuration: 0,
        polyline: '',
        optimizedOrder: completedPoints.map(p => p.id)
      };
    }

    if (remainingPoints.length === 1) {
      console.log(`✅ [OPTIMIZER PARTIAL] Apenas 1 ponto pendente - concatenando`);
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

    try {
      // Usar último ponto concluído como origem para otimização dos pendentes
      const lastCompletedPoint = completedPoints[completedPoints.length - 1];
      
      console.log(`🚀 [OPTIMIZER PARTIAL] Otimizando a partir do último ponto concluído`);
      
      // Criar lista para otimização: último concluído + pontos pendentes
      const pointsToOptimize = [
        { ...lastCompletedPoint, type: 'origin' as const },
        ...remainingPoints.slice(0, -1).map(p => ({ ...p, type: 'waypoint' as const })),
        { ...remainingPoints[remainingPoints.length - 1], type: 'destination' as const }
      ];

      // Otimizar apenas os pontos pendentes
      const optimizationResult = await this.optimizeRouteWithGoogleAPIs(pointsToOptimize);
      
      // Combinar: pontos concluídos (exceto o último) + pontos otimizados
      const finalPoints = [
        ...completedPoints.slice(0, -1), // Todos os concluídos exceto o último
        ...optimizationResult.optimizedPoints.map((p, index) => ({
          ...p,
          order: completedPoints.length - 1 + index,
          completed: index === 0 ? true : false // Primeiro ponto é o último concluído
        }))
      ];

      console.log(`✅ [OPTIMIZER PARTIAL] Otimização parcial concluída - ${finalPoints.length} pontos finais`);

      return {
        optimizedPoints: finalPoints,
        totalDistance: optimizationResult.totalDistance,
        totalDuration: optimizationResult.totalDuration,
        polyline: optimizationResult.polyline,
        optimizedOrder: finalPoints.map(p => p.id)
      };
      
    } catch (error) {
      console.error('❌ [OPTIMIZER PARTIAL] Erro na otimização parcial:', error);
      
      // Fallback: manter ordem atual sem otimização
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
}

export const googleMapsOptimizer = new GoogleMapsOptimizer();
