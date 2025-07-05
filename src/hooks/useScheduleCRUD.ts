
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Schedule } from './useSchedule';
import { BaseApiService } from '@/services/base';

class ScheduleCRUDService extends BaseApiService {
  async createSchedule(schedule: Omit<Schedule, 'id'>): Promise<Schedule> {
    return this.request<Schedule>('/schedules', {
      method: 'POST',
      body: JSON.stringify(schedule),
    });
  }

  async updateSchedule(id: string, schedule: Partial<Schedule>): Promise<Schedule> {
    return this.request<Schedule>(`/schedules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(schedule),
    });
  }

  async deleteSchedule(id: string): Promise<void> {
    return this.request<void>(`/schedules/${id}`, {
      method: 'DELETE',
    });
  }
}

const scheduleCRUDService = new ScheduleCRUDService();

export const useScheduleCRUD = () => {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (schedule: Omit<Schedule, 'id'>) => {
      return scheduleCRUDService.createSchedule(schedule);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, schedule }: { id: string; schedule: Partial<Schedule> }) => {
      return scheduleCRUDService.updateSchedule(id, schedule);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return scheduleCRUDService.deleteSchedule(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
    },
  });

  return {
    createSchedule: createMutation.mutateAsync,
    updateSchedule: updateMutation.mutateAsync,
    deleteSchedule: deleteMutation.mutateAsync,
    isLoading: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
  };
};
