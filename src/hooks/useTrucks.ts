
import { useQuery } from '@tanstack/react-query';
import { trucksService, type Truck } from '@/services/trucks';

export const useTrucks = () => {
  return useQuery({
    queryKey: ['trucks'],
    queryFn: () => trucksService.getTrucks(),
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
};

export type { Truck };
