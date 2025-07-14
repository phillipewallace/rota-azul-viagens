import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { useRoutes, RoutePoint, Route } from '@/hooks/useRoutes';
import RouteOptimizationDialog from './RouteOptimizationDialog';

// Define o schema de validação com Zod
const routeSchema = z.object({
  name: z.string().min(1, 'O nome da rota é obrigatório'),
  description: z.string().optional(),
  points: z.array(z.object({
    address: z.string().min(1, 'O endereço é obrigatório'),
    cep: z.string().optional(),
    lat: z.number(),
    lng: z.number(),
    order: z.number(),
    type: z.enum(['origin', 'destination', 'waypoint']),
    completed: z.boolean(),
    completedAt: z.string().nullable(),
  })).min(2, 'É necessário pelo menos 2 pontos na rota'),
  totalDistance: z.number().optional(),
  estimatedTime: z.string().optional(),
  optimizedOrder: z.array(z.string()).optional(),
});

type RouteFormData = z.infer<typeof routeSchema>;

// Define a interface para as propriedades do componente
interface RouteFormProps {
  onSubmit: (routeData: any) => void;
  editingRoute?: Route;
  onCancel?: () => void;
}

// Componente funcional RouteForm
const RouteForm = ({ onSubmit, editingRoute, onCancel }: RouteFormProps) => {
  const { getAddressByCep, createOrUpdateRoute } = useRoutes();
  const [points, setPoints] = useState<RoutePoint[]>(editingRoute?.points || []);
  const [totalDistance, setTotalDistance] = useState<number>(editingRoute?.totalDistance || 0);
  const [estimatedTime, setEstimatedTime] = useState<string>(editingRoute?.estimatedTime || '');
  const [optimizedOrder, setOptimizedOrder] = useState<string[]>(editingRoute?.optimizedOrder || []);
  const [optimizing, setOptimizing] = useState(false);
  const [showOptimizationDialog, setShowOptimizationDialog] = useState(false);

  // Inicializa o formulário com react-hook-form
  const { register, handleSubmit, setValue, formState: { errors }, reset } = useForm<RouteFormData>({
    resolver: zodResolver(routeSchema),
    defaultValues: {
      name: editingRoute?.name || '',
      description: editingRoute?.description || '',
      points: editingRoute?.points || [],
      totalDistance: editingRoute?.totalDistance || 0,
      estimatedTime: editingRoute?.estimatedTime || '',
      optimizedOrder: editingRoute?.optimizedOrder || [],
    }
  });

  // Efeito para resetar o formulário quando editingRoute muda
  useEffect(() => {
    if (editingRoute) {
      reset({
        name: editingRoute.name,
        description: editingRoute.description || '',
        points: editingRoute.points,
        totalDistance: editingRoute.totalDistance,
        estimatedTime: editingRoute.estimatedTime,
        optimizedOrder: editingRoute.optimizedOrder,
      });
      setPoints(editingRoute.points);
      setTotalDistance(editingRoute.totalDistance);
      setEstimatedTime(editingRoute.estimatedTime);
      setOptimizedOrder(editingRoute.optimizedOrder);
    } else {
      reset({
        name: '',
        description: '',
        points: [],
        totalDistance: 0,
        estimatedTime: '',
        optimizedOrder: [],
      });
      setPoints([]);
      setTotalDistance(0);
      setEstimatedTime('');
      setOptimizedOrder([]);
    }
  }, [editingRoute, reset]);

  // Função para adicionar um novo ponto
  const handleAddPoint = () => {
    const newPoint: RoutePoint = {
      id: `point-${Date.now()}`,
      address: '',
      cep: '',
      lat: 0,
      lng: 0,
      order: points.length,
      type: 'waypoint',
      completed: false,
      completedAt: null,
    };
    setPoints([...points, newPoint]);
  };

  // Função para remover um ponto
  const handleRemovePoint = (index: number) => {
    const newPoints = [...points];
    newPoints.splice(index, 1);
    const updatedPoints = newPoints.map((point, i) => ({ ...point, order: i }));
    setPoints(updatedPoints);
  };

  // Função para buscar o endereço pelo CEP
  const handleSearchCep = async (index: number, cep: string) => {
    try {
      const addressData = await getAddressByCep(cep);
      const newPoints = [...points];
      newPoints[index] = {
        ...newPoints[index],
        address: addressData.address,
        lat: addressData.lat,
        lng: addressData.lng,
        cep: cep,
      };
      setPoints(newPoints);
      setValue(`points.${index}.address`, addressData.address);
      setValue(`points.${index}.lat`, addressData.lat);
      setValue(`points.${index}.lng`, addressData.lng);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao buscar endereço');
    }
  };

  // Função para atualizar o valor de um ponto
  const handlePointChange = (index: number, field: string, value: any) => {
    const newPoints = [...points];
    newPoints[index] = { ...newPoints[index], [field]: value };
    setPoints(newPoints);
  };

  // Função para gerar o preview da rota
  const handleOptimizeClick = () => {
    console.log('🎯 [ROUTE FORM] Clicou em Gerar Preview - Forçando exibição do diálogo');
    
    if (points.length < 2) {
      toast.error('É necessário pelo menos 2 pontos para otimizar a rota');
      return;
    }
    
    // Garantir que o diálogo seja exibido
    setShowOptimizationDialog(true);
    console.log('🎯 [ROUTE FORM] Diálogo definido como TRUE');
  };

  const handleOptimizationChoice = async (useIntelligent: boolean) => {
    try {
      setOptimizing(true);
      setShowOptimizationDialog(false); // Fechar diálogo primeiro
      
      console.log('🎯 [ROUTE FORM] ========================================');
      console.log(`🎯 [ROUTE FORM] OTIMIZAÇÃO ${useIntelligent ? 'INTELIGENTE' : 'TRADICIONAL'} ESCOLHIDA PELO USUÁRIO`);
      console.log(`🎯 [ROUTE FORM] Route ID: ${editingRoute?.id || 'NOVA ROTA'}`);
      console.log(`🎯 [ROUTE FORM] Pontos: ${points.length}`);
      
      let result;
      
      if (useIntelligent && editingRoute?.id) {
        console.log('🧠 [ROUTE FORM] FORÇANDO OTIMIZAÇÃO INTELIGENTE');
        
        const response = await fetch(`${import.meta.env.VITE_API_URL}/routes/${editingRoute.id}/optimize-intelligent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            points: points.map((point, index) => ({
              id: point.id,
              address: point.address,
              cep: point.cep,
              lat: point.lat,
              lng: point.lng,
              order: index,
              type: point.type,
              completed: point.completed ?? false,
              completedAt: point.completedAt ?? null,
            })),
          }),
        });

        if (!response.ok) {
          throw new Error('Erro na otimização inteligente');
        }

        const intelligentData = await response.json();
        
        result = {
          points: intelligentData.points.map((p: any, index: number) => ({
            id: p.id,
            address: p.address,
            cep: p.cep || '',
            lat: p.lat,
            lng: p.lng,
            order: index,
            type: p.type,
            completed: p.completed ?? false,
            completedAt: p.completedAt ?? null,
          })),
          totalDistance: intelligentData.totalDistance,
          estimatedTime: intelligentData.estimatedTime,
          optimizedOrder: intelligentData.optimizedOrder,
        };
        
        toast.success(`🧠 Otimização Inteligente: ${intelligentData.preservedPoints || 0} pontos preservados`);
        
      } else {
        console.log('🆓 [ROUTE FORM] FORÇANDO OTIMIZAÇÃO TRADICIONAL');
        
        const response = await fetch(`${import.meta.env.VITE_API_URL}/geocoding/optimize`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            points: points.map((point, index) => ({
              id: point.id,
              address: point.address,
              cep: point.cep,
              lat: point.lat,
              lng: point.lng,
              order: index,
              type: point.type,
              completed: point.completed ?? false,
              completedAt: point.completedAt ?? null,
            })),
          }),
        });

        if (!response.ok) {
          throw new Error('Erro na otimização tradicional');
        }

        const optimizedData = await response.json();
        
        result = {
          points: optimizedData.points.map((p: any, index: number) => ({
            id: p.id,
            address: p.address,
            cep: p.cep || '',
            lat: p.lat,
            lng: p.lng,
            order: index,
            type: p.type,
            completed: false,
            completedAt: null,
          })),
          totalDistance: optimizedData.totalDistance,
          estimatedTime: optimizedData.estimatedTime,
          optimizedOrder: optimizedData.optimizedOrder,
        };
        
        toast.success(`🆓 Otimização Tradicional: ${result.points.length} pontos otimizados`);
      }
      
      // ✅ APLICAR RESULTADOS
      setPoints(result.points);
      setTotalDistance(result.totalDistance);
      setEstimatedTime(result.estimatedTime);
      setOptimizedOrder(result.optimizedOrder);
      
      console.log('✅ [ROUTE FORM] OTIMIZAÇÃO CONCLUÍDA');
      console.log('🎯 [ROUTE FORM] ========================================');
      
    } catch (error) {
      console.error('❌ [ROUTE FORM] ERRO NA OTIMIZAÇÃO:', error);
      toast.error('Erro ao otimizar rota');
    } finally {
      setOptimizing(false);
    }
  };

  // Função para lidar com o envio do formulário
  const onSubmitData = async (data: RouteFormData) => {
    try {
      console.log('📤 [ROUTE FORM] Enviando dados da rota...');
      
      const routeData = {
        id: editingRoute?.id,
        name: data.name,
        description: data.description || '',
        points: points,
        totalDistance: totalDistance,
        estimatedTime: estimatedTime,
        optimizedOrder: optimizedOrder,
        status: editingRoute?.status || 'active',
      };
      
      console.log('📤 [ROUTE FORM] Dados da rota:', routeData);
      
      // ✅ USAR O MÉTODO createOrUpdateRoute
      const result = await createOrUpdateRoute(routeData);
      
      console.log('✅ [ROUTE FORM] Rota salva com sucesso:', result);
      toast.success(editingRoute ? 'Rota atualizada com sucesso!' : 'Rota criada com sucesso!');
      
      // ✅ CHAMAR onSubmit para fechar o modal
      onSubmit(result);
      
    } catch (error: any) {
      console.error('❌ [ROUTE FORM] Erro ao salvar rota:', error);
      toast.error(error.message || 'Erro ao salvar rota');
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{editingRoute ? 'Editar Rota' : 'Criar Nova Rota'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmitData)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome da Rota</Label>
              <Input
                id="name"
                {...register("name")}
                placeholder="Digite o nome da rota"
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição da Rota</Label>
              <Textarea
                id="description"
                {...register("description")}
                placeholder="Digite uma descrição para a rota"
                rows={3}
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Pontos da Rota</Label>
                <Button type="button" variant="outline" size="sm" onClick={handleAddPoint}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Ponto
                </Button>
              </div>

              {points.map((point, index) => (
                <Card key={point.id} className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-sm font-medium">Ponto {index + 1}</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemovePoint(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor={`cep-${index}`}>CEP</Label>
                      <div className="flex gap-2">
                        <Input
                          id={`cep-${index}`}
                          value={point.cep || ''}
                          onChange={(e) => handlePointChange(index, 'cep', e.target.value)}
                          placeholder="00000-000"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleSearchCep(index, point.cep || '')}
                        >
                          <MapPin className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`address-${index}`}>Endereço</Label>
                      <Input
                        id={`address-${index}`}
                        value={point.address}
                        onChange={(e) => handlePointChange(index, 'address', e.target.value)}
                        placeholder="Digite o endereço"
                      />
                      {errors.points?.[index]?.address && (
                        <p className="text-sm text-destructive">
                          {errors.points[index]?.address?.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`lat-${index}`}>Latitude</Label>
                      <Input
                        id={`lat-${index}`}
                        type="number"
                        step="any"
                        value={point.lat}
                        onChange={(e) => handlePointChange(index, 'lat', parseFloat(e.target.value))}
                        placeholder="0.000000"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`lng-${index}`}>Longitude</Label>
                      <Input
                        id={`lng-${index}`}
                        type="number"
                        step="any"
                        value={point.lng}
                        onChange={(e) => handlePointChange(index, 'lng', parseFloat(e.target.value))}
                        placeholder="0.000000"
                      />
                    </div>
                  </div>
                </Card>
              ))}

              {errors.points && (
                <p className="text-sm text-destructive">{errors.points.message}</p>
              )}
            </div>

            <div className="flex items-center justify-between pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleOptimizeClick}
                disabled={optimizing}
              >
                {optimizing ? 'Otimizando...' : '🎯 Gerar Preview da Rota'}
              </Button>

              <div className="flex gap-2">
                {onCancel && (
                  <Button type="button" variant="outline" onClick={onCancel}>
                    Cancelar
                  </Button>
                )}
                <Button type="submit">
                  {editingRoute ? 'Salvar Alterações' : 'Criar Rota'}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* ✅ DIÁLOGO DE OTIMIZAÇÃO */}
      <RouteOptimizationDialog
        open={showOptimizationDialog}
        onOpenChange={setShowOptimizationDialog}
        onConfirm={handleOptimizationChoice}
        isOptimizing={optimizing}
      />
    </div>
  );
};

export default RouteForm;
