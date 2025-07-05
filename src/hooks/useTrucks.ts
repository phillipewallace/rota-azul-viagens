
import { useQuery } from '@tanstack/react-query';
import { trucksService, type Truck } from '@/services/trucks';

export const useTrucks = () => {
  const query = useQuery({
    queryKey: ['trucks'],
    queryFn: () => trucksService.getTrucks(),
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  return {
    ...query,
    trucks: query.data || [],
    loading: query.isLoading,
    refetch: query.refetch,
  };
};

export type { Truck };
