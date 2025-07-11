import { useState, useEffect } from 'react';
import { routesService } from '@/services/routes';
import { API_CONFIG } from '@/services/config';

export interface RoutePoint {
  id: string;
  address: string;
  cep: string;
  lat: number;
  lng: number;
  order: number;
  type: 'origin' | 'destination' | 'waypoint';
  completed?: boolean;         // <-- Adicionado
  completedAt?: string | null; // <-- Adicionado
}

export interface Route {
  id: string;
  name: string;
  description?: string;
  points: RoutePoint[];
  totalDistance: number;
  estimatedTime: string;
  optimizedOrder: string[];
  status: 'active' | 'inactive' | 'completed';
  createdAt: string;
  polyline?: string;
}

export const useRoutes = () => {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRoutes = async () => {
    try {
      setLoading(true);
      const data = await routesService.getRoutes();
      setRoutes(data);
    } catch (error) {
      console.error('Error loading routes:', error);
    } finally {
      setLoading(false);
    }
  };

  const getAddressByCep = async (cep: string) => {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/geocoding/cep/${cep}`);
      if (!response.ok) {
        throw new Error('Erro ao buscar endereço por CEP');
      }
      return await response.json();
    } catch (error) {
      console.error('Error getting address by CEP:', error);
      throw error;
    }
  };

const optimizeRoute = async (allPoints: RoutePoint[]) => {
  try {
    console.log('🚀 [USE ROUTES V2] Iniciando otimização com Routes API v2');

    if (allPoints.length < 2) {
      throw new Error('É necessário pelo menos 2 pontos para criar uma rota');
    }

    const response = await fetch(`${API_CONFIG.BASE_URL}/geocoding/optimize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        points: allPoints.map((point, index) => ({
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

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [USE ROUTES V2] Erro na resposta da API:', response.status, errorText);
      throw new Error('Erro na otimização da rota com Routes API v2');
    }

    const optimizedData = await response.json();

    console.log(`✅ [USE ROUTES V2] Rota otimizada com Routes API v2`);
    console.log(`📊 [USE ROUTES V2] Resultado: ${optimizedData.totalDistance}km, ${optimizedData.estimatedTime}`);

    return {
      optimizedOrder: optimizedData.optimizedOrder,
      totalDistance: optimizedData.totalDistance,
      estimatedTime: optimizedData.estimatedTime,
      polyline: optimizedData.polyline,
      detailedRoute: null,
      points: optimizedData.points.map((p: any, index: number) => {
        const original = allPoints.find(op => op.id === p.id);

        return {
          id: p.id,
          address: p.address,
          cep: p.cep || '',
          lat: p.lat,
          lng: p.lng,
          order: index,
          type: p.type,
          completed: original?.completed ?? false,
          completedAt: original?.completedAt ?? null,
        };
      }),
    };
  } catch (error) {
    console.error('❌ [USE ROUTES V2] Error optimizing route:', error);
    throw error;
  }
};

  const createRoute = async (routeData: Omit<Route, 'id' | 'createdAt'>) => {
    try {
      const newRoute = await routesService.createRoute(routeData);
      await loadRoutes();
      return newRoute;
    } catch (error) {
      console.error('Error creating route:', error);
      throw error;
    }
  };

  const updateRoute = async (id: string, routeData: Partial<Route>) => {
    try {
      const updatedRoute = await routesService.updateRoute(id, routeData);
      await loadRoutes();
      return updatedRoute;
    } catch (error) {
      console.error('Error updating route:', error);
      throw error;
    }
  };

  const deleteRoute = async (id: string) => {
    try {
      await routesService.deleteRoute(id);
      await loadRoutes();
    } catch (error) {
      console.error('Error deleting route:', error);
      throw error;
    }
  };

  useEffect(() => {
    loadRoutes();
  }, []);

  return {
    routes,
    loading,
    loadRoutes,
    getAddressByCep,
    optimizeRoute,
    createRoute,
    updateRoute,
    deleteRoute
  };
};
