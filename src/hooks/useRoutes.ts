import { useState, useEffect } from 'react';
import { googleMapsService } from '@/services/googleMaps';
import { routesService } from '@/services/routes';

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
      await googleMapsService.initialize();
      return await googleMapsService.getAddressByCep(cep);
    } catch (error) {
      console.error('Error getting address by CEP:', error);
      throw error;
    }
  };

  const optimizeRoute = async (allPoints: RoutePoint[]) => {
    try {
      await googleMapsService.initialize();
      
      if (allPoints.length < 2) {
        throw new Error('É necessário pelo menos 2 pontos para criar uma rota');
      }

      // O primeiro ponto é sempre a origem, o último é sempre o destino
      const origin: RoutePoint = { ...allPoints[0], type: 'origin', order: 0 };
      const destination: RoutePoint = { ...allPoints[allPoints.length - 1], type: 'destination' };
      
      // Pontos intermediários para otimização (se houver)
      const waypoints = allPoints.slice(1, -1).map((point, index): RoutePoint => ({
        ...point,
        type: 'waypoint',
        order: index + 1
      }));

      console.log('🗺️ Otimizando rota com origem e destino fixos');
      console.log('Origem:', origin.address);
      console.log('Destino:', destination.address);
      console.log('Waypoints para otimizar:', waypoints.length);
      
      const optimizedData = await googleMapsService.optimizeRoute([origin, ...waypoints, destination]);
      
      // Reorganizar pontos com base na otimização
      let finalPoints: RoutePoint[] = [origin];
      
      if (waypoints.length > 0 && optimizedData.optimizedOrder) {
        // Pegar os waypoints otimizados (excluindo origem e destino)
        const optimizedWaypoints = optimizedData.optimizedOrder
          .slice(1, -1) // Remove origem e destino da ordem otimizada
          .map((pointId, index) => {
            const point = waypoints.find(w => w.id === pointId);
            return point ? { ...point, order: index + 1 } : null;
          })
          .filter((point): point is RoutePoint => point !== null);
        
        finalPoints.push(...optimizedWaypoints);
      }
      
      // Destino sempre por último
      destination.order = finalPoints.length;
      finalPoints.push(destination);

      console.log('✅ Rota otimizada com sucesso');
      
      return {
        optimizedOrder: finalPoints.map(p => p.id),
        totalDistance: optimizedData.totalDistance,
        estimatedTime: optimizedData.estimatedTime,
        polyline: optimizedData.polyline,
        detailedRoute: optimizedData.detailedRoute,
        points: finalPoints
      };
    } catch (error) {
      console.error('Error optimizing route:', error);
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
