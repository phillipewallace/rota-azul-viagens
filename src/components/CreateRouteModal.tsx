
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, X, MapPin, Navigation, Search } from 'lucide-react';
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
  const [currentPoint, setCurrentPoint] = useState({ address: '', cep: '' });
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
    setCurrentPoint({ address: '', cep: '' });
    setPreviewData(null);
    setShowPreview(false);
  };

  const handleAddressByCep = async (cep: string) => {
    if (!cep || cep.length < 8) return;
    
    try {
      setSearchingAddress(true);
      const addressData = await getAddressByCep(cep);
      setCurrentPoint(prev => ({ ...prev, address: addressData.address }));
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
      // Usar Google Geocoding para buscar coordenadas do endereço
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
      let pointData;
      
      if (currentPoint.cep) {
        pointData = await getAddressByCep(currentPoint.cep);
      } else {
        // Se não tem CEP, usar dados já obtidos pela busca de endereço
        pointData = {
          address: currentPoint.address,
          lat: currentPoint.lat || -23.5505,
          lng: currentPoint.lng || -46.6333,
          cep: currentPoint.cep || ''
        };
      }

      const newPoint: RoutePoint = {
        id: `point-${Date.now()}`,
        address: pointData.address,
        cep: pointData.cep,
        lat: pointData.lat,
        lng: pointData.lng,
        order: points.length,
        type: points.length === 0 ? 'origin' : 'waypoint'
      };

      setPoints([...points, newPoint]);
      setCurrentPoint({ address: '', cep: '' });
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
      type: i === 0 ? 'origin' : i === newPoints.length - 1 && newPoints.length > 1 ? 'destination' : 'waypoint'
    }));
    setPoints(reorderedPoints);
  };

  const setAsDestination = (index: number) => {
    const newPoints = points.map((point, i) => ({
      ...point,
      type: i === index ? 'destination' : point.type === 'destination' ? 'waypoint' : point.type
    }));
    setPoints(newPoints);
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

      setPreviewData({
        name,
        description,
        points: optimizedPoints,
        totalDistance: optimizedResult.totalDistance,
        estimatedTime: optimizedResult.estimatedTime,
        optimizedOrder: optimizedResult.optimizedOrder,
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
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRoute ? 'Editar Rota' : 'Nova Rota'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Informações básicas */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Nome da Rota *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Rota Centro-Norte"
                />
              </div>

              <div>
                <Label htmlFor="description">Descrição (opcional)</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descrição da rota..."
                  rows={3}
                />
              </div>
            </div>

            {/* Adicionar pontos */}
            <div className="space-y-4">
              <h4 className="font-medium">Pontos da Rota</h4>
              
              <div className="space-y-3 p-4 border rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="cep">CEP (opcional)</Label>
                    <Input
                      id="cep"
                      value={currentPoint.cep}
                      onChange={(e) => setCurrentPoint(prev => ({ ...prev, cep: e.target.value }))}
                      onBlur={(e) => handleAddressByCep(e.target.value)}
                      placeholder="00000-000"
                      maxLength={9}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="address">Endereço *</Label>
                    <div className="flex gap-2">
                      <Input
                        id="address"
                        value={currentPoint.address}
                        onChange={(e) => setCurrentPoint(prev => ({ ...prev, address: e.target.value }))}
                        placeholder="Digite o endereço completo"
                        disabled={searchingAddress}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddressSearch(currentPoint.address)}
                        disabled={searchingAddress || !currentPoint.address}
                      >
                        <Search className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={addPoint}
                  disabled={!currentPoint.address || searchingAddress}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {searchingAddress ? 'Buscando...' : 'Adicionar Ponto'}
                </Button>
              </div>

              {/* Lista de pontos */}
              {points.length > 0 && (
                <div className="space-y-2">
                  <Label>Pontos Adicionados ({points.length})</Label>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {points.map((point, index) => (
                      <div key={point.id} className="flex items-center gap-3 p-3 border rounded-lg">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${
                          point.type === 'origin' ? 'bg-green-500' :
                          point.type === 'destination' ? 'bg-red-500' : 'bg-blue-500'
                        }`}>
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm">{point.address}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {point.type === 'origin' ? 'Origem' :
                               point.type === 'destination' ? 'Destino' : 'Parada'}
                            </Badge>
                            {point.cep && (
                              <span className="text-xs text-gray-500">CEP: {point.cep}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          {point.type !== 'destination' && points.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setAsDestination(index)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <MapPin className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removePoint(index)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Ações */}
            <div className="flex justify-between gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              
              <Button 
                onClick={handlePreview}
                disabled={!name || points.length < 2 || loading}
              >
                <Navigation className="h-4 w-4 mr-2" />
                {loading ? 'Otimizando...' : 'Visualizar Rota'}
              </Button>
            </div>
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
