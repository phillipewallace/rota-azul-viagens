
import { Route, RoutePoint } from '@/hooks/useRoutes';
import { BaseApiService } from './base';

export class RoutesService extends BaseApiService {
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

  // ✅ NOVO: Otimização inteligente por blocos
  async optimizeRouteIntelligent(id: string, points: RoutePoint[]): Promise<{
    points: RoutePoint[];
    optimizedOrder: string[];
    totalDistance: number;
    estimatedTime: string;
    blocksProcessed: number;
    preservedPoints: number;
    optimizedPoints: number;
  }> {
    console.log(`🧠 [ROUTES SERVICE] Iniciando otimização inteligente por blocos para rota ${id}`);
    console.log(`🧠 [ROUTES SERVICE] Pontos para otimizar: ${points.length}`);
    
    const response = await this.request<{
      points: RoutePoint[];
      optimizedOrder: string[];
      totalDistance: number;
      estimatedTime: string;
      blocksProcessed: number;
      preservedPoints: number;
      optimizedPoints: number;
    }>(`/routes/${id}/optimize-intelligent`, {
      method: 'POST',
      body: JSON.stringify({
        points: points.map((point, index) => ({
          id: point.id,
          address: point.address,
          cep: point.cep,
          lat: point.lat,
          lng: point.lng,
          order: index,
          type: point.type,
          completed: point.completed ?? false,
          completedAt: point.completedAt ?? null,
        })),
      }),
    });

    console.log(`✅ [ROUTES SERVICE] Otimização inteligente concluída:`);
    console.log(`   - ${response.blocksProcessed} blocos processados`);
    console.log(`   - ${response.preservedPoints} pontos preservados`);
    console.log(`   - ${response.optimizedPoints} pontos otimizados`);
    console.log(`   - Distância total: ${response.totalDistance.toFixed(1)}km`);
    console.log(`   - Tempo estimado: ${response.estimatedTime}`);

    return response;
  }
}

export const routesService = new RoutesService();
