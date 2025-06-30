
import React from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Route } from '@/hooks/useRoutes';

interface RouteFormProps {
  route?: Route;
  onSubmit: (data: Partial<Route>) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const RouteForm = ({ route, onSubmit, onCancel, isLoading }: RouteFormProps) => {
  const { register, handleSubmit, setValue, watch } = useForm<Partial<Route>>({
    defaultValues: route ? {
      name: route.name,
      description: route.description || '',
      status: route.status,
      estimatedTime: route.estimatedTime,
    } : {
      name: '',
      description: '',
      status: 'active' as const,
      estimatedTime: '',
    }
  });

  const status = watch('status');

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="name">Nome da Rota</Label>
        <Input {...register('name', { required: true })} placeholder="Ex: Rota Centro" />
      </div>

      <div>
        <Label htmlFor="description">Descrição</Label>
        <Textarea 
          {...register('description')} 
          placeholder="Descrição da rota (opcional)"
          rows={3}
        />
      </div>

      <div>
        <Label htmlFor="estimatedTime">Tempo Estimado</Label>
        <Input 
          {...register('estimatedTime')} 
          placeholder="Ex: 2h 30min"
        />
      </div>

      <div>
        <Label htmlFor="status">Status</Label>
        <Select value={status} onValueChange={(value) => setValue('status', value as Route['status'])}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Ativa</SelectItem>
            <SelectItem value="inactive">Inativa</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2 pt-4">
        <Button type="submit" disabled={isLoading}>
          {route ? 'Atualizar' : 'Criar'} Rota
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
};
