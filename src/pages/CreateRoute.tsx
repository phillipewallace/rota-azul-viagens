import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { RoutePointsList } from '@/components/RoutePointsList';
import RouteMapPreview from '@/components/RouteMapPreview';
import { useRoutes, RoutePoint } from '@/hooks/useRoutes';
import { useRoutesCRUD } from '@/hooks/useRoutesCRUD';
import { useRouteAutoSave } from '@/hooks/useRouteAutoSave';
import { toast } from 'sonner';
import { ArrowLeft, Save, MapPin, Plus, Eraser, Eye, Clock, GripVertical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const CreateRoute = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');
  
  const [routeName, setRouteName] = useState('');
  const [routeDescription, setRouteDescription] = useState('');
  const [optimizationMode, setOptimizationMode] = useState<'fixed' | 'optimized'>('optimized');
  const [allPoints, setAllPoints] = useState<RoutePoint[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [searchingAddress, setSearchingAddress] = useState<number | null>(null);
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null);

  const pointIdCounter = useRef(0);
  const mainContentRef = useRef<HTMLDivElement>(null);

  const { getAddressByCep, optimizeRoute, createRoute, routes, loadRoutes } = useRoutes();
  const { updateRoute } = useRoutesCRUD();
  const { scheduleAutoSave, loadFromStorage, clearStorage, saveToStorage } = useRouteAutoSave(editId || undefined);

  const isEditing = !!editId;

  const generateUniqueId = useCallback((prefix: string = 'point') => {
    pointIdCounter.current += 1;
    return `${prefix}-${Date.now()}-${pointIdCounter.current}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  const recalculatePointTypes = useCallback((points: RoutePoint[]): RoutePoint[] => {
    if (points.length === 0) return points;
    
    return points.map((point, index) => {
      let type: 'origin' | 'destination' | 'waypoint';
      
      if (index === 0) {
        type = 'origin';
      } else if (index === points.length - 1) {
        type = 'destination';
      } else {
        type = 'waypoint';
      }
      
      return {
        ...point,
        type,
        order: index
      };
    });
  }, []);

  // Carregar rota para edição
  useEffect(() => {
    if (isEditing && editId) {
      loadRoutes();
    }
  }, [isEditing, editId]);

  useEffect(() => {
    if (isEditing && editId && routes.length > 0) {
      const routeToEdit = routes.find(r => r.id === editId);
      if (routeToEdit) {
        console.log('✏️ [CREATE ROUTE] Carregando rota para edição:', routeToEdit.name);
        setRouteName(routeToEdit.name || '');
        setRouteDescription(routeToEdit.description || '');
        setOptimizationMode(routeToEdit.optimizationMode || 'optimized');

        const points = routeToEdit.points || [];
        console.log('📋 [CREATE ROUTE] Pontos da rota para edição:', points);
        
        const pointsWithUniqueIds = points.map((point: any, index: number) => ({
          id: point.id || generateUniqueId(`existing-${index}`),
          order: point.order ?? index,
          cep: point.cep || '',
          address: point.address || '',
          lat: point.lat || 0,
          lng: point.lng || 0,
          type: point.type,
          // ✅ CARREGAR TODOS OS CAMPOS OPERACIONAIS
          customerName: point.customerName || '',
          restroomsQty: point.restroomsQty,
          cleaningsQty: point.cleaningsQty,
          contactName: point.contactName || '',
          contactPhone: point.contactPhone || '',
          notes: point.notes || point.observation || '',
          observation: point.notes || point.observation || '',
          stopType: point.stopType || '',
          completed: point.completed || false,
          completedAt: point.completedAt || null
        }));

        const sortedPoints = [...pointsWithUniqueIds].sort((a: any, b: any) => a.order - b.order);
        const pointsWithCorrectTypes = recalculatePointTypes(sortedPoints);
        
        console.log('✅ [CREATE ROUTE] Pontos carregados com campos operacionais:', pointsWithCorrectTypes.length);
        setAllPoints(pointsWithCorrectTypes);
      }
    } else if (!isEditing) {
      // Verificar se veio da cópia de pontos
      const fromCopy = searchParams.get('fromCopy');
      const copiedPoints = localStorage.getItem('copiedRoutePoints');
      const copiedFromRoute = localStorage.getItem('copiedFromRoute');
      
      if (fromCopy === 'true' && copiedPoints) {
        try {
          const points = JSON.parse(copiedPoints);
          if (points && points.length > 0) {
            console.log('📋 [CREATE ROUTE] Carregando pontos copiados:', points.length);
            
            // ✅ LIMPAR QUALQUER DRAFT ANTIGO ANTES DE CARREGAR PONTOS COPIADOS
            clearStorage();
            
            // Converter pontos copiados para o formato esperado COM TODOS OS CAMPOS
            const convertedPoints = points.map((point: any, index: number) => ({
              id: generateUniqueId(`copied-${index}`),
              order: index,
              address: point.address || '',
              lat: point.lat || 0,
              lng: point.lng || 0,
              cep: point.cep || '',
              // ✅ TODOS OS CAMPOS OPERACIONAIS
              customerName: point.customerName || '',
              restroomsQty: point.restroomsQty,
              cleaningsQty: point.cleaningsQty,
              contactName: point.contactName || '',
              contactPhone: point.contactPhone || '',
              notes: point.notes || point.observation || '',
              observation: point.observation || point.notes || '',
              stopType: point.stopType || '',
              type: index === 0 ? 'origin' : (index === points.length - 1 ? 'destination' : 'waypoint')
            }));
            
            const pointsWithTypes = recalculatePointTypes(convertedPoints);
            setAllPoints(pointsWithTypes);
            setRouteName(''); // Limpar nome para forçar usuário a definir novo
            
            if (copiedFromRoute) {
              setRouteDescription(`Baseada na rota: ${copiedFromRoute}`);
            }
            
            console.log('✅ [CREATE ROUTE] Pontos copiados carregados com todos os campos operacionais');
            toast.success(`${points.length} ponto(s) carregado(s) da rota original!`);
            
            // Limpar localStorage após uso
            localStorage.removeItem('copiedRoutePoints');
            localStorage.removeItem('copiedFromRoute');
            return;
          }
        } catch (e) {
          console.error('Erro ao carregar pontos copiados:', e);
        }
      }
      
      // Tentar carregar do autosave (somente se não veio de cópia)
      const saved = loadFromStorage();
      if (saved && saved.points.length > 0) {
        const shouldRestore = window.confirm(
          'Encontramos um rascunho salvo automaticamente. Deseja restaurá-lo?'
        );
        
        if (shouldRestore) {
          setRouteName(saved.routeName);
          setRouteDescription(saved.routeDescription);
          setOptimizationMode(saved.optimizationMode);
          setAllPoints(saved.points);
          if (saved.scrollPosition) {
            setTimeout(() => {
              window.scrollTo(0, saved.scrollPosition);
            }, 100);
          }
          toast.success('Rascunho restaurado!');
        } else {
          clearStorage();
        }
      }
      
      // Inicializar com 2 pontos se não houver nada
      if (allPoints.length === 0 && !saved) {
        addPoint();
        addPoint();
      }
    }
  }, [isEditing, editId, routes, searchParams]);

  // AutoSave
  useEffect(() => {
    if (routeName || allPoints.length > 0) {
      const scrollPosition = window.scrollY;
      scheduleAutoSave({
        routeName,
        routeDescription,
        optimizationMode,
        points: allPoints,
        scrollPosition
      });
      setLastSaveTime(new Date());
    }
  }, [routeName, routeDescription, optimizationMode, allPoints]);

  const addPoint = () => {
    const newPoint: RoutePoint = {
      id: generateUniqueId('new'),
      address: '',
      lat: 0,
      lng: 0,
      order: allPoints.length,
      type: 'waypoint',
      cep: '',
      observation: ''
    };
    
    const updatedPoints = recalculatePointTypes([...allPoints, newPoint]);
    setAllPoints(updatedPoints);

    // Scroll to newly added point
    setTimeout(() => {
      const pointElements = document.querySelectorAll('[data-point-card]');
      const lastElement = pointElements[pointElements.length - 1];
      if (lastElement) {
        lastElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  const removePoint = (id: string) => {
    if (allPoints.length <= 2) {
      toast.error('É necessário pelo menos 2 pontos (origem e destino)');
      return;
    }
    
    const filteredPoints = allPoints.filter(p => p.id !== id);
    const reorderedPoints = recalculatePointTypes(filteredPoints);
    setAllPoints(reorderedPoints);
  };

  const updatePoint = (id: string, field: keyof RoutePoint, value: any) => {
    setAllPoints(prev => prev.map(point => 
      point.id === id ? { ...point, [field]: value } : point
    ));

    if (field === 'cep' && typeof value === 'string') {
      const cleanCep = value.replace(/\D/g, '');
      if (cleanCep.length === 8) {
        searchAddressByCep(id, cleanCep);
      }
    }
  };

  const reorderPoints = (newPoints: RoutePoint[]) => {
    const reorderedPoints = recalculatePointTypes(newPoints);
    setAllPoints(reorderedPoints);
  };

  const searchAddressByCep = async (pointId: string, cep: string) => {
    if (!pointId || !cep || cep.length < 8) return;

    try {
      setSearchingAddress(-1);
      const addressData = await getAddressByCep(cep);
      
      setAllPoints(prev => prev.map(point => 
        point.id === pointId 
          ? { 
              ...point, 
              cep: cep,
              address: addressData.address,
              lat: addressData.lat,
              lng: addressData.lng
            }
          : point
      ));
      
      toast.success('Endereço encontrado!');
    } catch (error) {
      console.error('❌ Erro ao buscar CEP:', error);
      toast.error('CEP não encontrado');
    } finally {
      setSearchingAddress(null);
    }
  };

  const searchAddressByText = async (pointId: string, address: string) => {
    if (!pointId || !address || address.length < 5) return;

    try {
      setSearchingAddress(-1);
      
      if (!window.google || !window.google.maps) {
        toast.error('Google Maps não está disponível');
        return;
      }

      const geocoder = new window.google.maps.Geocoder();
      const results = await new Promise<any>((resolve, reject) => {
        geocoder.geocode({ address: address }, (results, status) => {
          if (status === 'OK' && results && results[0]) {
            resolve(results[0]);
          } else {
            reject(new Error('Endereço não encontrado'));
          }
        });
      });

      const location = results.geometry.location;
      const formattedAddress = results.formatted_address;

      setAllPoints(prev => prev.map(point => 
        point.id === pointId 
          ? { 
              ...point, 
              address: formattedAddress,
              lat: location.lat(),
              lng: location.lng()
            }
          : point
      ));
      
      toast.success('Endereço encontrado!');
    } catch (error) {
      console.error('❌ Erro ao buscar endereço:', error);
      toast.error('Endereço não encontrado');
    } finally {
      setSearchingAddress(null);
    }
  };

  const duplicatePoint = (id: string) => {
    const pointToDuplicate = allPoints.find(p => p.id === id);
    if (!pointToDuplicate) return;

    const newPoint: RoutePoint = {
      ...pointToDuplicate,
      id: generateUniqueId('duplicate'),
      order: allPoints.length,
      observation: pointToDuplicate.observation || ''
    };

    const updatedPoints = recalculatePointTypes([...allPoints, newPoint]);
    setAllPoints(updatedPoints);
    toast.success('Ponto duplicado!');
  };

  const clearIntermediatePoints = () => {
    if (allPoints.length <= 2) {
      toast.error('Não há pontos intermediários para limpar');
      return;
    }

    const confirmed = window.confirm('Deseja remover todos os pontos intermediários?');
    if (!confirmed) return;

    const origin = allPoints[0];
    const destination = allPoints[allPoints.length - 1];
    const newPoints = recalculatePointTypes([origin, destination]);
    setAllPoints(newPoints);
    toast.success('Pontos intermediários removidos!');
  };

  const calculateSimpleDistance = (points: RoutePoint[]): number => {
    if (points.length < 2) return 0;
    let total = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const R = 6371;
      const dLat = (points[i+1].lat - points[i].lat) * Math.PI / 180;
      const dLng = (points[i+1].lng - points[i].lng) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(points[i].lat * Math.PI / 180) * Math.cos(points[i+1].lat * Math.PI / 180) *
                Math.sin(dLng/2) * Math.sin(dLng/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      total += R * c;
    }
    return total;
  };

  const generatePreview = async () => {
    try {
      setLoading(true);

      const pointsWithCorrectTypes = recalculatePointTypes(allPoints);
      
      const validPoints = pointsWithCorrectTypes.filter(p => {
        const isValid = p.lat && p.lng && p.address && 
                       typeof p.lat === 'number' && typeof p.lng === 'number' &&
                       p.lat !== 0 && p.lng !== 0;
        return isValid;
      });

      if (validPoints.length < 2) {
        toast.error('É necessário pelo menos 2 pontos válidos (origem e destino)');
        return;
      }

      let finalPoints;
      let totalDistance = 0;
      let estimatedTime = '0min';
      
      if (optimizationMode === 'fixed') {
        console.log('🔒 [PREVIEW] Modo FIXO');
        finalPoints = validPoints;
        totalDistance = calculateSimpleDistance(validPoints);
        estimatedTime = `${Math.round(totalDistance * 60 / 50)} min`;
      } else {
        console.log('🔄 [PREVIEW] Modo OTIMIZADO');
        const optimizedData = await optimizeRoute(validPoints, isEditing ? editId : undefined);
        finalPoints = optimizedData.points;
        totalDistance = optimizedData.totalDistance;
        estimatedTime = optimizedData.estimatedTime;
      }

      const preview = {
        name: routeName,
        description: routeDescription,
        points: finalPoints.map((processedPoint: RoutePoint) => {
          const original = allPoints.find(p => p.id === processedPoint.id);
          return {
            ...processedPoint,
            cep: processedPoint.cep || original?.cep || '',
            completed: original?.completed ?? false,
            completedAt: original?.completedAt ?? null,
            // ✅ INCLUIR TODOS OS CAMPOS OPERACIONAIS NO PREVIEW/SAVE
            customerName: processedPoint.customerName || original?.customerName || '',
            restroomsQty: processedPoint.restroomsQty ?? original?.restroomsQty,
            cleaningsQty: processedPoint.cleaningsQty ?? original?.cleaningsQty,
            contactName: processedPoint.contactName || original?.contactName || '',
            contactPhone: processedPoint.contactPhone || original?.contactPhone || '',
            notes: processedPoint.notes || processedPoint.observation || original?.notes || original?.observation || '',
            observation: processedPoint.notes || processedPoint.observation || original?.notes || original?.observation || '',
            stopType: processedPoint.stopType || original?.stopType || ''
          };
        }),
        totalDistance: totalDistance,
        estimatedTime: estimatedTime,
        optimizedOrder: finalPoints.map((p: any) => p.id),
        optimizationMode: optimizationMode,
        status: 'active'
      };
      
      console.log('📋 [CREATE ROUTE] Preview gerado com campos operacionais:', preview.points.length);

      setPreviewData(preview);
      setShowPreview(true);
    } catch (error) {
      console.error('❌ Erro ao gerar preview:', error);
      toast.error('Erro ao gerar preview da rota');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!routeName.trim()) {
      toast.error('Digite um nome para a rota');
      return;
    }

    if (!previewData) {
      toast.error('Gere o preview antes de salvar');
      return;
    }

    const validPoints = previewData.points?.filter((p: any) => p.lat && p.lng && p.address);
    if (!validPoints || validPoints.length < 2) {
      toast.error('É necessário pelo menos 2 pontos válidos');
      return;
    }

    try {
      setLoading(true);
      
      if (isEditing && editId) {
        await updateRoute({ id: editId, route: previewData });
        toast.success('Rota atualizada com sucesso!');
      } else {
        await createRoute(previewData);
        toast.success('Rota criada com sucesso!');
      }
      
      clearStorage();
      navigate('/routes');
    } catch (error: any) {
      console.error('❌ Erro ao salvar rota:', error);
      toast.error(error.message || 'Erro ao salvar rota');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50">
      {/* Header Fixo */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate('/routes')}
                className="hover:bg-slate-100"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  {isEditing ? 'Editar Rota' : 'Criar Nova Rota'}
                </h1>
                {lastSaveTime && (
                  <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Salvo automaticamente às {lastSaveTime.toLocaleTimeString()}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={generatePreview}
                disabled={loading || !routeName.trim() || allPoints.length < 2}
                variant="outline"
                className="border-blue-200 hover:bg-blue-50 hover:text-blue-700"
              >
                <Eye className="h-4 w-4 mr-2" />
                Visualizar
              </Button>
              <Button
                onClick={handleSave}
                disabled={loading || !previewData}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Save className="h-4 w-4 mr-2" />
                Salvar Rota
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo Principal */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Painel Esquerdo - Formulário */}
          <div ref={mainContentRef} className="space-y-6">
            {/* Informações Básicas */}
            <Card className="shadow-md">
              <CardContent className="p-6 space-y-4">
                <div>
                  <Label htmlFor="routeName" className="text-sm font-medium">Nome da Rota *</Label>
                  <Input
                    id="routeName"
                    value={routeName}
                    onChange={(e) => setRouteName(e.target.value)}
                    placeholder="Ex: Rota Centro - Bairros"
                    className="mt-1.5"
                  />
                </div>

                <div>
                  <Label htmlFor="routeDescription" className="text-sm font-medium">Descrição (Opcional)</Label>
                  <Textarea
                    id="routeDescription"
                    value={routeDescription}
                    onChange={(e) => setRouteDescription(e.target.value)}
                    placeholder="Adicione observações sobre esta rota..."
                    className="mt-1.5 min-h-[80px]"
                  />
                </div>

                {/* Modo de Otimização */}
                <div>
                  <Label className="text-sm font-medium mb-3 block">Modo de Criação</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <Card 
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        optimizationMode === 'fixed' 
                          ? 'ring-2 ring-blue-500 bg-blue-50/50' 
                          : 'hover:border-slate-300'
                      }`}
                      onClick={() => setOptimizationMode('fixed')}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            optimizationMode === 'fixed' ? 'border-blue-500 bg-blue-500' : 'border-slate-300'
                          }`}>
                            {optimizationMode === 'fixed' && (
                              <div className="w-2.5 h-2.5 bg-white rounded-full"></div>
                            )}
                          </div>
                          <h4 className="font-semibold text-sm">🔒 Ordem Fixa</h4>
                        </div>
                        <p className="text-xs text-slate-600">
                          Pontos mantidos na ordem exata
                        </p>
                      </CardContent>
                    </Card>
                    
                    <Card 
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        optimizationMode === 'optimized' 
                          ? 'ring-2 ring-blue-500 bg-blue-50/50' 
                          : 'hover:border-slate-300'
                      }`}
                      onClick={() => setOptimizationMode('optimized')}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            optimizationMode === 'optimized' ? 'border-blue-500 bg-blue-500' : 'border-slate-300'
                          }`}>
                            {optimizationMode === 'optimized' && (
                              <div className="w-2.5 h-2.5 bg-white rounded-full"></div>
                            )}
                          </div>
                          <h4 className="font-semibold text-sm">✨ Otimizar</h4>
                        </div>
                        <p className="text-xs text-slate-600">
                          Reorganiza automaticamente
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Pontos da Rota */}
            <Card className="shadow-md">
              <CardContent className="p-6">
                <div className="sticky top-20 z-10 bg-white pb-4 mb-4 border-b flex items-center justify-between">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-blue-600" />
                    Pontos da Rota ({allPoints.length})
                  </h3>
                  <div className="flex gap-2">
                    {allPoints.length > 2 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={clearIntermediatePoints}
                        className="text-orange-600 hover:bg-orange-50 hover:text-orange-700 border-orange-200"
                      >
                        <Eraser className="h-4 w-4 mr-1" />
                        Limpar intermediários
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addPoint}
                      className="text-blue-600 hover:bg-blue-50 hover:text-blue-700 border-blue-200"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Adicionar Ponto
                    </Button>
                  </div>
                </div>

                {optimizationMode === 'fixed' && allPoints.length > 0 && (
                  <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-700 flex items-center gap-2">
                      <GripVertical className="h-4 w-4" />
                      <strong>Modo Ordem Fixa:</strong> Arraste e solte os pontos para reordenar
                    </p>
                  </div>
                )}

                <RoutePointsList
                  points={allPoints}
                  onReorder={reorderPoints}
                  onRemove={removePoint}
                  onUpdate={updatePoint}
                  onSearchByCep={searchAddressByCep}
                  onSearchByAddress={searchAddressByText}
                  onDuplicate={duplicatePoint}
                  isDraggable={optimizationMode === 'fixed'}
                  searchingAddress={searchingAddress}
                />
              </CardContent>
            </Card>
          </div>

          {/* Painel Direito - Preview do Mapa */}
          <div className="lg:sticky lg:top-24 lg:h-fit">
            <Card className="shadow-md overflow-hidden">
              <CardContent className="p-0">
                <div className="bg-slate-50 border-b p-4">
                  <h3 className="text-lg font-semibold flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      🗺️ Preview em Tempo Real
                    </span>
                    {previewData && (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        {previewData.points?.length || 0} pontos
                      </Badge>
                    )}
                  </h3>
                  {previewData && (
                    <div className="mt-2 text-sm text-slate-600 flex items-center gap-4">
                      <span>📏 {previewData.totalDistance?.toFixed(2)} km</span>
                      <span>⏱️ {previewData.estimatedTime}</span>
                    </div>
                  )}
                </div>
                <div className="h-[600px] bg-slate-100">
                  {showPreview && previewData ? (
                    <RouteMapPreview route={previewData} />
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-400">
                      <div className="text-center p-8">
                        <MapPin className="h-16 w-16 mx-auto mb-4 opacity-20" />
                        <p className="text-sm">Clique em "Visualizar" para ver o preview</p>
                        <p className="text-xs mt-2">O mapa será atualizado conforme você adiciona pontos</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateRoute;
