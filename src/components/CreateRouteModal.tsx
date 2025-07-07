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
  const [originPoint, setOriginPoint] = useState<RoutePoint>({
    id: 'origin',
    address: '',
    cep: '',
    lat: 0,
    lng: 0,
    order: 0,
    type: 'origin'
  });
  const [destinationPoint, setDestinationPoint] = useState<RoutePoint>({
    id: 'destination',
    address: '',
    cep: '',
    lat: 0,
    lng: 0,
    order: 999,
    type: 'destination'
  });
  const [waypoints, setWaypoints] = useState<RoutePoint[]>([]);
  const [previewData, setPreviewData] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchingAddress, setSearchingAddress] = useState<number | null>(null);

  const { getAddressByCep, optimizeRoute } = useRoutes();
  const { createRoute, updateRoute } = useRoutesCRUD();

  const isEditing = !!editingRoute?.id;

  useEffect(() => {
    if (editingRoute && open) {
      setRouteName(editingRoute.name || '');
      setRouteDescription(editingRoute.description || '');
      
      const points = editingRoute.points || [];
      const origin = points.find((p: any) => p.type === 'origin');
      const destination = points.find((p: any) => p.type === 'destination');
      const intermediatePoints = points.filter((p: any) => p.type === 'waypoint').sort((a: any, b: any) => a.order - b.order);
      
      if (origin) setOriginPoint(origin);
      if (destination) setDestinationPoint(destination);
      setWaypoints(intermediatePoints);
      setStep(2);
    } else if (open && !editingRoute) {
      resetForm();
    }
  }, [editingRoute, open]);

  const resetForm = () => {
    setStep(1);
    setRouteName('');
    setRouteDescription('');
    setOriginPoint({
      id: 'origin',
      address: '',
      cep: '',
      lat: 0,
      lng: 0,
      order: 0,
      type: 'origin'
    });
    setDestinationPoint({
      id: 'destination',
      address: '',
      cep: '',
      lat: 0,
      lng: 0,
      order: 999,
      type: 'destination'
    });
    setWaypoints([]);
    setPreviewData(null);
    setShowPreview(false);
    setLoading(false);
    setSearchingAddress(null);
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => {
      resetForm();
    }, 300);
  };

  const nextStep = () => {
    if (step === 1 && routeName.trim()) {
      setStep(2);
      if (waypoints.length === 0) {
        addWaypoint();
      }
    }
  };

  const addWaypoint = () => {
    const newWaypoint: RoutePoint = {
      id: Date.now().toString(),
      address: '',
      cep: '',
      lat: 0,
      lng: 0,
      order: waypoints.length + 1,
      type: 'waypoint'
    };
    setWaypoints([...waypoints, newWaypoint]);
  };

  const removeWaypoint = (id: string) => {
    const filteredWaypoints = waypoints.filter(p => p.id !== id);
    const reorderedWaypoints = filteredWaypoints.map((point, index) => ({
      ...point,
      order: index + 1
    })) as RoutePoint[];
    setWaypoints(reorderedWaypoints);
  };

  const searchAddressByCep = async (pointId: string, cep: string, isOrigin = false, isDestination = false) => {
    if (!cep || cep.length < 8) return;

    try {
      setSearchingAddress(-1);
      const addressData = await getAddressByCep(cep);
      
      if (isOrigin) {
        setOriginPoint(prev => ({
          ...prev,
          cep: cep,
          address: addressData.address,
          lat: addressData.lat,
          lng: addressData.lng
        }));
      } else if (isDestination) {
        setDestinationPoint(prev => ({
          ...prev,
          cep: cep,
          address: addressData.address,
          lat: addressData.lat,
          lng: addressData.lng
        }));
      } else {
        setWaypoints(prev => prev.map(point => 
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
      }
      
      toast.success('Endereço encontrado!');
    } catch (error) {
      console.error('Error searching address by CEP:', error);
      toast.error('CEP não encontrado');
    } finally {
      setSearchingAddress(null);
    }
  };

  const searchAddressByText = async (pointId: string, address: string, isOrigin = false, isDestination = false) => {
    if (!address || address.length < 5) return;

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

      if (isOrigin) {
        setOriginPoint(prev => ({
          ...prev,
          address: formattedAddress,
          lat: location.lat(),
          lng: location.lng()
        }));
      } else if (isDestination) {
        setDestinationPoint(prev => ({
          ...prev,
          address: formattedAddress,
          lat: location.lat(),
          lng: location.lng()
        }));
      } else {
        setWaypoints(prev => prev.map(point => 
          point.id === pointId 
            ? { 
                ...point, 
                address: formattedAddress,
                lat: location.lat(),
                lng: location.lng()
              }
            : point
        ));
      }
      
      toast.success('Endereço encontrado!');
    } catch (error) {
      console.error('Error searching address:', error);
      toast.error('Endereço não encontrado');
    } finally {
      setSearchingAddress(null);
    }
  };

  const updatePointAddress = (pointId: string, address: string, isOrigin = false, isDestination = false) => {
    if (isOrigin) {
      setOriginPoint(prev => ({ ...prev, address }));
    } else if (isDestination) {
      setDestinationPoint(prev => ({ ...prev, address }));
    } else {
      setWaypoints(prev => prev.map(point => 
        point.id === pointId ? { ...point, address } : point
      ));
    }
  };

  const updatePointCep = async (pointId: string, cep: string, isOrigin = false, isDestination = false) => {
    const cleanCep = cep.replace(/\D/g, '');
    
    if (isOrigin) {
      setOriginPoint(prev => ({ ...prev, cep: cleanCep }));
    } else if (isDestination) {
      setDestinationPoint(prev => ({ ...prev, cep: cleanCep }));
    } else {
      setWaypoints(prev => prev.map(point => 
        point.id === pointId ? { ...point, cep: cleanCep } : point
      ));
    }

    if (cleanCep.length === 8) {
      await searchAddressByCep(pointId, cleanCep, isOrigin, isDestination);
    }
  };

  const generatePreview = async () => {
    try {
      setLoading(true);
      
      // Validar origem e destino
      if (!originPoint.lat || !originPoint.lng || !originPoint.address) {
        toast.error('O ponto de origem é obrigatório');
        return;
      }
      
      if (!destinationPoint.lat || !destinationPoint.lng || !destinationPoint.address) {
        toast.error('O ponto de destino é obrigatório');
        return;
      }
      
      const validWaypoints = waypoints.filter(p => p.lat && p.lng && p.address);
      if (validWaypoints.length === 0) {
        toast.error('É necessário pelo menos 1 ponto intermediário válido');
        return;
      }

      // Otimizar apenas os waypoints (pontos intermediários)
      const optimizedData = await optimizeRoute(validWaypoints);
      
      // Construir a rota final: origem -> waypoints otimizados -> destino
      const finalPoints = [
        originPoint,
        ...optimizedData.points || validWaypoints,
        destinationPoint
      ].map((point, index) => ({
        ...point,
        order: index
      }));

      const preview = {
        name: routeName,
        description: routeDescription,
        points: finalPoints,
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
      
      if (isEditing && editingRoute?.id) {
        await updateRoute({ id: editingRoute.id, route: previewData });
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
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
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
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Configuração da Rota</h3>
                
                {/* Ponto de Origem */}
                <Card className="border-green-200">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white text-sm font-medium">
                        O
                      </div>
                      
                      <div className="flex-1 space-y-3">
                        <h4 className="font-medium text-green-700">Ponto de Origem (Obrigatório)</h4>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label>CEP (opcional)</Label>
                            <Input
                              value={originPoint.cep}
                              onChange={(e) => updatePointCep('origin', e.target.value, true)}
                              placeholder="00000-000"
                              maxLength={9}
                            />
                          </div>
                        </div>
                        
                        <div>
                          <Label>Endereço *</Label>
                          <div className="flex gap-2">
                            <Input
                              value={originPoint.address}
                              onChange={(e) => updatePointAddress('origin', e.target.value, true)}
                              placeholder="Digite o endereço do galpão/origem..."
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => searchAddressByText('origin', originPoint.address, true)}
                              disabled={!originPoint.address || searchingAddress === -1}
                            >
                              <Search className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        
                        {originPoint.lat && originPoint.lng && (
                          <div className="flex items-center gap-2 text-sm text-green-600">
                            <MapPin className="h-4 w-4" />
                            Localização confirmada
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Ponto de Destino */}
                <Card className="border-red-200">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center text-white text-sm font-medium">
                        D
                      </div>
                      
                      <div className="flex-1 space-y-3">
                        <h4 className="font-medium text-red-700">Ponto de Destino (Obrigatório)</h4>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label>CEP (opcional)</Label>
                            <Input
                              value={destinationPoint.cep}
                              onChange={(e) => updatePointCep('destination', e.target.value, false, true)}
                              placeholder="00000-000"
                              maxLength={9}
                            />
                          </div>
                        </div>
                        
                        <div>
                          <Label>Endereço *</Label>
                          <div className="flex gap-2">
                            <Input
                              value={destinationPoint.address}
                              onChange={(e) => updatePointAddress('destination', e.target.value, false, true)}
                              placeholder="Digite o endereço de destino final..."
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => searchAddressByText('destination', destinationPoint.address, false, true)}
                              disabled={!destinationPoint.address || searchingAddress === -1}
                            >
                              <Search className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        
                        {destinationPoint.lat && destinationPoint.lng && (
                          <div className="flex items-center gap-2 text-sm text-red-600">
                            <MapPin className="h-4 w-4" />
                            Localização confirmada
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Pontos Intermediários */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="font-medium text-blue-700">Pontos Intermediários (serão otimizados automaticamente)</h4>
                    <Button onClick={addWaypoint} size="sm" variant="outline">
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar Ponto
                    </Button>
                  </div>
                  
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {waypoints.map((point, index) => (
                      <Card key={point.id} className="border-blue-200">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-medium">
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
                                <div className="flex items-center gap-2 text-sm text-blue-600">
                                  <MapPin className="h-4 w-4" />
                                  Localização confirmada
                                </div>
                              )}
                            </div>
                            
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => removeWaypoint(point.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
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
                    disabled={loading || !originPoint.lat || !destinationPoint.lat || waypoints.filter(p => p.lat && p.lng).length < 1}
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
