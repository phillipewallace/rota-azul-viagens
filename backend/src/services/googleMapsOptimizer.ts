
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

  async optimizeRouteWithGoogleAPIs(points: OptimizationPoint[]): Promise<OptimizationResult> {
    console.log(`🎯 [GOOGLE OPTIMIZER] Otimizando rota com ${points.length} pontos usando APIs avançadas`);
    
    if (points.length < 2) {
      throw new Error('Necessário pelo menos 2 pontos para otimizar');
    }

    // Para rotas simples (2 pontos), usar Directions API
    if (points.length === 2) {
      return await this.optimizeTwoPointRoute(points);
    }

    // Para rotas complexas, usar Routes API avançado
    return await this.optimizeComplexRoute(points);
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

      // Adicionar destino
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

    // Otimizar apenas os pontos restantes
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
