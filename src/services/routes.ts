
const API_BASE_URL = import.meta.env.MODE === 'production' 
  ? 'https://your-api-domain.com/api' 
  : 'http://localhost:3001/api';

export const routesService = {
  async getRoutes() {
    const response = await fetch(`${API_BASE_URL}/routes`);
    if (!response.ok) {
      throw new Error('Failed to fetch routes');
    }
    return response.json();
  },

  async createRoute(routeData: any) {
    const response = await fetch(`${API_BASE_URL}/routes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(routeData),
    });
    if (!response.ok) {
      throw new Error('Failed to create route');
    }
    return response.json();
  },

  async updateRoute(id: string, routeData: any) {
    const response = await fetch(`${API_BASE_URL}/routes/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(routeData),
    });
    if (!response.ok) {
      throw new Error('Failed to update route');
    }
    return response.json();
  },

  async deleteRoute(id: string) {
    const response = await fetch(`${API_BASE_URL}/routes/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to delete route');
    }
    return response.json();
  }
};
