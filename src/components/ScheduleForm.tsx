
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

interface ScheduleFormProps {
  schedule?: Schedule;
  onSubmit: (data: Omit<Schedule, 'id'>) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const ScheduleForm = ({ schedule, onSubmit, onCancel, isLoading }: ScheduleFormProps) => {
  const { trucks } = useTrucks();
  const { drivers } = useDrivers();
  
  const { register, handleSubmit, setValue, watch } = useForm<Omit<Schedule, 'id'>>({
    defaultValues: schedule ? {
      truckId: schedule.truckId,
      truck: schedule.truck,
      route: schedule.route,
      driverId: schedule.driverId,
      driver: schedule.driver,
      scheduledDate: schedule.scheduledDate,
      scheduledTime: schedule.scheduledTime,
      status: schedule.status,
      notes: schedule.notes || '',
    } : {
      truckId: '',
      truck: '',
      route: '',
      driverId: '',
      driver: '',
      scheduledDate: new Date().toISOString().split('T')[0],
      scheduledTime: '08:00',
      status: 'scheduled' as const,
      notes: '',
    }
  });

  const status = watch('status');
  const selectedTruckId = watch('truckId');
  const selectedDriverId = watch('driverId');

  const handleTruckChange = (truckId: string) => {
    const truck = trucks.find(t => t.id === truckId);
    if (truck) {
      setValue('truckId', truckId);
      setValue('truck', truck.name);
    }
  };

  const handleDriverChange = (driverId: string) => {
    const driver = drivers.find(d => d.id === driverId);
    if (driver) {
      setValue('driverId', driverId);
      setValue('driver', driver.name);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="truck">Caminhão</Label>
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
        <Label htmlFor="driver">Motorista</Label>
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
        <Label htmlFor="route">Rota</Label>
        <Input {...register('route', { required: true })} placeholder="Ex: SP → RJ" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="scheduledDate">Data</Label>
          <Input 
            type="date" 
            {...register('scheduledDate', { required: true })}
          />
        </div>
        <div>
          <Label htmlFor="scheduledTime">Horário</Label>
          <Input 
            type="time" 
            {...register('scheduledTime', { required: true })}
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
            <SelectItem value="in-progress">Em Andamento</SelectItem>
            <SelectItem value="completed">Concluído</SelectItem>
            <SelectItem value="cancelled">Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="notes">Observações</Label>
        <Textarea 
          {...register('notes')} 
          placeholder="Observações adicionais (opcional)"
          rows={3}
        />
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
