
import { BaseApiService } from './base';

export interface Address {
  street: string;
  number?: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  lat?: number;
  lng?: number;
}

export interface Coordinates {
  lat: number;
  lng: number;
}

class GeocodingService extends BaseApiService {
  async getAddressByCep(cep: string): Promise<Address> {
    console.log('📍 Getting address by CEP:', cep);
    return this.request<Address>(`/geocoding/cep/${cep}`);
  }

  async getCoordinatesFromAddress(address: string): Promise<Coordinates> {
    console.log('📍 Getting coordinates from address:', address);
    return this.request<Coordinates>('/geocoding/coordinates', {
      method: 'POST',
      body: JSON.stringify({ address }),
    });
  }

  async optimizeRoute(points: Array<{ lat: number; lng: number; address: string }>): Promise<any> {
    console.log('🗺️ Optimizing route with points:', points);
    return this.request<any>('/geocoding/optimize-route', {
      method: 'POST',
      body: JSON.stringify({ points }),
    });
  }
}

export const geocodingService = new GeocodingService();
