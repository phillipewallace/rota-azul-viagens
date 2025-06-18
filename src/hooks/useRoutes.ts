
import { useState, useEffect } from 'react';
import { apiService } from '@/services/api';

export interface Route {
  id: string;
  name: string;
  origin: string;
  destination: string;
  distance: number;
  estimatedTime: string;
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
      setRoutes([
        {
          id: '1',
          name: 'Rota SP-RJ',
          origin: 'São Paulo, SP',
          destination: 'Rio de Janeiro, RJ',
          distance: 450,
          estimatedTime: '6h 30min',
          status: 'active',
          createdAt: new Date().toISOString()
        },
        {
          id: '2',
          name: 'Rota SP-MG',
          origin: 'São Paulo, SP',
          destination: 'Belo Horizonte, MG',
          distance: 320,
          estimatedTime: '4h 45min',
          status: 'active',
          createdAt: new Date().toISOString()
        }
      ]);
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

  useEffect(() => {
    loadRoutes();
  }, []);

  return {
    routes,
    loading,
    error,
    loadRoutes,
    createRoute
  };
};
