
import React from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Schedule } from '@/hooks/useSchedule';
import { useTrucks } from '@/hooks/useTrucks';
import { useDrivers } from '@/hooks/useDrivers';
import { useRoutes } from '@/hooks/useRoutes';

interface ScheduleFormProps {
  schedule?: Schedule;
  onSubmit: (data: Omit<Schedule, 'id'>) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const ScheduleForm = ({ schedule, onSubmit, onCancel, isLoading }: ScheduleFormProps) => {
  const { trucks } = useTrucks();
  const { drivers } = useDrivers();
  const { routes } = useRoutes();
  
  const { register, handleSubmit, setValue, watch } = useForm<Omit<Schedule, 'id'>>({
    defaultValues: schedule ? {
      truck_id: schedule.truck_id,
      route_id: schedule.route_id,
      driver_id: schedule.driver_id,
      scheduled_date: schedule.scheduled_date,
      scheduled_time: schedule.scheduled_time,
      status: schedule.status,
    } : {
      truck_id: '',
      route_id: '',
      driver_id: '',
      scheduled_date: new Date().toISOString().split('T')[0],
      scheduled_time: '08:00',
      status: 'scheduled' as const,
    }
  });

  const status = watch('status');
  const selectedTruckId = watch('truck_id');
  const selectedDriverId = watch('driver_id');
  const selectedRouteId = watch('route_id');

  const handleTruckChange = (truckId: string) => {
    setValue('truck_id', truckId);
  };

  const handleDriverChange = (driverId: string) => {
    setValue('driver_id', driverId);
  };

  const handleRouteChange = (routeId: string) => {
    setValue('route_id', routeId);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="truck_id">Caminhão</Label>
        <Select value={selectedTruckId} onValueChange={handleTruckChange}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione um caminhão" />
          </SelectTrigger>
          <SelectContent>
            {trucks.map((truck) => (
              <SelectItem key={truck.id} value={truck.id}>
                {truck.name} - {truck.plate}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="driver_id">Motorista</Label>
        <Select value={selectedDriverId} onValueChange={handleDriverChange}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione um motorista" />
          </SelectTrigger>
          <SelectContent>
            {drivers.map((driver) => (
              <SelectItem key={driver.id} value={driver.id}>
                {driver.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="route_id">Rota</Label>
        <Select value={selectedRouteId} onValueChange={handleRouteChange}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione uma rota" />
          </SelectTrigger>
          <SelectContent>
            {routes.map((route) => (
              <SelectItem key={route.id} value={route.id}>
                {route.name} - {route.points?.length || 0} pontos
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="scheduled_date">Data</Label>
          <Input 
            type="date" 
            {...register('scheduled_date', { required: true })}
          />
        </div>
        <div>
          <Label htmlFor="scheduled_time">Horário</Label>
          <Input 
            type="time" 
            {...register('scheduled_time', { required: true })}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="status">Status</Label>
        <Select value={status} onValueChange={(value) => setValue('status', value as Schedule['status'])}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="scheduled">Agendado</SelectItem>
            <SelectItem value="in_progress">Em Andamento</SelectItem>
            <SelectItem value="completed">Concluído</SelectItem>
            <SelectItem value="cancelled">Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2 pt-4">
        <Button type="submit" disabled={isLoading}>
          {schedule ? 'Atualizar' : 'Criar'} Agendamento
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
};
