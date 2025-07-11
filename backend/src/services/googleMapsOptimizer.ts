
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
  private readonly MAX_SEGMENTS = 8;

  async optimizeRouteWithGoogleAPIs(points: OptimizationPoint[]): Promise<OptimizationResult> {
    if (points.length < 2) {
      throw new Error('Necessário pelo menos 2 pontos para otimizar');
    }

    if (points.length <= this.MAX_WAYPOINTS + 2) {
      return await this.optimizeWithRoutesAPIv2(points);
    }

    return await this.optimizeLargeRouteIntelligent(points);
  }

  private async optimizeWithRoutesAPIv2(points: OptimizationPoint[]): Promise<OptimizationResult> {
    const origin = points.find(p => p.type === 'origin') || points[0];
    const destination = points.find(p => p.type === 'destination') || points[points.length - 1];
    const waypoints = points.filter(p => 
      p.type === 'waypoint' || (p.id !== origin.id && p.id !== destination.id)
    ).slice(0, this.MAX_WAYPOINTS);

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
        throw new Error(`Routes API v2 error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.routes?.length) {
        throw new Error('Nenhuma rota encontrada');
      }

      const route = data.routes[0];
      let optimizedPoints = [{ ...origin, order: 0, type: 'origin' as const }];

      if (route.optimizedIntermediateWaypointIndex && waypoints.length > 0) {
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
      throw error;
    }
  }

  private async optimizeLargeRouteIntelligent(points: OptimizationPoint[]): Promise<OptimizationResult> {
    const origin = points.find(p => p.type === 'origin') || points[0];
    const destination = points.find(p => p.type === 'destination') || points[points.length - 1];
    const waypoints = points.filter(p => 
      p.type === 'waypoint' || (p.id !== origin.id && p.id !== destination.id)
    );

    const segments = this.createIntelligentSegments(waypoints, this.MAX_WAYPOINTS);
    let totalDistance = 0;
    let totalDuration = 0;
    let allOptimizedPoints: OptimizationPoint[] = [];

    for (let i = 0; i < segments.length; i += 3) {
      const batch = segments.slice(i, i + 3);
      
      const batchPromises = batch.map(async (segment, batchIndex) => {
        const segmentIndex = i + batchIndex;
        const segmentOrigin = segmentIndex === 0 ? origin : segments[segmentIndex - 1][segments[segmentIndex - 1].length - 1];
        const segmentDestination = segmentIndex === segments.length - 1 ? destination : segment[segment.length - 1];
        
        const segmentPoints = [segmentOrigin, ...segment.slice(0, -1), segmentDestination];
        
        try {
          return await this.optimizeWithRoutesAPIv2(segmentPoints);
        } catch (error) {
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      
      for (let j = 0; j < batchResults.length; j++) {
        const segmentResult = batchResults[j];
        if (segmentResult) {
          totalDistance += segmentResult.totalDistance;
          totalDuration += segmentResult.totalDuration;
          
          if (allOptimizedPoints.length === 0) {
            allOptimizedPoints.push(...segmentResult.optimizedPoints);
          } else {
            allOptimizedPoints.push(...segmentResult.optimizedPoints.slice(1));
          }
        }
      }

      if (i + 3 < segments.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

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

  private createIntelligentSegments(waypoints: OptimizationPoint[], maxPerSegment: number): OptimizationPoint[][] {
    const segments: OptimizationPoint[][] = [];
    
    for (let i = 0; i < waypoints.length; i += maxPerSegment) {
      const segment = waypoints.slice(i, i + maxPerSegment);
      segments.push(segment);
    }
    
    return segments;
  }

  // CORREÇÃO CRÍTICA: Preservação por coordenadas e IDs exatos
  async optimizePartialRoute(
    completedPoints: OptimizationPoint[], 
    remainingPoints: OptimizationPoint[]
  ): Promise<OptimizationResult> {
    if (remainingPoints.length === 0) {
      return {
        optimizedPoints: completedPoints,
        totalDistance: 0,
        totalDuration: 0,
        polyline: '',
        optimizedOrder: completedPoints.map(p => p.id)
      };
    }

    // CORREÇÃO: Usar último ponto concluído como origem
    const lastCompletedPoint = completedPoints[completedPoints.length - 1];
    
    const pointsToOptimize = [
      { ...lastCompletedPoint, type: 'origin' as const },
      ...remainingPoints
    ];

    try {
      const optimizedRemaining = await this.optimizeRouteWithGoogleAPIs(pointsToOptimize);
      
      // CORREÇÃO: Preservar todos os concluídos exceto o último + otimizados
      const finalPoints = [
        ...completedPoints.slice(0, -1),
        ...optimizedRemaining.optimizedPoints.map((p, index) => ({
          ...p,
          order: completedPoints.length - 1 + index,
          completed: index === 0 ? true : false,
          completedAt: index === 0 ? lastCompletedPoint.completedAt : undefined
        }))
      ];

      return {
        optimizedPoints: finalPoints,
        totalDistance: optimizedRemaining.totalDistance,
        totalDuration: optimizedRemaining.totalDuration,
        polyline: optimizedRemaining.polyline,
        optimizedOrder: finalPoints.map(p => p.id)
      };
      
    } catch (error) {
      // CORREÇÃO: Fallback preservando estrutura
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
