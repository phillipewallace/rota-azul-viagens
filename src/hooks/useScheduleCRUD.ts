
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Schedule } from './useSchedule';

const API_BASE_URL = import.meta.env.MODE === 'production' 
  ? 'https://your-api-domain.com/api' 
  : 'http://localhost:3001/api';

export const useScheduleCRUD = () => {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (schedule: Omit<Schedule, 'id'>) => {
      const response = await fetch(`${API_BASE_URL}/schedules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(schedule),
      });
      if (!response.ok) throw new Error('Erro ao criar agendamento');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, schedule }: { id: string; schedule: Partial<Schedule> }) => {
      const response = await fetch(`${API_BASE_URL}/schedules/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(schedule),
      });
      if (!response.ok) throw new Error('Erro ao atualizar agendamento');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`${API_BASE_URL}/schedules/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Erro ao excluir agendamento');
      return response.json();
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
