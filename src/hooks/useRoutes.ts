
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { routesService } from '@/services/routes';
import { toast } from '@/hooks/use-toast';

export interface RoutePoint {
  id?: string;
  address: string;
  lat: number;
  lng: number;
  order: number;
  type: 'origin' | 'destination' | 'waypoint';
  completed?: boolean;
  completedAt?: string;
}

export interface Route {
  id: string;
  name: string;
  description?: string;
  points: RoutePoint[];
  totalDistance: number;
  estimatedTime?: string;
  estimatedDuration: number;
  optimizedOrder: string[];
  polyline?: string;
  status: string;
  createdAt: string;
  pointCount?: number;
}

export const useRoutes = () => {
  const queryClient = useQueryClient();

  // OTIMIZAÇÃO: Query com cache mais agressivo
  const {
    data: routes = [],
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['routes'],
    queryFn: () => routesService.getRoutes(),
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
  });

  const createRouteMutation = useMutation({
    mutationFn: (route: Omit<Route, 'id' | 'createdAt'>) => routesService.createRoute(route),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      toast({
        title: "Sucesso",
        description: "Rota criada com sucesso!",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: "Erro ao criar rota. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const updateRouteMutation = useMutation({
    mutationFn: ({ id, route }: { id: string; route: Partial<Route> }) => 
      routesService.updateRoute(id, route),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      toast({
        title: "Sucesso",
        description: "Rota atualizada com sucesso!",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: "Erro ao atualizar rota. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const deleteRouteMutation = useMutation({
    mutationFn: (id: string) => routesService.deleteRoute(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      toast({
        title: "Sucesso",
        description: "Rota excluída com sucesso!",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: "Erro ao excluir rota. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  return {
    routes,
    isLoading,
    error,
    refetch,
    createRoute: createRouteMutation.mutateAsync,
    updateRoute: updateRouteMutation.mutateAsync,
    deleteRoute: deleteRouteMutation.mutateAsync,
    isCreating: createRouteMutation.isPending,
    isUpdating: updateRouteMutation.isPending,
    isDeleting: deleteRouteMutation.isPending,
  };
};

// OTIMIZAÇÃO: Hook específico para rota única
export const useRoute = (id: string) => {
  return useQuery({
    queryKey: ['route', id],
    queryFn: () => routesService.getRoutes().then(routes => routes.find(r => r.id === id)),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
};
