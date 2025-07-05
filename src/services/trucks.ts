
import { BaseApiService } from './base';

export interface Truck {
  id: string;
  name: string;
  plate: string;
  model: string;
  year: number;
  status: 'available' | 'in_route' | 'maintenance' | 'inactive';
  driver?: string;
  location?: {
    lat: number;
    lng: number;
  };
  current_route_id?: string;
  maintenance_schedule?: {
    next_maintenance: string;
    last_maintenance?: string;
  };
}

class TrucksService extends BaseApiService {
  async getTrucks(): Promise<Truck[]> {
    console.log('🚛 Fetching trucks from API...');
    return this.request<Truck[]>('/trucks');
  }

  async createTruck(truck: Omit<Truck, 'id'>): Promise<Truck> {
    console.log('🚛 Creating truck:', truck);
    return this.request<Truck>('/trucks', {
      method: 'POST',
      body: JSON.stringify(truck),
    });
  }

  async updateTruck(id: string, truck: Partial<Truck>): Promise<Truck> {
    console.log('🚛 Updating truck:', id, truck);
    return this.request<Truck>(`/trucks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(truck),
    });
  }

  async deleteTruck(id: string): Promise<void> {
    console.log('🚛 Deleting truck:', id);
    await this.request<void>(`/trucks/${id}`, {
      method: 'DELETE',
    });
  }

  async updateTruckLocation(truckId: string, lat: number, lng: number): Promise<void> {
    console.log('📍 Updating truck location:', { truckId, lat, lng });
    await this.request<void>(`/trucks/${truckId}/location`, {
      method: 'PUT',
      body: JSON.stringify({ lat, lng }),
    });
  }

  async scheduleMaintenance(truckId: string, maintenanceData: any): Promise<void> {
    console.log('🔧 Scheduling maintenance for truck:', truckId);
    await this.request<void>(`/trucks/${truckId}/maintenance`, {
      method: 'POST',
      body: JSON.stringify(maintenanceData),
    });
  }
}

export const trucksService = new TrucksService();
