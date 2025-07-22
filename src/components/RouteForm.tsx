
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

// ✅ SCHEMA CORRIGIDO - SEM CEP PERSISTENTE
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
  onSubmit: (routeData: any) => void;
  editingRoute?: Route;
  onCancel?: () => void;
}

const RouteForm = ({ onSubmit, editingRoute, onCancel }: RouteFormProps) => {
  const { getAddressByCep, createRoute, updateRoute } = useRoutes();
  const [points, setPoints] = useState<RoutePoint[]>(editingRoute?.points || []);
  const [totalDistance, setTotalDistance] = useState<number>(editingRoute?.totalDistance || 0);
  const [estimatedTime, setEstimatedTime] = useState<string>(editingRoute?.estimatedTime || '');
  const [optimizedOrder, setOptimizedOrder] = useState<string[]>(editingRoute?.optimizedOrder || []);
  const [optimizing, setOptimizing] = useState(false);
  const [showOptimizationDialog, setShowOptimizationDialog] = useState(false);
  
  // ✅ ESTADO TEMPORÁRIO PARA CEP (NÃO PERSISTENTE)
  const [tempCeps, setTempCeps] = useState<Record<string, string>>({});

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
      // ✅ CEP não é carregado do banco - campos ficam limpos
      setTempCeps({});
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
      setTempCeps({});
    }
  }, [editingRoute, reset]);

  // ✅ FUNÇÃO CORRIGIDA - USAR UUID VÁLIDO SEM CEP
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
    setPoints([...points, newPoint]);
  };

  const handleRemovePoint = (index: number) => {
    const newPoints = [...points];
    const removedPointId = newPoints[index].id;
    newPoints.splice(index, 1);
    const updatedPoints = newPoints.map((point, i) => ({ ...point, order: i }));
    setPoints(updatedPoints);
    
    // ✅ REMOVER CEP TEMPORÁRIO DO PONTO REMOVIDO
    const newTempCeps = { ...tempCeps };
    delete newTempCeps[removedPointId];
    setTempCeps(newTempCeps);
  };

  // ✅ FUNÇÃO CORRIGIDA - BUSCAR ENDEREÇO POR CEP
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
      setValue(`points.${index}.address`, addressData.address);
      setValue(`points.${index}.lat`, addressData.lat);
      setValue(`points.${index}.lng`, addressData.lng);
      
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

  // ✅ FUNÇÃO PARA ATUALIZAR CEP TEMPORÁRIO
  const handleCepChange = (pointId: string, cep: string) => {
    setTempCeps(prev => ({
      ...prev,
      [pointId]: cep
    }));
  };

  const handleOptimizeClick = () => {
    console.log('🎯 [ROUTE FORM] ===== GERAR PREVIEW CLICADO =====');
    
    if (points.length < 2) {
      console.log('❌ [ROUTE FORM] Pontos insuficientes');
      toast.error('É necessário pelo menos 2 pontos para otimizar a rota');
      return;
    }
    
    const invalidPoints = points.filter(p => !p.lat || !p.lng || p.lat === 0 || p.lng === 0);
    if (invalidPoints.length > 0) {
      console.log('❌ [ROUTE FORM] Pontos sem coordenadas:', invalidPoints.length);
      toast.error('Alguns pontos não possuem coordenadas válidas. Verifique os endereços.');
      return;
    }
    
    console.log('🎯 [ROUTE FORM] Exibindo diálogo de escolha de otimização');
    setShowOptimizationDialog(true);
  };

  const handleOptimizationChoice = async (useIntelligent: boolean) => {
    console.log('🎯 [ROUTE FORM] ===== ESCOLHA DE OTIMIZAÇÃO =====');
    console.log(`🎯 [ROUTE FORM] Tipo escolhido: ${useIntelligent ? 'INTELIGENTE' : 'TRADICIONAL'}`);
    
    try {
      setOptimizing(true);
      setShowOptimizationDialog(false);
      
      let result;
      
      if (useIntelligent && editingRoute?.id) {
        console.log('🧠 [ROUTE FORM] Executando otimização INTELIGENTE');
        toast.info('🧠 Iniciando otimização inteligente...');
        
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
          const errorText = await response.text();
          console.error(`❌ [ROUTE FORM] Erro na resposta: ${errorText}`);
          throw new Error(`Erro ${response.status}: ${errorText}`);
        }

        const intelligentData = await response.json();
        console.log('✅ [ROUTE FORM] Dados da otimização inteligente:', intelligentData);
        
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
          totalDistance: intelligentData.totalDistance,
          estimatedTime: intelligentData.estimatedTime,
          optimizedOrder: intelligentData.optimizedOrder,
        };
        
        toast.success(`🧠 Otimização Inteligente concluída! ${intelligentData.preservedPoints || 0} pontos preservados.`);
        
      } else {
        console.log('🆓 [ROUTE FORM] Executando otimização TRADICIONAL');
        toast.info('🆓 Iniciando otimização tradicional...');
        
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
          totalDistance: optimizedData.totalDistance,
          estimatedTime: optimizedData.estimatedTime,
          optimizedOrder: optimizedData.optimizedOrder,
        };
        
        toast.success(`🆓 Otimização Tradicional concluída! ${result.points.length} pontos otimizados.`);
      }
      
      // ✅ APLICAR RESULTADOS
      setPoints(result.points);
      setTotalDistance(result.totalDistance);
      setEstimatedTime(result.estimatedTime);
      setOptimizedOrder(result.optimizedOrder);
      
      console.log('✅ [ROUTE FORM] Otimização aplicada com sucesso');
      
    } catch (error) {
      console.error('❌ [ROUTE FORM] Erro na otimização:', error);
      toast.error(`Erro ao otimizar rota: ${error.message}`);
    } finally {
      setOptimizing(false);
    }
  };

  const onSubmitData = async (data: RouteFormData) => {
    try {
      console.log('📤 [ROUTE FORM] Enviando dados da rota...');
      
      // ✅ PRESERVAR PONTOS CONCLUÍDOS DURANTE SALVAMENTO
      const routeData = {
        name: data.name,
        description: data.description || '',
        points: points.map(point => ({
          ...point,
          // ✅ Garantir que CEP não seja enviado
          cep: undefined
        })),
        totalDistance: totalDistance,
        estimatedTime: estimatedTime,
        optimizedOrder: optimizedOrder,
        status: (editingRoute?.status || 'active') as 'active' | 'inactive' | 'completed',
      };
      
      console.log('📤 [ROUTE FORM] Dados da rota:', routeData);
      
      let result;
      if (editingRoute?.id) {
        result = await updateRoute(editingRoute.id, routeData);
      } else {
        result = await createRoute(routeData);
      }
      
      console.log('✅ [ROUTE FORM] Rota salva com sucesso:', result);
      toast.success(editingRoute ? 'Rota atualizada com sucesso!' : 'Rota criada com sucesso!');
      
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
                    <Label className="text-sm font-medium">
                      Ponto {index + 1} 
                      {point.completed && <span className="text-green-600 ml-2">✅ Concluído</span>}
                    </Label>
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
                    {/* ✅ CEP TEMPORÁRIO - NÃO PERSISTENTE */}
                    <div className="space-y-2">
                      <Label htmlFor={`cep-${index}`}>CEP (apenas para busca)</Label>
                      <div className="flex gap-2">
                        <Input
                          id={`cep-${index}`}
                          value={tempCeps[point.id] || ''}
                          onChange={(e) => handleCepChange(point.id, e.target.value)}
                          placeholder="00000-000"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleSearchCep(index, tempCeps[point.id] || '')}
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
                className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-300"
              >
                {optimizing ? 'Otimizando...' : '🎯 Gerar Preview'}
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
