
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

const API_BASE_URL = import.meta.env.MODE === 'production' 
  ? 'https://your-api-domain.com/api' 
  : 'http://localhost:3001/api';

const fetchRoutes = async (): Promise<Route[]> => {
  const response = await fetch(`${API_BASE_URL}/routes`);
  if (!response.ok) {
    throw new Error('Erro ao carregar rotas');
  }
  return response.json();
};

export const useRoutes = () => {
  const queryClient = useQueryClient();

  const { data: routes = [], isLoading: loading, error } = useQuery({
    queryKey: ['routes'],
    queryFn: fetchRoutes,
    retry: 2,
  });

  const createRouteMutation = useMutation({
    mutationFn: (routeData: Omit<Route, 'id' | 'createdAt'>) => 
      apiService.createRoute(routeData),
    onSuccess: (newRoute) => {
      queryClient.setQueryData(['routes'], (oldData: Route[] | undefined) => {
        return oldData ? [...oldData, newRoute] : [newRoute];
      });
    },
  });

  const createRoute = async (routeData: Omit<Route, 'id' | 'createdAt'>) => {
    return createRouteMutation.mutateAsync(routeData);
  };

  const optimizeRoute = async (points: RoutePoint[]) => {
    try {
      console.log('Optimizing route with points:', points);
      return await apiService.optimizeRoute(points);
    } catch (err) {
      console.error('Error optimizing route:', err);
      throw new Error('Erro ao otimizar rota');
    }
  };

  const getAddressByCep = async (cep: string) => {
    try {
      console.log('Getting address for CEP:', cep);
      return await apiService.getAddressByCep(cep);
    } catch (err) {
      console.error('Error getting address by CEP:', err);
      throw new Error('Erro ao buscar endereço');
    }
  };

  const loadRoutes = async () => {
    queryClient.invalidateQueries({ queryKey: ['routes'] });
  };

  return {
    routes,
    loading,
    error: error ? 'Erro ao carregar rotas' : null,
    loadRoutes,
    createRoute,
    optimizeRoute,
    getAddressByCep
  };
};
