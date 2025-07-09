
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
  private readonly MAX_WAYPOINTS = 23; // Google Maps limit is 25, deixando margem de segurança

  async optimizeRouteWithGoogleAPIs(points: OptimizationPoint[]): Promise<OptimizationResult> {
    console.log(`🎯 [GOOGLE OPTIMIZER] Otimizando rota com ${points.length} pontos usando APIs avançadas`);
    
    if (points.length < 2) {
      throw new Error('Necessário pelo menos 2 pontos para otimizar');
    }

    // Para rotas simples (2 pontos), usar Directions API
    if (points.length === 2) {
      return await this.optimizeTwoPointRoute(points);
    }

    // NOVO: Se há muitos pontos, usar estratégia simplificada
    if (points.length > this.MAX_WAYPOINTS + 2) {
      console.log(`⚠️ [GOOGLE OPTIMIZER] Rota com ${points.length} pontos excede limite. Usando estratégia simplificada.`);
      return await this.handleLargeRoute(points);
    }

    // Para rotas normais, usar otimização completa
    return await this.optimizeComplexRoute(points);
  }

  private async handleLargeRoute(points: OptimizationPoint[]): Promise<OptimizationResult> {
    console.log(`📊 [LARGE ROUTE] Processando rota grande com ${points.length} pontos`);
    
    // Identificar origem e destino
    const origin = points.find(p => p.type === 'origin') || points[0];
    const destination = points.find(p => p.type === 'destination') || points[points.length - 1];
    const waypoints = points.filter(p => 
      p.type === 'waypoint' || (p.id !== origin.id && p.id !== destination.id)
    );

    // Para rotas grandes, apenas manter ordem atual sem otimizar
    let orderedPoints = [
      { ...origin, order: 0, type: 'origin' as const }
    ];

    waypoints.forEach((wp, index) => {
      orderedPoints.push({
        ...wp,
        order: index + 1,
        type: 'waypoint' as const
      });
    });

    orderedPoints.push({
      ...destination,
      order: orderedPoints.length,
      type: 'destination' as const
    });

    // Calcular distância estimada (simplificada)
    const estimatedDistance = Math.max(10, points.length * 2); // 2km por ponto estimado
    const estimatedDuration = Math.max(1800, points.length * 300); // 5 min por ponto estimado

    console.log(`✅ [LARGE ROUTE] Rota grande processada sem otimização: ${estimatedDistance}km estimado`);

    return {
      optimizedPoints: orderedPoints,
      totalDistance: estimatedDistance,
      totalDuration: estimatedDuration,
      polyline: '', // Sem polyline para rotas grandes
      optimizedOrder: orderedPoints.map(p => p.id)
    };
  }

  private async optimizeTwoPointRoute(points: OptimizationPoint[]): Promise<OptimizationResult> {
    const [origin, destination] = points;
    
    const directionsUrl = `https://maps.googleapis.com/maps/api/directions/json?` +
      `origin=${origin.lat},${origin.lng}&` +
      `destination=${destination.lat},${destination.lng}&` +
      `optimize=true&` +
      `traffic_model=best_guess&` +
      `departure_time=now&` +
      `key=${this.apiKey}`;

    const response = await fetch(directionsUrl);
    const data = await response.json();

    if (data.status !== 'OK' || !data.routes?.length) {
      throw new Error(`Directions API error: ${data.status}`);
    }

    const route = data.routes[0];
    const leg = route.legs[0];

    return {
      optimizedPoints: [
        { ...origin, order: 0, type: 'origin' },
        { ...destination, order: 1, type: 'destination' }
      ],
      totalDistance: leg.distance.value / 1000, // Convert to km
      totalDuration: leg.duration.value, // seconds
      polyline: route.overview_polyline.points,
      optimizedOrder: [origin.id, destination.id]
    };
  }

  private async optimizeComplexRoute(points: OptimizationPoint[]): Promise<OptimizationResult> {
    console.log(`🚀 [GOOGLE OPTIMIZER] Usando Routes API para otimização avançada`);
    
    const origin = points.find(p => p.type === 'origin') || points[0];
    const destination = points.find(p => p.type === 'destination') || points[points.length - 1];
    const waypoints = points.filter(p => 
      p.type === 'waypoint' || (p.id !== origin.id && p.id !== destination.id)
    );

    // IMPORTANTE: Verificar limite de waypoints antes de fazer requisição
    if (waypoints.length > this.MAX_WAYPOINTS) {
      console.log(`⚠️ [GOOGLE OPTIMIZER] Muitos waypoints (${waypoints.length}), usando estratégia simplificada`);
      return await this.handleLargeRoute(points);
    }

    // Usar Routes API v2 (mais avançado)
    const routesUrl = 'https://routes.googleapis.com/directions/v2:computeRoutes';
    
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
      routingPreference: 'TRAFFIC_AWARE_OPTIMAL',
      optimizeWaypointOrder: true,
      computeAlternativeRoutes: false,
      languageCode: 'pt-BR',
      units: 'METRIC'
    };

    try {
      const response = await fetch(routesUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.apiKey,
          'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.optimizedIntermediateWaypointIndex'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        console.log(`🔄 [GOOGLE OPTIMIZER] Routes API falhou, usando Directions API fallback`);
        return await this.fallbackToDirectionsAPI(points);
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

      // CRÍTICO: Sempre garantir que o destino seja o último ponto
      optimizedPoints.push({
        ...destination,
        order: optimizedPoints.length,
        type: 'destination' as const
      });

      const totalDistance = route.distanceMeters / 1000; // Convert to km
      const totalDuration = parseInt(route.duration?.replace('s', '') || '0');

      console.log(`✅ [GOOGLE OPTIMIZER] Rota otimizada: ${totalDistance.toFixed(1)}km, ${Math.round(totalDuration/60)}min`);

      return {
        optimizedPoints,
        totalDistance,
        totalDuration,
        polyline: route.polyline?.encodedPolyline || '',
        optimizedOrder: optimizedPoints.map(p => p.id)
      };

    } catch (error) {
      console.error('❌ [GOOGLE OPTIMIZER] Erro na Routes API:', error);
      return await this.fallbackToDirectionsAPI(points);
    }
  }

  private async fallbackToDirectionsAPI(points: OptimizationPoint[]): Promise<OptimizationResult> {
    console.log(`🔄 [GOOGLE OPTIMIZER] Fallback para Directions API`);
    
    const origin = points.find(p => p.type === 'origin') || points[0];
    const destination = points.find(p => p.type === 'destination') || points[points.length - 1];
    const waypoints = points.filter(p => 
      p.type === 'waypoint' || (p.id !== origin.id && p.id !== destination.id)
    );

    // CRÍTICO: Verificar limite de waypoints ANTES da requisição
    if (waypoints.length > this.MAX_WAYPOINTS) {
      console.log(`⚠️ [FALLBACK] Muitos waypoints (${waypoints.length}), usando estratégia simplificada`);
      return await this.handleLargeRoute(points);
    }

    const waypointsParam = waypoints.length > 0 
      ? `optimize:true|${waypoints.map(p => `${p.lat},${p.lng}`).join('|')}`
      : '';

    const directionsUrl = `https://maps.googleapis.com/maps/api/directions/json?` +
      `origin=${origin.lat},${origin.lng}&` +
      `destination=${destination.lat},${destination.lng}&` +
      `waypoints=${waypointsParam}&` +
      `traffic_model=best_guess&` +
      `departure_time=now&` +
      `key=${this.apiKey}`;

    const response = await fetch(directionsUrl);
    const data = await response.json();

    if (data.status !== 'OK' || !data.routes?.length) {
      // Se ainda assim falhar, usar estratégia simplificada
      if (data.status === 'MAX_WAYPOINTS_EXCEEDED') {
        console.log(`⚠️ [FALLBACK] MAX_WAYPOINTS_EXCEEDED confirmado, usando estratégia simplificada`);
        return await this.handleLargeRoute(points);
      }
      throw new Error(`Directions API error: ${data.status}`);
    }

    const route = data.routes[0];
    let optimizedPoints = [{ ...origin, order: 0, type: 'origin' as const }];

    // Reordenar waypoints conforme Directions API
    if (route.waypoint_order && waypoints.length > 0) {
      const reorderedWaypoints = route.waypoint_order.map(
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

    // CRÍTICO: Sempre garantir que o destino seja preservado
    optimizedPoints.push({
      ...destination,
      order: optimizedPoints.length,
      type: 'destination' as const
    });

    const totalDistance = route.legs.reduce((sum: number, leg: any) => sum + leg.distance.value, 0) / 1000;
    const totalDuration = route.legs.reduce((sum: number, leg: any) => sum + leg.duration.value, 0);

    return {
      optimizedPoints,
      totalDistance,
      totalDuration,
      polyline: route.overview_polyline.points,
      optimizedOrder: optimizedPoints.map(p => p.id)
    };
  }

  async optimizePartialRoute(
    completedPoints: OptimizationPoint[], 
    remainingPoints: OptimizationPoint[]
  ): Promise<OptimizationResult> {
    console.log(`🎯 [PARTIAL OPTIMIZER] Otimizando ${remainingPoints.length} pontos restantes`);
    
    if (remainingPoints.length < 2) {
      // Se só resta 1 ponto, não há o que otimizar
      return {
        optimizedPoints: [...completedPoints, ...remainingPoints],
        totalDistance: 0,
        totalDuration: 0,
        polyline: '',
        optimizedOrder: [...completedPoints, ...remainingPoints].map(p => p.id)
      };
    }

    // NOVO: Verificar se há muitos pontos restantes
    if (remainingPoints.length > this.MAX_WAYPOINTS + 2) {
      console.log(`⚠️ [PARTIAL OPTIMIZER] Muitos pontos restantes (${remainingPoints.length}), mantendo ordem atual`);
      
      // Manter ordem atual sem otimizar
      const reorderedRemaining = remainingPoints.map((p, index) => ({
        ...p,
        order: completedPoints.length + index
      }));

      return {
        optimizedPoints: [...completedPoints, ...reorderedRemaining],
        totalDistance: Math.max(5, remainingPoints.length * 1.5),
        totalDuration: Math.max(900, remainingPoints.length * 180),
        polyline: '',
        optimizedOrder: [...completedPoints, ...reorderedRemaining].map(p => p.id)
      };
    }

    // Otimizar apenas os pontos restantes se não forem muitos
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
