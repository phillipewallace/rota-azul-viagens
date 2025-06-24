
import { Route, RoutePoint } from '@/hooks/useRoutes';
import { Truck } from '@/hooks/useTrucks';

// Configurações da API
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://your-api-domain.com/api' 
  : 'http://localhost:3001/api';

const GOOGLE_MAPS_API_KEY = process.env.VITE_GOOGLE_MAPS_API_KEY || '';

interface AddressResponse {
  address: string;
  lat: number;
  lng: number;
  cep: string;
}

interface OptimizedRouteResponse {
  optimizedOrder: string[];
  totalDistance: number;
  estimatedTime: string;
  routes: any[];
}

class ApiService {
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    };

    const response = await fetch(url, config);

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // Rotas
  async getRoutes(): Promise<Route[]> {
    return this.request<Route[]>('/routes');
  }

  async createRoute(route: Omit<Route, 'id' | 'createdAt'>): Promise<Route> {
    return this.request<Route>('/routes', {
      method: 'POST',
      body: JSON.stringify(route),
    });
  }

  async updateRoute(id: string, route: Partial<Route>): Promise<Route> {
    return this.request<Route>(`/routes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(route),
    });
  }

  async deleteRoute(id: string): Promise<void> {
    return this.request<void>(`/routes/${id}`, {
      method: 'DELETE',
    });
  }

  // Caminhões
  async getTrucks(): Promise<Truck[]> {
    return this.request<Truck[]>('/trucks');
  }

  async createTruck(truck: Omit<Truck, 'id'>): Promise<Truck> {
    return this.request<Truck>('/trucks', {
      method: 'POST',
      body: JSON.stringify(truck),
    });
  }

  async updateTruck(id: string, truck: Partial<Truck>): Promise<Truck> {
    return this.request<Truck>(`/trucks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(truck),
    });
  }

  // Busca de endereço por CEP
  async getAddressByCep(cep: string): Promise<AddressResponse> {
    // Primeiro tenta buscar via ViaCEP (gratuito)
    try {
      const viaCepResponse = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const viaCepData = await viaCepResponse.json();
      
      if (!viaCepData.erro) {
        // Agora busca coordenadas no Google Maps
        const address = `${viaCepData.logradouro}, ${viaCepData.bairro}, ${viaCepData.localidade}, ${viaCepData.uf}, Brasil`;
        const coords = await this.getCoordinatesFromAddress(address);
        
        return {
          address: address,
          lat: coords.lat,
          lng: coords.lng,
          cep: cep
        };
      }
    } catch (error) {
      console.error('Erro ao buscar CEP via ViaCEP:', error);
    }

    // Fallback: busca diretamente no Google Maps
    return this.request<AddressResponse>(`/geocoding/cep/${cep}`);
  }

  // Geocoding com Google Maps
  async getCoordinatesFromAddress(address: string): Promise<{ lat: number; lng: number }> {
    const encodedAddress = encodeURIComponent(address);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${GOOGLE_MAPS_API_KEY}`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      return {
        lat: location.lat,
        lng: location.lng
      };
    }

    throw new Error('Endereço não encontrado');
  }

  // Otimização de rota com Google Maps
  async optimizeRoute(points: RoutePoint[]): Promise<OptimizedRouteResponse> {
    if (points.length < 2) {
      throw new Error('É necessário pelo menos 2 pontos para otimizar a rota');
    }

    // Separa origem, destino e waypoints
    const origin = points.find(p => p.type === 'origin') || points[0];
    const destination = points.find(p => p.type === 'destination') || points[points.length - 1];
    const waypoints = points.filter(p => p.type === 'waypoint' || (p.id !== origin.id && p.id !== destination.id));

    // Monta a URL para Google Directions API
    const waypointsParam = waypoints.length > 0 
      ? `&waypoints=optimize:true|${waypoints.map(p => `${p.lat},${p.lng}`).join('|')}`
      : '';

    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}${waypointsParam}&key=${GOOGLE_MAPS_API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.routes.length > 0) {
      const route = data.routes[0];
      const leg = route.legs[0];

      // Calcula ordem otimizada
      let optimizedOrder = [origin.id];
      if (data.routes[0].waypoint_order) {
        optimizedOrder.push(...data.routes[0].waypoint_order.map((index: number) => waypoints[index].id));
      }
      optimizedOrder.push(destination.id);

      return {
        optimizedOrder,
        totalDistance: leg.distance.value / 1000, // em km
        estimatedTime: leg.duration.text,
        routes: data.routes
      };
    }

    throw new Error('Não foi possível otimizar a rota');
  }

  // Rastreamento em tempo real
  async updateTruckLocation(truckId: string, lat: number, lng: number): Promise<void> {
    return this.request<void>(`/trucks/${truckId}/location`, {
      method: 'PUT',
      body: JSON.stringify({ lat, lng, timestamp: new Date().toISOString() }),
    });
  }

  // Manutenção
  async scheduleMaintenance(truckId: string, maintenanceData: any): Promise<any> {
    return this.request(`/trucks/${truckId}/maintenance`, {
      method: 'POST',
      body: JSON.stringify(maintenanceData),
    });
  }
}

export const apiService = new ApiService();
