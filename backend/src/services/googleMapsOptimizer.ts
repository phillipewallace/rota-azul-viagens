
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
  private readonly MAX_WAYPOINTS_PER_REQUEST = 25; // Routes API v2 limit

  async optimizeRouteWithGoogleAPIs(points: OptimizationPoint[]): Promise<OptimizationResult> {
    console.log(`🎯 [ROUTES V2] Otimizando rota com ${points.length} pontos usando Routes API v2`);
    
    if (points.length < 2) {
      throw new Error('Necessário pelo menos 2 pontos para otimizar');
    }

    // Para rotas simples (2 pontos)
    if (points.length === 2) {
      return await this.optimizeTwoPointRoute(points);
    }

    // Para rotas com muitos pontos, dividir em segmentos
    if (points.length > this.MAX_WAYPOINTS_PER_REQUEST) {
      console.log(`📊 [ROUTES V2] Rota grande com ${points.length} pontos - processando em segmentos`);
      return await this.handleLargeRouteV2(points);
    }

    // Para rotas normais, usar Routes API v2
    return await this.optimizeWithRoutesAPIv2(points);
  }

  private async optimizeTwoPointRoute(points: OptimizationPoint[]): Promise<OptimizationResult> {
    console.log(`🚀 [ROUTES V2] Otimizando rota de 2 pontos`);
    
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
      routingPreference: 'TRAFFIC_UNAWARE', // Básico sem traffic
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
        console.error(`❌ [ROUTES V2] Erro na API:`, response.status, errorText);
        throw new Error(`Routes API v2 error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.routes?.length) {
        throw new Error('Nenhuma rota encontrada');
      }

      const route = data.routes[0];
      const totalDistance = route.distanceMeters / 1000; // Convert to km
      const totalDuration = parseInt(route.duration?.replace('s', '') || '0');

      console.log(`✅ [ROUTES V2] Rota 2 pontos: ${totalDistance.toFixed(1)}km, ${Math.round(totalDuration/60)}min`);

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
      console.error('❌ [ROUTES V2] Erro na otimização 2 pontos:', error);
      throw error;
    }
  }

  private async optimizeWithRoutesAPIv2(points: OptimizationPoint[]): Promise<OptimizationResult> {
    console.log(`🚀 [ROUTES V2] Usando Routes API v2 para ${points.length} pontos`);
    
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
      intermediates: waypoints.map(wp => ({
        location: {
          latLng: {
            latitude: wp.lat,
            longitude: wp.lng
          }
        }
      })),
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_UNAWARE', // Básico sem considerações de trânsito
      optimizeWaypointOrder: true, // Otimizar ordem dos waypoints
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
        console.error(`❌ [ROUTES V2] Erro na API:`, response.status, errorText);
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
        const reorderedWaypoints = route.optimizedIntermediateWaypointIndex.map(
          (index: number, newOrder: number) => ({
            ...waypoints[index],
            order: newOrder + 1,
            type: 'waypoint' as const
          })
        );
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

      const totalDistance = route.distanceMeters / 1000; // Convert to km
      const totalDuration = parseInt(route.duration?.replace('s', '') || '0');

      console.log(`✅ [ROUTES V2] Rota otimizada: ${totalDistance.toFixed(1)}km, ${Math.round(totalDuration/60)}min`);

      return {
        optimizedPoints,
        totalDistance,
        totalDuration,
        polyline: route.polyline?.encodedPolyline || '',
        optimizedOrder: optimizedPoints.map(p => p.id)
      };

    } catch (error) {
      console.error('❌ [ROUTES V2] Erro na otimização:', error);
      throw error;
    }
  }

  private async handleLargeRouteV2(points: OptimizationPoint[]): Promise<OptimizationResult> {
    console.log(`📊 [ROUTES V2] Processando rota grande com ${points.length} pontos`);
    
    const origin = points.find(p => p.type === 'origin') || points[0];
    const destination = points.find(p => p.type === 'destination') || points[points.length - 1];
    const waypoints = points.filter(p => 
      p.type === 'waypoint' || (p.id !== origin.id && p.id !== destination.id)
    );

    // Para rotas muito grandes, dividir em segmentos menores
    const segments = this.divideIntoSegments(waypoints, this.MAX_WAYPOINTS_PER_REQUEST - 2);
    let totalDistance = 0;
    let totalDuration = 0;
    let allOptimizedPoints: OptimizationPoint[] = [];
    let combinedPolyline = '';

    console.log(`🔄 [ROUTES V2] Dividindo em ${segments.length} segmentos`);

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const segmentOrigin = i === 0 ? origin : allOptimizedPoints[allOptimizedPoints.length - 1];
      const segmentDestination = i === segments.length - 1 ? destination : segment[segment.length - 1];
      
      const segmentPoints = [
        segmentOrigin,
        ...segment.slice(0, -1), // Excluir último ponto se não for o último segmento
        segmentDestination
      ];

      try {
        const segmentResult = await this.optimizeWithRoutesAPIv2(segmentPoints);
        
        // Somar distâncias e durações
        totalDistance += segmentResult.totalDistance;
        totalDuration += segmentResult.totalDuration;
        
        // Adicionar pontos (excluindo duplicatas)
        if (i === 0) {
          allOptimizedPoints.push(...segmentResult.optimizedPoints);
        } else {
          allOptimizedPoints.push(...segmentResult.optimizedPoints.slice(1)); // Pular origem duplicada
        }
        
        // Combinar polylines (simplificado)
        if (segmentResult.polyline) {
          combinedPolyline = segmentResult.polyline; // Usar apenas o último por simplicidade
        }
        
        console.log(`✅ [ROUTES V2] Segmento ${i + 1}/${segments.length} processado`);
        
        // Pequena pausa para não sobrecarregar a API
        if (i < segments.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
      } catch (error) {
        console.error(`❌ [ROUTES V2] Erro no segmento ${i + 1}:`, error);
        // Continuar com próximo segmento em caso de erro
      }
    }

    // Recalcular ordens
    const finalOptimizedPoints = allOptimizedPoints.map((point, index) => ({
      ...point,
      order: index
    }));

    console.log(`✅ [ROUTES V2] Rota grande processada: ${totalDistance.toFixed(1)}km, ${Math.round(totalDuration/60)}min`);

    return {
      optimizedPoints: finalOptimizedPoints,
      totalDistance,
      totalDuration,
      polyline: combinedPolyline,
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

  async optimizePartialRoute(
    completedPoints: OptimizationPoint[], 
    remainingPoints: OptimizationPoint[]
  ): Promise<OptimizationResult> {
    console.log(`🎯 [ROUTES V2 PARTIAL] Otimizando ${remainingPoints.length} pontos restantes`);
    
    if (remainingPoints.length < 2) {
      return {
        optimizedPoints: [...completedPoints, ...remainingPoints],
        totalDistance: 0,
        totalDuration: 0,
        polyline: '',
        optimizedOrder: [...completedPoints, ...remainingPoints].map(p => p.id)
      };
    }

    // Usar Routes API v2 para otimizar pontos restantes
    const optimizedRemaining = await this.optimizeRouteWithGoogleAPIs(remainingPoints);
    
    // Recalcular ordem global
    const allPoints = [
      ...completedPoints,
      ...optimizedRemaining.optimizedPoints.map(p => ({
        ...p,
        order: p.order + completedPoints.length
      }))
    ];

    return {
      optimizedPoints: allPoints,
      totalDistance: optimizedRemaining.totalDistance,
      totalDuration: optimizedRemaining.totalDuration,
      polyline: optimizedRemaining.polyline,
      optimizedOrder: allPoints.map(p => p.id)
    };
  }
}

export const googleMapsOptimizer = new GoogleMapsOptimizer();
