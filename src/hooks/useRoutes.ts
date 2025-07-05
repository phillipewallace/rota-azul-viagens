
import { useQuery } from '@tanstack/react-query';
import { routesService } from '@/services/routes';
import { geocodingService } from '@/services/geocoding';

export interface RoutePoint {
  id: string;
  address: string;
  cep?: string;
  lat: number;
  lng: number;
  order: number;
  type: 'origin' | 'destination' | 'waypoint';
  completed?: boolean;
}

export interface Route {
  id: string;
  name: string;
  description?: string;
  points: RoutePoint[];
  status: 'active' | 'inactive';
  totalDistance?: number;
  estimatedTime?: number;
  createdAt?: string;
}

export const useRoutes = () => {
  const query = useQuery({
    queryKey: ['routes'],
    queryFn: () => routesService.getRoutes(),
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  const getAddressByCep = async (cep: string) => {
    return geocodingService.getAddressByCep(cep);
  };

  const optimizeRoute = async (points: RoutePoint[]) => {
    return geocodingService.optimizeRoute(points);
  };

  return {
    ...query,
    routes: query.data || [],
    loading: query.isLoading,
    getAddressByCep,
    optimizeRoute,
  };
};
