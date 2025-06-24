
import { useState, useEffect } from 'react';
import { apiService } from '@/services/api';

export interface RoutePoint {
  id: string;
  address: string;
  cep: string;
  lat: number;
  lng: number;
  order: number;
  type: 'origin' | 'destination' | 'waypoint';
}

export interface Route {
  id: string;
  name: string;
  points: RoutePoint[];
  totalDistance: number;
  estimatedTime: string;
  optimizedOrder: string[];
  description?: string;
  status: 'active' | 'inactive';
  createdAt: string;
}

export const useRoutes = () => {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRoutes = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiService.getRoutes();
      setRoutes(data);
    } catch (err) {
      setError('Erro ao carregar rotas');
      console.error('Error loading routes:', err);
      // Dados mockados para desenvolvimento
      const mockRoutes: Route[] = [
        {
          id: '1',
          name: 'Rota SP-RJ Multi-pontos',
          points: [
            {
              id: '1',
              address: 'São Paulo, SP',
              cep: '01310-100',
              lat: -23.5505,
              lng: -46.6333,
              order: 1,
              type: 'origin'
            },
            {
              id: '2',
              address: 'Santos, SP',
              cep: '11010-001',
              lat: -23.9608,
              lng: -46.3331,
              order: 2,
              type: 'waypoint'
            },
            {
              id: '3',
              address: 'Rio de Janeiro, RJ',
              cep: '20040-020',
              lat: -22.9068,
              lng: -43.1729,
              order: 3,
              type: 'destination'
            }
          ],
          totalDistance: 450,
          estimatedTime: '6h 30min',
          optimizedOrder: ['1', '2', '3'],
          status: 'active',
          createdAt: new Date().toISOString()
        }
      ];
      setRoutes(mockRoutes);
    } finally {
      setLoading(false);
    }
  };

  const createRoute = async (routeData: Omit<Route, 'id' | 'createdAt'>) => {
    try {
      const newRoute = await apiService.createRoute(routeData);
      setRoutes(prev => [...prev, newRoute]);
      return newRoute;
    } catch (err) {
      setError('Erro ao criar rota');
      throw err;
    }
  };

  const optimizeRoute = async (points: RoutePoint[]) => {
    try {
      return await apiService.optimizeRoute(points);
    } catch (err) {
      setError('Erro ao otimizar rota');
      throw err;
    }
  };

  const getAddressByCep = async (cep: string) => {
    try {
      return await apiService.getAddressByCep(cep);
    } catch (err) {
      setError('Erro ao buscar endereço');
      throw err;
    }
  };

  useEffect(() => {
    loadRoutes();
  }, []);

  return {
    routes,
    loading,
    error,
    loadRoutes,
    createRoute,
    optimizeRoute,
    getAddressByCep
  };
};
