
// Configuração base para comunicação com backend personalizado
const API_BASE_URL = process.env.VITE_API_URL || 'http://localhost:3001/api';

class ApiService {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('API Request failed:', error);
      throw error;
    }
  }

  // Rotas
  async getRoutes() {
    return this.request('/routes');
  }

  async createRoute(routeData: any) {
    return this.request('/routes', {
      method: 'POST',
      body: JSON.stringify(routeData),
    });
  }

  async updateRoute(id: string, routeData: any) {
    return this.request(`/routes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(routeData),
    });
  }

  async deleteRoute(id: string) {
    return this.request(`/routes/${id}`, {
      method: 'DELETE',
    });
  }

  // Caminhões
  async getTrucks() {
    return this.request('/trucks');
  }

  async createTruck(truckData: any) {
    return this.request('/trucks', {
      method: 'POST',
      body: JSON.stringify(truckData),
    });
  }

  async updateTruck(id: string, truckData: any) {
    return this.request(`/trucks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(truckData),
    });
  }

  // Motoristas
  async getDrivers() {
    return this.request('/drivers');
  }

  async createDriver(driverData: any) {
    return this.request('/drivers', {
      method: 'POST',
      body: JSON.stringify(driverData),
    });
  }

  async updateDriver(id: string, driverData: any) {
    return this.request(`/drivers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(driverData),
    });
  }

  // Manutenção
  async getMaintenanceSchedule() {
    return this.request('/maintenance');
  }

  async scheduleMainte(maintenanceData: any) {
    return this.request('/maintenance', {
      method: 'POST',
      body: JSON.stringify(maintenanceData),
    });
  }

  // Rastreamento
  async getTrackingData() {
    return this.request('/tracking');
  }

  // Relatórios
  async getReports(params?: any) {
    const queryParams = params ? `?${new URLSearchParams(params)}` : '';
    return this.request(`/reports${queryParams}`);
  }
}

export const apiService = new ApiService();
export default ApiService;
