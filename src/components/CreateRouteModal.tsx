
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, MapPin, Search } from "lucide-react";
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
  const [step, setStep] = useState(1);
  const [routeName, setRouteName] = useState('');
  const [routeDescription, setRouteDescription] = useState('');
  const [points, setPoints] = useState<RoutePoint[]>([]);
  const [previewData, setPreviewData] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchingAddress, setSearchingAddress] = useState<number | null>(null);

  const { getAddressByCep, optimizeRoute } = useRoutes();
  const { createRoute, updateRoute } = useRoutesCRUD();

  const isEditing = !!editingRoute;

  useEffect(() => {
    if (editingRoute && open) {
      setRouteName(editingRoute.name || '');
      setRouteDescription(editingRoute.description || '');
      setPoints(editingRoute.points || []);
      setStep(2);
    } else if (!editingRoute && open) {
      resetForm();
    }
  }, [editingRoute, open]);

  const resetForm = () => {
    setStep(1);
    setRouteName('');
    setRouteDescription('');
    setPoints([]);
    setPreviewData(null);
    setShowPreview(false);
    setLoading(false);
    setSearchingAddress(null);
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(resetForm, 300);
  };

  const nextStep = () => {
    if (step === 1 && routeName.trim()) {
      setStep(2);
      if (points.length === 0) {
        addPoint();
      }
    }
  };

  const addPoint = () => {
    const newPoint: RoutePoint = {
      id: Date.now().toString(),
      address: '',
      cep: '',
      lat: 0,
      lng: 0,
      order: points.length,
      type: points.length === 0 ? 'origin' : 'waypoint'
    };
    setPoints([...points, newPoint]);
  };

  const removePoint = (id: string) => {
    if (points.length <= 1) {
      toast.error('Deve haver pelo menos um ponto na rota');
      return;
    }
    
    const filteredPoints = points.filter(p => p.id !== id);
    const reorderedPoints = filteredPoints.map((point, index) => ({
      ...point,
      order: index,
      type: index === 0 ? 'origin' : 
            index === filteredPoints.length - 1 && filteredPoints.length > 1 ? 'destination' : 'waypoint'
    })) as RoutePoint[];
    setPoints(reorderedPoints);
  };

  const searchAddressByCep = async (pointId: string, cep: string) => {
    if (!cep || cep.length < 8) return;

    try {
      setSearchingAddress(points.findIndex(p => p.id === pointId));
      const addressData = await getAddressByCep(cep);
      
      setPoints(prev => prev.map(point => 
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
      console.error('Error searching address by CEP:', error);
      toast.error('CEP não encontrado');
    } finally {
      setSearchingAddress(null);
    }
  };

  const searchAddressByText = async (pointId: string, address: string) => {
    if (!address || address.length < 5) return;

    try {
      setSearchingAddress(points.findIndex(p => p.id === pointId));
      
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

      setPoints(prev => prev.map(point => 
        point.id === pointId 
          ? { 
              ...point, 
              address: formattedAddress,
              lat: location.lat(),
              lng: location.lng(),
              cep: point.cep || ''
            }
          : point
      ));
      
      toast.success('Endereço encontrado!');
    } catch (error) {
      console.error('Error searching address:', error);
      toast.error('Endereço não encontrado');
    } finally {
      setSearchingAddress(null);
    }
  };

  const updatePointAddress = (pointId: string, address: string) => {
    setPoints(prev => prev.map(point => 
      point.id === pointId ? { ...point, address } : point
    ));
  };

  const updatePointCep = async (pointId: string, cep: string) => {
    const cleanCep = cep.replace(/\D/g, '');
    
    setPoints(prev => prev.map(point => 
      point.id === pointId ? { ...point, cep: cleanCep } : point
    ));

    if (cleanCep.length === 8) {
      await searchAddressByCep(pointId, cleanCep);
    }
  };

  const generatePreview = async () => {
    try {
      setLoading(true);
      
      const validPoints = points.filter(p => p.lat && p.lng && p.address);
      if (validPoints.length < 2) {
        toast.error('É necessário pelo menos 2 pontos válidos para gerar a rota');
        return;
      }

      const optimizedData = await optimizeRoute(validPoints);
      
      const preview = {
        name: routeName,
        description: routeDescription,
        points: validPoints,
        totalDistance: optimizedData.totalDistance,
        estimatedTime: optimizedData.estimatedTime,
        status: 'active'
      };

      setPreviewData(preview);
      setShowPreview(true);
    } catch (error) {
      console.error('Error generating preview:', error);
      toast.error('Erro ao gerar preview da rota');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!previewData) return;

    try {
      setLoading(true);
      
      if (isEditing) {
        await updateRoute(editingRoute.id, previewData);
        toast.success('Rota atualizada com sucesso!');
      } else {
        await createRoute(previewData);
        toast.success('Rota criada com sucesso!');
      }
      
      onSuccess();
      handleClose();
    } catch (error) {
      console.error('Error saving route:', error);
      toast.error('Erro ao salvar rota');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToEdit = () => {
    setShowPreview(false);
    setPreviewData(null);
  };

  return (
    <>
      <Dialog open={open && !showPreview} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? 'Editar Rota' : 'Nova Rota'} - Passo {step} de 2
            </DialogTitle>
          </DialogHeader>
          
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="routeName">Nome da Rota *</Label>
                <Input
                  id="routeName"
                  value={routeName}
                  onChange={(e) => setRouteName(e.target.value)}
                  placeholder="Ex: Rota Centro - Zona Sul"
                />
              </div>
              
              <div>
                <Label htmlFor="routeDescription">Descrição (opcional)</Label>
                <Textarea
                  id="routeDescription"
                  value={routeDescription}
                  onChange={(e) => setRouteDescription(e.target.value)}
                  placeholder="Descreva a rota..."
                  rows={3}
                />
              </div>
              
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleClose}>
                  Cancelar
                </Button>
                <Button onClick={nextStep} disabled={!routeName.trim()}>
                  Próximo
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Pontos da Rota</h3>
                <Button onClick={addPoint} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Ponto
                </Button>
              </div>
              
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {points.map((point, index) => (
                  <Card key={point.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${
                          point.type === 'origin' ? 'bg-green-500' : 'bg-blue-500'
                        }`}>
                          {index + 1}
                        </div>
                        
                        <div className="flex-1 space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label>CEP (opcional)</Label>
                              <Input
                                value={point.cep}
                                onChange={(e) => updatePointCep(point.id, e.target.value)}
                                placeholder="00000-000"
                                maxLength={9}
                              />
                            </div>
                            
                            <div>
                              <Label>Tipo</Label>
                              <div className="text-sm p-2 bg-gray-50 rounded border">
                                {point.type === 'origin' ? 'Origem' : 'Parada Intermediária'}
                              </div>
                            </div>
                          </div>
                          
                          <div>
                            <Label>Endereço *</Label>
                            <div className="flex gap-2">
                              <Input
                                value={point.address}
                                onChange={(e) => updatePointAddress(point.id, e.target.value)}
                                placeholder="Digite o endereço completo..."
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => searchAddressByText(point.id, point.address)}
                                disabled={!point.address || searchingAddress === index}
                              >
                                <Search className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          
                          {point.lat && point.lng && (
                            <div className="flex items-center gap-2 text-sm text-green-600">
                              <MapPin className="h-4 w-4" />
                              Localização confirmada
                            </div>
                          )}
                        </div>
                        
                        {points.length > 1 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removePoint(point.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              
              <div className="flex justify-between gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setStep(1)}>
                  Voltar
                </Button>
                
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleClose}>
                    Cancelar
                  </Button>
                  <Button 
                    onClick={generatePreview}
                    disabled={loading || points.filter(p => p.lat && p.lng).length < 2}
                  >
                    {loading ? 'Gerando...' : 'Gerar Preview'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <RoutePreviewModal
        open={showPreview}
        onOpenChange={setShowPreview}
        previewData={previewData}
        onSave={handleSave}
        onBack={handleBackToEdit}
        loading={loading}
        isEditing={isEditing}
      />
    </>
  );
};

export default CreateRouteModal;
