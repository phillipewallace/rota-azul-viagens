
import { useQuery } from '@tanstack/react-query';
import { routesService, type Route } from '@/services/routes';

export const useRoutes = () => {
  return useQuery({
    queryKey: ['routes'],
    queryFn: () => routesService.getRoutes(),
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
};

export type { Route };
