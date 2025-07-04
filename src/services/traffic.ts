
interface TrafficData {
  distance: string;
  duration: string;
  durationInTraffic: string;
  status: 'OK' | 'NOT_FOUND' | 'ZERO_RESULTS' | 'MAX_WAYPOINTS_EXCEEDED' | 'INVALID_REQUEST' | 'OVER_DAILY_LIMIT' | 'OVER_QUERY_LIMIT' | 'REQUEST_DENIED' | 'UNKNOWN_ERROR';
}

interface RoutePoint {
  lat: number;
  lng: number;
  address: string;
}

class TrafficService {
  private apiKey = 'AIzaSyAbITueefJWwTTyXO-9Nz9pgzbgKZ5sV9w';

  async getTrafficInfo(origin: RoutePoint, destination: RoutePoint): Promise<TrafficData | null> {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/distancematrix/json?` +
        `origins=${origin.lat},${origin.lng}&` +
        `destinations=${destination.lat},${destination.lng}&` +
        `departure_time=now&` +
        `traffic_model=best_guess&` +
        `key=${this.apiKey}`
      );

      const data = await response.json();
      
      if (data.status === 'OK' && data.rows[0]?.elements[0]) {
        const element = data.rows[0].elements[0];
        
        return {
          distance: element.distance?.text || 'N/A',
          duration: element.duration?.text || 'N/A',
          durationInTraffic: element.duration_in_traffic?.text || element.duration?.text || 'N/A',
          status: element.status
        };
      }
      
      return null;
    } catch (error) {
      console.error('Erro ao obter informações de trânsito:', error);
      return null;
    }
  }

  async getRouteTrafficInfo(points: RoutePoint[]): Promise<{
    totalDistance: string;
    totalDuration: string;
    totalDurationInTraffic: string;
    segments: TrafficData[];
  } | null> {
    if (points.length < 2) return null;

    try {
      const segments: TrafficData[] = [];
      let totalDistanceKm = 0;
      let totalDurationMin = 0;
      let totalTrafficMin = 0;

      for (let i = 0; i < points.length - 1; i++) {
        const segment = await this.getTrafficInfo(points[i], points[i + 1]);
        if (segment) {
          segments.push(segment);
          
          // Extrair números para soma
          const distanceNum = parseFloat(segment.distance.replace(/[^\d.]/g, '')) || 0;
          const durationNum = parseInt(segment.duration.replace(/[^\d]/g, '')) || 0;
          const trafficNum = parseInt(segment.durationInTraffic.replace(/[^\d]/g, '')) || 0;
          
          totalDistanceKm += distanceNum;
          totalDurationMin += durationNum;
          totalTrafficMin += trafficNum;
        }
      }

      return {
        totalDistance: `${totalDistanceKm.toFixed(1)} km`,
        totalDuration: `${Math.round(totalDurationMin)} min`,
        totalDurationInTraffic: `${Math.round(totalTrafficMin)} min`,
        segments
      };
    } catch (error) {
      console.error('Erro ao calcular rota com trânsito:', error);
      return null;
    }
  }
}

export const trafficService = new TrafficService();
