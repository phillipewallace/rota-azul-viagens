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
import { API_CONFIG } from '@/services/config';
import { v4 as uuidv4 } from 'uuid';

const routeSchema = z.object({
  name: z.string().min(1, 'O nome da rota é obrigatório'),
  description: z.string().optional(),
  points: z.array(z.object({
    address: z.string().min(1, 'O endereço é obrigatório'),
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

interface RouteFormProps {
  onSubmit: (route: Route) => void;
  editingRoute?: Route;
  onCancel?: () => void;
  isSubmitting?: boolean;
}

const RouteForm = ({ onSubmit, editingRoute, onCancel, isSubmitting = false }: RouteFormProps) => {
  const { getAddressByCep, createRoute, updateRoute } = useRoutes();
  const [points, setPoints] = useState<RoutePoint[]>([]);
  const [totalDistance, setTotalDistance] = useState<number>(0);
  const [estimatedTime, setEstimatedTime] = useState<string>('');
  const [optimizedOrder, setOptimizedOrder] = useState<string[]>([]);
  const [optimizing, setOptimizing] = useState(false);
  const [showOptimizationDialog, setShowOptimizationDialog] = useState(false);
  const [tempCeps, setTempCeps] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, setValue, formState: { errors }, reset } = useForm<RouteFormData>({
    resolver: zodResolver(routeSchema),
    defaultValues: {
      name: '',
      description: '',
      points: [],
      totalDistance: 0,
      estimatedTime: '',
      optimizedOrder: [],
    }
  });

  // Inicializar dados da rota em edição
  useEffect(() => {
    if (editingRoute) {
      console.log('📝 [ROUTE FORM] Carregando rota para edição:', editingRoute.name);
      
      const safePoints = Array.isArray(editingRoute.points) ? editingRoute.points : [];
      
      reset({
        name: editingRoute.name || '',
        description: editingRoute.description || '',
        points: safePoints,
        totalDistance: editingRoute.totalDistance || 0,
        estimatedTime: editingRoute.estimatedTime || '',
        optimizedOrder: Array.isArray(editingRoute.optimizedOrder) ? editingRoute.optimizedOrder : [],
      });
      
      setPoints(safePoints);
      setTotalDistance(editingRoute.totalDistance || 0);
      setEstimatedTime(editingRoute.estimatedTime || '');
      setOptimizedOrder(Array.isArray(editingRoute.optimizedOrder) ? editingRoute.optimizedOrder : []);
      setTempCeps({});
    } else {
      console.log('➕ [ROUTE FORM] Preparando para nova rota');
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
      setTempCeps({});
    }
  }, [editingRoute, reset]);

  // Sincronizar pontos com formulário
  useEffect(() => {
    points.forEach((point, index) => {
      setValue(`points.${index}.address`, point.address);
      setValue(`points.${index}.lat`, point.lat);
      setValue(`points.${index}.lng`, point.lng);
      setValue(`points.${index}.order`, point.order);
      setValue(`points.${index}.type`, point.type);
      setValue(`points.${index}.completed`, point.completed || false);
      setValue(`points.${index}.completedAt`, point.completedAt);
    });
    
    setValue('totalDistance', totalDistance);
    setValue('estimatedTime', estimatedTime);
    setValue('optimizedOrder', optimizedOrder);
  }, [points, totalDistance, estimatedTime, optimizedOrder, setValue]);

  const handleAddPoint = () => {
    const newPoint: RoutePoint = {
      id: uuidv4(),
      address: '',
      lat: 0,
      lng: 0,
      order: points.length,
      type: 'waypoint',
      completed: false,
      completedAt: null,
    };
    
    console.log('➕ [ROUTE FORM] Adicionando novo ponto:', newPoint.id);
    setPoints(prev => [...prev, newPoint]);
  };

  const handleRemovePoint = (index: number) => {
    const newPoints = [...points];
    const removedPointId = newPoints[index].id;
    newPoints.splice(index, 1);
    const updatedPoints = newPoints.map((point, i) => ({ ...point, order: i }));
    
    console.log('🗑️ [ROUTE FORM] Removendo ponto:', removedPointId);
    setPoints(updatedPoints);
    
    const newTempCeps = { ...tempCeps };
    delete newTempCeps[removedPointId];
    setTempCeps(newTempCeps);
  };

  const handleSearchCep = async (index: number, cep: string) => {
    if (!cep || cep.length < 8) {
      toast.error('Digite um CEP válido');
      return;
    }

    try {
      console.log(`🔍 [ROUTE FORM] Buscando endereço para CEP: ${cep}`);
      const addressData = await getAddressByCep(cep);
      
      const newPoints = [...points];
      newPoints[index] = {
        ...newPoints[index],
        address: addressData.address,
        lat: addressData.lat,
        lng: addressData.lng,
      };
      setPoints(newPoints);
      
      console.log(`✅ [ROUTE FORM] Endereço encontrado: ${addressData.address}`);
      toast.success('Endereço encontrado!');
      
    } catch (error: any) {
      console.error('❌ [ROUTE FORM] Erro ao buscar CEP:', error);
      toast.error(error.message || 'Erro ao buscar endereço');
    }
  };

  const handlePointChange = (index: number, field: string, value: any) => {
    const newPoints = [...points];
    newPoints[index] = { ...newPoints[index], [field]: value };
    setPoints(newPoints);
  };

  const handleCepChange = (pointId: string, cep: string) => {
    setTempCeps(prev => ({
      ...prev,
      [pointId]: cep
    }));
  };

  const handleOptimizeClick = () => {
    console.log('🎯 [ROUTE FORM] Iniciando otimização');
    
    if (points.length < 2) {
      toast.error('É necessário pelo menos 2 pontos para otimizar a rota');
      return;
    }
    
    const invalidPoints = points.filter(p => !p.lat || !p.lng || p.lat === 0 || p.lng === 0);
    if (invalidPoints.length > 0) {
      toast.error('Alguns pontos não possuem coordenadas válidas. Verifique os endereços.');
      return;
    }
    
    setShowOptimizationDialog(true);
  };

  const handleOptimizationChoice = async (useIntelligent: boolean) => {
    console.log(`🎯 [ROUTE FORM] Executando otimização ${useIntelligent ? 'INTELIGENTE' : 'TRADICIONAL'}`);
    
    try {
      setOptimizing(true);
      setShowOptimizationDialog(false);
      
      let result;
      
      if (useIntelligent && editingRoute?.id) {
        const response = await fetch(`${API_CONFIG.BASE_URL}/routes/${editingRoute.id}/optimize-intelligent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            points: points.map((point, index) => ({ 
              ...point, 
              order: index 
            })) 
          }),
        });

        if (!response.ok) {
          throw new Error(`Erro na otimização inteligente: ${response.status}`);
        }

        const intelligentData = await response.json();
        
        result = {
          points: intelligentData.points.map((p: any, index: number) => ({
            id: p.id,
            address: p.address,
            lat: p.lat,
            lng: p.lng,
            order: index,
            type: p.type,
            completed: p.completed ?? false,
            completedAt: p.completedAt ?? null,
          })),
          totalDistance: intelligentData.totalDistance || 0,
          estimatedTime: intelligentData.estimatedTime || '0min',
          optimizedOrder: intelligentData.optimizedOrder || [],
        };
        
        toast.success('🧠 Otimização Inteligente concluída!');
        
      } else {
        const response = await fetch(`${API_CONFIG.BASE_URL}/geocoding/optimize`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            points: points.map((point, index) => ({ 
              ...point, 
              order: index 
            })) 
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
            lat: p.lat,
            lng: p.lng,
            order: index,
            type: p.type,
            completed: false,
            completedAt: null,
          })),
          totalDistance: optimizedData.totalDistance || 0,
          estimatedTime: optimizedData.estimatedTime || '0min',
          optimizedOrder: optimizedData.optimizedOrder || [],
        };
        
        toast.success('🆓 Otimização Tradicional concluída!');
      }
      
      console.log('🔄 [ROUTE FORM] Aplicando resultados da otimização:', result);
      
      setPoints(result.points);
      setTotalDistance(result.totalDistance);
      setEstimatedTime(result.estimatedTime);
      setOptimizedOrder(result.optimizedOrder);
      
    } catch (error: any) {
      console.error('❌ [ROUTE FORM] Erro na otimização:', error);
      toast.error(`Erro ao otimizar rota: ${error.message}`);
    } finally {
      setOptimizing(false);
    }
  };

  const onSubmitData = async (data: RouteFormData) => {
    if (saving || isSubmitting) {
      console.log('⚠️ [ROUTE FORM] Salvamento já em andamento, ignorando...');
      return;
    }

    try {
      setSaving(true);
      console.log('📤 [ROUTE FORM] ===== INICIANDO SALVAMENTO REAL =====');
      console.log('📤 [ROUTE FORM] Dados do formulário:', data);
      console.log('📤 [ROUTE FORM] Pontos atuais:', points.length);
      
      // Validar dados essenciais
      if (!data.name || data.name.trim() === '') {
        throw new Error('Nome da rota é obrigatório');
      }
      
      if (!Array.isArray(points) || points.length < 2) {
        throw new Error('É necessário pelo menos 2 pontos para criar uma rota');
      }
      
      // Preparar dados para envio
      const routeData = {
        name: data.name.trim(),
        description: data.description || '',
        points: points.map(point => ({
          id: point.id,
          address: point.address,
          lat: point.lat,
          lng: point.lng,
          order: point.order,
          type: point.type,
          completed: point.completed || false,
          completedAt: point.completedAt || null,
        })),
        totalDistance: totalDistance,
        estimatedTime: estimatedTime,
        optimizedOrder: optimizedOrder,
        status: (editingRoute?.status || 'active') as 'active' | 'inactive' | 'completed',
      };
      
      console.log('📤 [ROUTE FORM] Enviando dados para backend:', {
        name: routeData.name,
        pointsCount: routeData.points.length,
        totalDistance: routeData.totalDistance,
        estimatedTime: routeData.estimatedTime,
        isEditing: !!editingRoute
      });
      
      let savedRoute;
      if (editingRoute?.id) {
        console.log('📝 [ROUTE FORM] Atualizando rota existente:', editingRoute.id);
        savedRoute = await updateRoute(editingRoute.id, routeData);
      } else {
        console.log('➕ [ROUTE FORM] Criando nova rota');
        savedRoute = await createRoute(routeData);
      }
      
      console.log('✅ [ROUTE FORM] Rota salva com sucesso no backend:', savedRoute.id);
      
      // Mostrar toast de sucesso
      toast.success(editingRoute ? 'Rota atualizada com sucesso!' : 'Rota criada com sucesso!');
      
      // Aguardar um pouco para garantir que o backend processou
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Chamar callback com a rota salva
      onSubmit(savedRoute);
      
    } catch (error: any) {
      console.error('❌ [ROUTE FORM] Erro ao salvar rota:', error);
      toast.error(error.message || 'Erro ao salvar rota');
    } finally {
      setSaving(false);
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
                disabled={saving || isSubmitting}
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
                disabled={saving || isSubmitting}
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Pontos da Rota</Label>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={handleAddPoint}
                  disabled={saving || isSubmitting}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Ponto
                </Button>
              </div>

              <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                Debug: {points.length} pontos | Distância: {totalDistance}km | Tempo: {estimatedTime}
              </div>

              {points.map((point, index) => (
                <Card key={point.id} className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-sm font-medium">
                      Ponto {index + 1} 
                      {point.completed && <span className="text-green-600 ml-2">✅ Concluído</span>}
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemovePoint(index)}
                      disabled={saving || isSubmitting}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor={`cep-${index}`}>CEP (apenas para busca)</Label>
                      <div className="flex gap-2">
                        <Input
                          id={`cep-${index}`}
                          value={tempCeps[point.id] || ''}
                          onChange={(e) => handleCepChange(point.id, e.target.value)}
                          placeholder="00000-000"
                          disabled={saving || isSubmitting}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleSearchCep(index, tempCeps[point.id] || '')}
                          disabled={saving || isSubmitting}
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
                        disabled={saving || isSubmitting}
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
                        disabled={saving || isSubmitting}
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
                        disabled={saving || isSubmitting}
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
                disabled={optimizing || points.length < 2 || saving || isSubmitting}
                className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-300"
              >
                {optimizing ? 'Otimizando...' : '🎯 Gerar Preview'}
              </Button>

              <div className="flex gap-2">
                {onCancel && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={onCancel}
                    disabled={saving || isSubmitting}
                  >
                    Cancelar
                  </Button>
                )}
                <Button 
                  type="submit" 
                  disabled={points.length < 2 || saving || isSubmitting}
                >
                  {saving || isSubmitting ? 'Salvando...' : (editingRoute ? 'Salvar Alterações' : 'Criar Rota')}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

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
