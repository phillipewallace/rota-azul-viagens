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
  private readonly MAX_WAYPOINTS = 25; // ✅ ATUALIZADO: Routes API v2 suporta 25 waypoints intermediários

  async optimizeRouteWithGoogleAPIs(points: OptimizationPoint[]): Promise<OptimizationResult> {
    console.log(`🎯 [OPTIMIZER V2] Otimizando ${points.length} pontos com Routes API v2 (MAX 25 waypoints)`);
    
    if (points.length < 2) {
      throw new Error('Necessário pelo menos 2 pontos para otimizar');
    }

    // Para rotas simples (2 pontos)
    if (points.length === 2) {
      return await this.optimizeTwoPointRoute(points);
    }

    // ✅ ATUALIZADO: Aplicar limite de 25 waypoints antes da otimização
    if (points.length > this.MAX_WAYPOINTS + 2) {
      console.log(`⚠️ [OPTIMIZER V2] Rota muito grande (${points.length} pontos), limitando a ${this.MAX_WAYPOINTS + 2} pontos`);
      return await this.handleLargeRoute(points);
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

    // ✅ CRÍTICO: Aplicar limite rigoroso de 25 waypoints
    const limitedWaypoints = waypoints.slice(0, this.MAX_WAYPOINTS);
    
    if (waypoints.length > this.MAX_WAYPOINTS) {
      console.log(`⚠️ [OPTIMIZER V2] Limitando waypoints: ${waypoints.length} → ${this.MAX_WAYPOINTS}`);
    }

    console.log(`🚀 [OPTIMIZER V2] Processando ${limitedWaypoints.length} waypoints de ${waypoints.length} totais`);

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

    try {
      console.log(`📡 [OPTIMIZER V2] Enviando requisição para Routes API v2 com ${limitedWaypoints.length} waypoints`);
      
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
      if (route.optimizedIntermediateWaypointIndex && limitedWaypoints.length > 0) {
        console.log(`🔄 [OPTIMIZER V2] Reordenando ${limitedWaypoints.length} waypoints conforme otimização`);
        
        const reorderedWaypoints = route.optimizedIntermediateWaypointIndex
          .map((index: number, newOrder: number) => ({
            ...limitedWaypoints[index],
            order: newOrder + 1,
            type: 'waypoint' as const
          }));
        optimizedPoints.push(...reorderedWaypoints);
      } else {
        optimizedPoints.push(
          ...limitedWaypoints.map((wp, index) => ({
            ...wp,
            order: index + 1,
            type: 'waypoint' as const
          }))
        );
      }

      // ✅ MELHORADO: Adicionar waypoints excedentes que não puderam ser otimizados no final
      if (waypoints.length > this.MAX_WAYPOINTS) {
        const excessWaypoints = waypoints.slice(this.MAX_WAYPOINTS).map((wp, index) => ({
          ...wp,
          order: optimizedPoints.length + index,
          type: 'waypoint' as const
        }));
        optimizedPoints.push(...excessWaypoints);
        
        console.log(`📍 [OPTIMIZER V2] Adicionados ${excessWaypoints.length} waypoints excedentes não otimizados`);
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
      console.log(`📊 [OPTIMIZER V2] Total de pontos processados: ${optimizedPoints.length}`);

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

  // ✅ MELHORADO: Implementação para rotas grandes - dividir inteligentemente
  private async handleLargeRoute(points: OptimizationPoint[]): Promise<OptimizationResult> {
    console.log(`📊 [OPTIMIZER V2] Rota grande com ${points.length} pontos - aplicando estratégia de segmentação`);
    
    const origin = points.find(p => p.type === 'origin') || points[0];
    const destination = points.find(p => p.type === 'destination') || points[points.length - 1];
    const waypoints = points.filter(p => 
      p.type === 'waypoint' || (p.id !== origin.id && p.id !== destination.id)
    );

    try {
      // ✅ ESTRATÉGIA MELHORADA: Dividir em segmentos otimizáveis
      const segments = [];
      const segmentSize = this.MAX_WAYPOINTS; // 25 waypoints por segmento
      
      // Criar segmentos de waypoints
      for (let i = 0; i < waypoints.length; i += segmentSize) {
        const segmentWaypoints = waypoints.slice(i, i + segmentSize);
        segments.push(segmentWaypoints);
      }

      console.log(`🔧 [OPTIMIZER V2] Dividindo em ${segments.length} segmentos de até ${segmentSize} waypoints`);

      let allOptimizedPoints = [{ ...origin, order: 0, type: 'origin' as const }];
      let totalDistance = 0;
      let totalDuration = 0;
      let finalPolyline = '';

      // Otimizar cada segmento
      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        const isLastSegment = i === segments.length - 1;
        
        // Determinar origem e destino do segmento
        const segmentOrigin = i === 0 ? origin : allOptimizedPoints[allOptimizedPoints.length - 1];
        const segmentDestination = isLastSegment ? destination : segment[segment.length - 1];
        
        // Criar lista de pontos para otimizar
        const segmentPoints = [
          { ...segmentOrigin, type: 'origin' as const },
          ...segment.slice(0, -1).map(p => ({ ...p, type: 'waypoint' as const })),
          { ...segmentDestination, type: 'destination' as const }
        ];

        console.log(`🎯 [OPTIMIZER V2] Otimizando segmento ${i + 1}/${segments.length} com ${segmentPoints.length} pontos`);

        try {
          const segmentResult = await this.optimizeWithRoutesAPIv2(segmentPoints);
          
          // Adicionar pontos do segmento (exceto o primeiro se não for o primeiro segmento)
          const pointsToAdd = i === 0 ? segmentResult.optimizedPoints : segmentResult.optimizedPoints.slice(1);
          
          pointsToAdd.forEach((point, index) => {
            allOptimizedPoints.push({
              ...point,
              order: allOptimizedPoints.length
            });
          });

          totalDistance += segmentResult.totalDistance;
          totalDuration += segmentResult.totalDuration;
          
          if (segmentResult.polyline) {
            finalPolyline += segmentResult.polyline;
          }

        } catch (segmentError) {
          console.error(`❌ [OPTIMIZER V2] Erro no segmento ${i + 1}:`, segmentError);
          
          // Fallback: adicionar pontos do segmento sem otimização
          const fallbackPoints = segment.map((point, index) => ({
            ...point,
            order: allOptimizedPoints.length + index,
            type: 'waypoint' as const
          }));
          
          allOptimizedPoints.push(...fallbackPoints);
        }
      }

      // Garantir que o destino seja o último
      if (allOptimizedPoints[allOptimizedPoints.length - 1].id !== destination.id) {
        allOptimizedPoints.push({
          ...destination,
          order: allOptimizedPoints.length,
          type: 'destination' as const
        });
      }

      console.log(`✅ [OPTIMIZER V2] Rota grande processada: ${allOptimizedPoints.length} pontos, ${totalDistance.toFixed(1)}km`);

      return {
        optimizedPoints: allOptimizedPoints,
        totalDistance,
        totalDuration,
        polyline: finalPolyline,
        optimizedOrder: allOptimizedPoints.map(p => p.id)
      };
      
    } catch (error) {
      console.error('❌ [OPTIMIZER V2] Erro na otimização de rota grande:', error);
      
      // Fallback final: retornar pontos na ordem original
      const fallbackPoints = [origin, ...waypoints, destination].map((point, index) => ({
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

  // ✅ IMPLEMENTAÇÃO CORRIGIDA: Otimização parcial para preservar pontos concluídos
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
      
      console.log(`🚀 [OPTIMIZER PARTIAL] Otimizando a partir do último ponto concluído: ${lastCompletedPoint.address}`);
      
      // Criar lista para otimização: último concluído + pontos pendentes
      const pointsToOptimize = [
        { ...lastCompletedPoint, type: 'origin' as const },
        ...remainingPoints.slice(0, -1).map(p => ({ ...p, type: 'waypoint' as const })),
        { ...remainingPoints[remainingPoints.length - 1], type: 'destination' as const }
      ];

      // Otimizar apenas os pontos pendentes
      const optimizationResult = await this.optimizeRouteWithGoogleAPIs(pointsToOptimize);
      
      // Combinar: pontos concluídos (exceto o último, que foi usado como origem) + pontos otimizados
      const finalPoints = [
        ...completedPoints.slice(0, -1), // Todos os concluídos exceto o último
        ...optimizationResult.optimizedPoints.map((p, index) => ({
          ...p,
          order: completedPoints.length - 1 + index, // Reordenar a partir do último concluído
          completed: index === 0 ? true : false // Primeiro ponto é o último concluído, resto são pendentes
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
      
      console.log(`⚠️ [OPTIMIZER PARTIAL] Usando fallback - ${fallbackPoints.length} pontos sem otimização`);
      
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
