
import React from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Driver } from '@/hooks/useDrivers';

interface DriverFormProps {
  driver?: Driver;
  onSubmit: (data: Omit<Driver, 'id'>) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const DriverForm = ({ driver, onSubmit, onCancel, isLoading }: DriverFormProps) => {
  const { register, handleSubmit, setValue, watch } = useForm<Omit<Driver, 'id'>>({
    defaultValues: driver ? {
      name: driver.name,
      phone: driver.phone,
      email: driver.email,
      license: driver.license,
      status: driver.status,
    } : {
      name: '',
      phone: '',
      email: '',
      license: '',
      status: 'active' as const,
    }
  });

  const status = watch('status');

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="name">Nome Completo</Label>
        <Input {...register('name', { required: true })} placeholder="Ex: João Silva" />
      </div>

      <div>
        <Label htmlFor="phone">Telefone</Label>
        <Input {...register('phone', { required: true })} placeholder="(11) 99999-9999" />
      </div>

      <div>
        <Label htmlFor="email">E-mail</Label>
        <Input type="email" {...register('email', { required: true })} placeholder="joao@exemplo.com" />
      </div>

      <div>
        <Label htmlFor="license">CNH</Label>
        <Input {...register('license', { required: true })} placeholder="12345678901" />
      </div>

      <div>
        <Label htmlFor="status">Status</Label>
        <Select value={status} onValueChange={(value) => setValue('status', value as Driver['status'])}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Ativo</SelectItem>
            <SelectItem value="inactive">Inativo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2 pt-4">
        <Button type="submit" disabled={isLoading}>
          {driver ? 'Atualizar' : 'Criar'} Motorista
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
};
