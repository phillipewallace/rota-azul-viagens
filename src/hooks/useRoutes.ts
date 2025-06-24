
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
      console.log('Routes loaded successfully:', data);
    } catch (err) {
      setError('Erro ao carregar rotas');
      console.error('Error loading routes:', err);
      setRoutes([]); // Limpa os dados em caso de erro
    } finally {
      setLoading(false);
    }
  };

  const createRoute = async (routeData: Omit<Route, 'id' | 'createdAt'>) => {
    try {
      const newRoute = await apiService.createRoute(routeData);
      setRoutes(prev => [...prev, newRoute]);
      console.log('Route created successfully:', newRoute);
      return newRoute;
    } catch (err) {
      setError('Erro ao criar rota');
      console.error('Error creating route:', err);
      throw err;
    }
  };

  const optimizeRoute = async (points: RoutePoint[]) => {
    try {
      console.log('Optimizing route with points:', points);
      return await apiService.optimizeRoute(points);
    } catch (err) {
      setError('Erro ao otimizar rota');
      console.error('Error optimizing route:', err);
      throw err;
    }
  };

  const getAddressByCep = async (cep: string) => {
    try {
      console.log('Getting address for CEP:', cep);
      return await apiService.getAddressByCep(cep);
    } catch (err) {
      setError('Erro ao buscar endereço');
      console.error('Error getting address by CEP:', err);
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
