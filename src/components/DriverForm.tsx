
import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Driver } from '@/hooks/useDrivers';

const driverSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email('Email inválido'),
  phone: z.string().min(1, 'Telefone é obrigatório'),
  license: z.string().min(1, 'CNH é obrigatória'),
  status: z.enum(['active', 'inactive']),
});

type DriverFormData = z.infer<typeof driverSchema>;

interface DriverFormProps {
  driver?: Driver;
  onSubmit: (data: DriverFormData) => void;
  onCancel: () => void;
  loading?: boolean;
}

const DriverForm: React.FC<DriverFormProps> = ({ driver, onSubmit, onCancel, loading }) => {
  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<DriverFormData>({
    resolver: zodResolver(driverSchema),
    defaultValues: driver ? {
      name: driver.name || '',
      email: driver.email || '',
      phone: driver.phone || '',
      license: driver.license || '',
      status: driver.status || 'active',
    } : {
      status: 'active'
    }
  });

  const statusValue = watch('status');

  useEffect(() => {
    if (driver) {
      setValue('name', driver.name || '');
      setValue('email', driver.email || '');
      setValue('phone', driver.phone || '');
      setValue('license', driver.license || '');
      setValue('status', driver.status || 'active');
    }
  }, [driver, setValue]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">Nome *</Label>
          <Input
            id="name"
            {...register('name')}
            placeholder="Nome completo"
          />
          {errors.name && (
            <span className="text-red-500 text-sm">{errors.name.message}</span>
          )}
        </div>

        <div>
          <Label htmlFor="license">CNH *</Label>
          <Input
            id="license"
            {...register('license')}
            placeholder="Número da CNH"
          />
          {errors.license && (
            <span className="text-red-500 text-sm">{errors.license.message}</span>
          )}
        </div>

        <div>
          <Label htmlFor="phone">Telefone *</Label>
          <Input
            id="phone"
            {...register('phone')}
            placeholder="(11) 99999-9999"
          />
          {errors.phone && (
            <span className="text-red-500 text-sm">{errors.phone.message}</span>
          )}
        </div>

        <div>
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            type="email"
            {...register('email')}
            placeholder="email@exemplo.com"
          />
          {errors.email && (
            <span className="text-red-500 text-sm">{errors.email.message}</span>
          )}
        </div>

        <div>
          <Label htmlFor="status">Status</Label>
          <Select value={statusValue} onValueChange={(value: 'active' | 'inactive') => setValue('status', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Ativo</SelectItem>
              <SelectItem value="inactive">Inativo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Salvando...' : driver ? 'Atualizar' : 'Criar'}
        </Button>
      </div>
    </form>
  );
};

export default DriverForm;
