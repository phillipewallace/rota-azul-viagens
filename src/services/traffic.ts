
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
      // Validação dos parâmetros
      if (!origin?.lat || !origin?.lng || !destination?.lat || !destination?.lng) {
        console.error('Invalid coordinates provided to getTrafficInfo');
        return null;
      }

      const url = `https://maps.googleapis.com/maps/api/distancematrix/json?` +
        `origins=${origin.lat},${origin.lng}&` +
        `destinations=${destination.lat},${destination.lng}&` +
        `departure_time=now&` +
        `traffic_model=best_guess&` +
        `key=${this.apiKey}`;

      console.log('Fetching traffic info from:', url);

      const response = await fetch(url);
      
      if (!response.ok) {
        console.error('Traffic API response not ok:', response.status, response.statusText);
        return null;
      }

      const data = await response.json();
      
      console.log('Traffic API response:', data);
      
      if (data.status === 'OK' && data.rows?.[0]?.elements?.[0]) {
        const element = data.rows[0].elements[0];
        
        if (element.status === 'OK') {
          return {
            distance: element.distance?.text || 'N/A',
            duration: element.duration?.text || 'N/A',
            durationInTraffic: element.duration_in_traffic?.text || element.duration?.text || 'N/A',
            status: element.status
          };
        }
      }
      
      console.warn('Traffic API returned non-OK status:', data.status);
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
    if (!points || points.length < 2) {
      console.warn('Invalid points array provided to getRouteTrafficInfo');
      return null;
    }

    try {
      const segments: TrafficData[] = [];
      let totalDistanceKm = 0;
      let totalDurationMin = 0;
      let totalTrafficMin = 0;

      console.log('Calculating route traffic for', points.length, 'points');

      for (let i = 0; i < points.length - 1; i++) {
        const segment = await this.getTrafficInfo(points[i], points[i + 1]);
        if (segment && segment.status === 'OK') {
          segments.push(segment);
          
          // Extrair números para soma - melhor parsing
          const distanceMatch = segment.distance.match(/[\d,\.]+/);
          const durationMatch = segment.duration.match(/\d+/);
          const trafficMatch = segment.durationInTraffic.match(/\d+/);
          
          const distanceNum = distanceMatch ? parseFloat(distanceMatch[0].replace(',', '.')) : 0;
          const durationNum = durationMatch ? parseInt(durationMatch[0]) : 0;
          const trafficNum = trafficMatch ? parseInt(trafficMatch[0]) : durationNum;
          
          totalDistanceKm += distanceNum;
          totalDurationMin += durationNum;
          totalTrafficMin += trafficNum;
          
          console.log(`Segment ${i+1}: ${distanceNum}km, ${durationNum}min, ${trafficNum}min traffic`);
        } else {
          console.warn(`Failed to get traffic info for segment ${i+1}`);
        }
        
        // Pequeno delay para evitar rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const result = {
        totalDistance: `${totalDistanceKm.toFixed(1)} km`,
        totalDuration: `${Math.round(totalDurationMin)} min`,
        totalDurationInTraffic: `${Math.round(totalTrafficMin)} min`,
        segments
      };

      console.log('Route traffic calculation complete:', result);
      return result;
    } catch (error) {
      console.error('Erro ao calcular rota com trânsito:', error);
      return null;
    }
  }
}

export const trafficService = new TrafficService();
