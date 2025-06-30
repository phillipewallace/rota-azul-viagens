
import React from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Truck } from '@/hooks/useTrucks';

interface TruckFormProps {
  truck?: Truck;
  onSubmit: (data: Omit<Truck, 'id'>) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const TruckForm = ({ truck, onSubmit, onCancel, isLoading }: TruckFormProps) => {
  const { register, handleSubmit, setValue, watch } = useForm<Omit<Truck, 'id'>>({
    defaultValues: truck ? {
      name: truck.name,
      plate: truck.plate,
      model: truck.model,
      year: truck.year,
      status: truck.status,
      driver: truck.driver || '',
      lastMaintenance: truck.lastMaintenance,
      mileage: truck.mileage,
    } : {
      name: '',
      plate: '',
      model: '',
      year: new Date().getFullYear(),
      status: 'available' as const,
      driver: '',
      lastMaintenance: new Date().toISOString().split('T')[0],
      mileage: 0,
    }
  });

  const status = watch('status');

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="name">Nome do Caminhão</Label>
        <Input {...register('name', { required: true })} placeholder="Ex: Caminhão 01" />
      </div>

      <div>
        <Label htmlFor="plate">Placa</Label>
        <Input {...register('plate', { required: true })} placeholder="Ex: ABC-1234" />
      </div>

      <div>
        <Label htmlFor="model">Modelo</Label>
        <Input {...register('model', { required: true })} placeholder="Ex: Mercedes Atego" />
      </div>

      <div>
        <Label htmlFor="year">Ano</Label>
        <Input 
          type="number" 
          {...register('year', { required: true, valueAsNumber: true })} 
          min="1990" 
          max={new Date().getFullYear() + 1}
        />
      </div>

      <div>
        <Label htmlFor="status">Status</Label>
        <Select value={status} onValueChange={(value) => setValue('status', value as Truck['status'])}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="available">Disponível</SelectItem>
            <SelectItem value="in-route">Em Rota</SelectItem>
            <SelectItem value="maintenance">Manutenção</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="driver">Motorista</Label>
        <Input {...register('driver')} placeholder="Nome do motorista (opcional)" />
      </div>

      <div>
        <Label htmlFor="mileage">Quilometragem</Label>
        <Input 
          type="number" 
          {...register('mileage', { valueAsNumber: true })} 
          placeholder="0"
        />
      </div>

      <div>
        <Label htmlFor="lastMaintenance">Última Manutenção</Label>
        <Input 
          type="date" 
          {...register('lastMaintenance', { required: true })}
        />
      </div>

      <div className="flex gap-2 pt-4">
        <Button type="submit" disabled={isLoading}>
          {truck ? 'Atualizar' : 'Criar'} Caminhão
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
};
