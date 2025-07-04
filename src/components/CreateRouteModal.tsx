
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, X, MapPin, Navigation, Search, Loader2 } from 'lucide-react';
import { useRoutes, RoutePoint } from '@/hooks/useRoutes';
import { useRoutesCRUD } from '@/hooks/useRoutesCRUD';
import RoutePreviewModal from './RoutePreviewModal';
import { toast } from 'sonner';

interface CreateRouteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingRoute?: any;
  onSuccess: () => void;
}

const CreateRouteModal: React.FC<CreateRouteModalProps> = ({
  open,
  onOpenChange,
  editingRoute,
  onSuccess
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [points, setPoints] = useState<RoutePoint[]>([]);
  const [currentPoint, setCurrentPoint] = useState({ address: '', cep: '', lat: 0, lng: 0 });
  const [loading, setLoading] = useState(false);
  const [searchingAddress, setSearchingAddress] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);

  const { getAddressByCep, optimizeRoute } = useRoutes();
  const { createRoute, updateRoute } = useRoutesCRUD();

  useEffect(() => {
    if (editingRoute) {
      setName(editingRoute.name || '');
      setDescription(editingRoute.description || '');
      setPoints(editingRoute.points || []);
    } else {
      resetForm();
    }
  }, [editingRoute, open]);

  const resetForm = () => {
    setName('');
    setDescription('');
    setPoints([]);
    setCurrentPoint({ address: '', cep: '', lat: 0, lng: 0 });
    setPreviewData(null);
    setShowPreview(false);
  };

  const generateUniqueId = () => {
    return `point-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const handleAddressByCep = async (cep: string) => {
    if (!cep || cep.length < 8) return;
    
    try {
      setSearchingAddress(true);
      const addressData = await getAddressByCep(cep);
      setCurrentPoint(prev => ({ 
        ...prev, 
        address: addressData.address,
        lat: addressData.lat || -23.5505,
        lng: addressData.lng || -46.6333
      }));
      toast.success('Endereço encontrado!');
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
      toast.error('CEP não encontrado');
    } finally {
      setSearchingAddress(false);
    }
  };

  const handleAddressSearch = async (address: string) => {
    if (!address || address.length < 5) return;
    
    try {
      setSearchingAddress(true);
      const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=AIzaSyAbITueefJWwTTyXO-9Nz9pgzbgKZ5sV9w`);
      const data = await response.json();
      
      if (data.status === 'OK' && data.results.length > 0) {
        const result = data.results[0];
        const location = result.geometry.location;
        
        setCurrentPoint(prev => ({ 
          ...prev, 
          address: result.formatted_address,
          lat: location.lat,
          lng: location.lng
        }));
        toast.success('Endereço encontrado!');
      } else {
        toast.error('Endereço não encontrado');
      }
    } catch (error) {
      console.error('Erro ao buscar endereço:', error);
      toast.error('Erro ao buscar endereço');
    } finally {
      setSearchingAddress(false);
    }
  };

  const addPoint = async () => {
    if (!currentPoint.address) {
      toast.error('Preencha o endereço');
      return;
    }

    try {
      let pointData = currentPoint;
      
      if (currentPoint.cep && currentPoint.lat === 0) {
        pointData = await getAddressByCep(currentPoint.cep);
      }

      const newPoint: RoutePoint = {
        id: generateUniqueId(),
        address: pointData.address,
        cep: pointData.cep || currentPoint.cep,
        lat: pointData.lat || currentPoint.lat || -23.5505,
        lng: pointData.lng || currentPoint.lng || -46.6333,
        order: points.length,
        type: points.length === 0 ? 'origin' : 'waypoint'
      };

      setPoints([...points, newPoint]);
      setCurrentPoint({ address: '', cep: '', lat: 0, lng: 0 });
      toast.success('Ponto adicionado!');
    } catch (error) {
      console.error('Erro ao adicionar ponto:', error);
      toast.error('Erro ao adicionar ponto');
    }
  };

  const removePoint = (index: number) => {
    const newPoints = points.filter((_, i) => i !== index);
    // Reordenar os pontos
    const reorderedPoints = newPoints.map((point, i) => ({
      ...point,
      order: i,
      type: (i === 0 ? 'origin' : 'waypoint') as 'origin' | 'waypoint' | 'destination'
    }));
    setPoints(reorderedPoints);
  };

  const handlePreview = async () => {
    if (points.length < 2) {
      toast.error('Adicione pelo menos 2 pontos para visualizar a rota');
      return;
    }

    try {
      setLoading(true);
      const optimizedResult = await optimizeRoute(points);
      
      // Reordenar pontos conforme otimização
      const optimizedPoints = optimizedResult.optimizedOrder.map(pointId => 
        points.find(p => p.id === pointId)
      ).filter(Boolean) as RoutePoint[];

      // Criar rota circular: adicionar ponto de origem no final como destino
      const circularPoints = [...optimizedPoints];
      if (circularPoints.length > 0) {
        const origin = circularPoints[0];
        const destination: RoutePoint = {
          ...origin,
          id: `${origin.id}-destination`,
          order: circularPoints.length,
          type: 'destination'
        };
        circularPoints.push(destination);
      }

      setPreviewData({
        name,
        description,
        points: circularPoints,
        totalDistance: optimizedResult.totalDistance,
        estimatedTime: optimizedResult.estimatedTime,
        optimizedOrder: [...optimizedResult.optimizedOrder, optimizedResult.optimizedOrder[0]],
        polyline: optimizedResult.polyline
      });
      
      setShowPreview(true);
    } catch (error) {
      console.error('Erro ao otimizar rota:', error);
      toast.error('Erro ao otimizar rota');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!previewData) return;
    
    try {
      setLoading(true);
      const routeData = {
        name: previewData.name,
        description: previewData.description,
        points: previewData.points,
        totalDistance: previewData.totalDistance,
        estimatedTime: previewData.estimatedTime,
        optimizedOrder: previewData.optimizedOrder,
        status: 'active' as const,
        polyline: previewData.polyline
      };

      if (editingRoute) {
        await updateRoute(editingRoute.id, routeData);
        toast.success('Rota atualizada com sucesso!');
      } else {
        await createRoute(routeData);
        toast.success('Rota criada com sucesso!');
      }
      
      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error('Error saving route:', error);
      toast.error('Erro ao salvar rota');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setShowPreview(false);
    setPreviewData(null);
  };

  return (
    <>
      <Dialog open={open && !showPreview} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
          <DialogHeader className="pb-6 border-b border-blue-200 dark:border-gray-700">
            <DialogTitle className="text-2xl font-bold text-blue-900 dark:text-blue-100 flex items-center gap-3">
              <Navigation className="h-6 w-6" />
              {editingRoute ? 'Editar Rota' : 'Nova Rota'}
            </DialogTitle>
          </DialogHeader>

          <div className="overflow-y-auto max-h-[calc(90vh-200px)] space-y-6 pr-2">
            {/* Informações básicas */}
            <div className="space-y-4 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-blue-200 dark:border-gray-600">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Informações da Rota</h3>
              
              <div>
                <Label htmlFor="name" className="text-sm font-medium text-gray-700 dark:text-gray-300">Nome da Rota *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Rota Centro-Norte"
                  className="mt-1 border-blue-300 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <Label htmlFor="description" className="text-sm font-medium text-gray-700 dark:text-gray-300">Descrição (opcional)</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descrição da rota..."
                  rows={3}
                  className="mt-1 border-blue-300 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Adicionar pontos */}
            <div className="space-y-4 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-blue-200 dark:border-gray-600">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Pontos da Rota
              </h3>
              
              <div className="space-y-4 p-4 bg-blue-50 dark:bg-gray-700 rounded-lg border border-blue-200 dark:border-gray-600">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="cep" className="text-sm font-medium text-gray-700 dark:text-gray-300">CEP (opcional)</Label>
                    <Input
                      id="cep"
                      value={currentPoint.cep}
                      onChange={(e) => setCurrentPoint(prev => ({ ...prev, cep: e.target.value }))}
                      onBlur={(e) => handleAddressByCep(e.target.value)}
                      placeholder="00000-000"
                      maxLength={9}
                      className="mt-1 border-blue-300 focus:border-blue-500"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="address" className="text-sm font-medium text-gray-700 dark:text-gray-300">Endereço *</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        id="address"
                        value={currentPoint.address}
                        onChange={(e) => setCurrentPoint(prev => ({ ...prev, address: e.target.value }))}
                        placeholder="Digite o endereço completo"
                        disabled={searchingAddress}
                        className="border-blue-300 focus:border-blue-500"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddressSearch(currentPoint.address)}
                        disabled={searchingAddress || !currentPoint.address}
                        className="border-blue-300 hover:bg-blue-50"
                      >
                        {searchingAddress ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Search className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={addPoint}
                  disabled={!currentPoint.address || searchingAddress}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {searchingAddress ? 'Buscando...' : 'Adicionar Ponto'}
                </Button>
              </div>

              {/* Lista de pontos */}
              {points.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Pontos Adicionados</Label>
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                      {points.length} {points.length === 1 ? 'ponto' : 'pontos'}
                    </Badge>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {points.map((point, index) => (
                      <div key={`${point.id}-${index}`} className="flex items-center gap-3 p-4 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 shadow-sm hover:shadow-md transition-shadow">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-md ${
                          point.type === 'origin' ? 'bg-green-500' : 'bg-blue-500'
                        }`}>
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm text-gray-900 dark:text-gray-100">{point.address}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs border-blue-300 text-blue-700">
                              {point.type === 'origin' ? 'Origem' : 'Parada'}
                            </Badge>
                            {point.cep && (
                              <span className="text-xs text-gray-500">CEP: {point.cep}</span>
                            )}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removePoint(index)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Ações */}
          <div className="flex justify-between gap-4 pt-6 border-t border-blue-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 -mx-6 -mb-6 rounded-b-xl">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="border-gray-300">
              Cancelar
            </Button>
            
            <Button 
              onClick={handlePreview}
              disabled={!name || points.length < 2 || loading}
              className="bg-blue-600 hover:bg-blue-700 text-white min-w-[140px]"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Otimizando...
                </>
              ) : (
                <>
                  <Navigation className="h-4 w-4 mr-2" />
                  Visualizar Rota
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <RoutePreviewModal
        open={showPreview}
        onOpenChange={setShowPreview}
        previewData={previewData}
        onSave={handleSave}
        onBack={handleBack}
        loading={loading}
        isEditing={!!editingRoute}
      />
    </>
  );
};

export default CreateRouteModal;
