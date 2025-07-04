
import React, { useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MapPin, Clock, Route as RouteIcon } from "lucide-react";

interface RoutePreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  previewData: any;
  onSave: () => void;
  onBack: () => void;
  loading: boolean;
  isEditing: boolean;
}

export const RoutePreviewModal: React.FC<RoutePreviewModalProps> = ({
  open,
  onOpenChange,
  previewData,
  onSave,
  onBack,
  loading,
  isEditing
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);

  useEffect(() => {
    if (open && previewData && mapRef.current && window.google) {
      initializeMap();
    }
  }, [open, previewData]);

  const initializeMap = () => {
    if (!mapRef.current || !previewData.detailedRoute) return;

    const map = new window.google.maps.Map(mapRef.current, {
      zoom: 10,
      center: previewData.detailedRoute.routes[0].bounds.getCenter(),
      mapTypeControl: true,
      fullscreenControl: false,
      streetViewControl: false,
    });

    const directionsRenderer = new window.google.maps.DirectionsRenderer({
      directions: previewData.detailedRoute,
      map: map,
      panel: null,
      suppressMarkers: false,
      polylineOptions: {
        strokeColor: '#2563eb',
        strokeWeight: 4,
        strokeOpacity: 0.8
      }
    });

    map.fitBounds(previewData.detailedRoute.routes[0].bounds);
    mapInstance.current = map;
  };

  if (!previewData) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RouteIcon className="h-5 w-5 text-blue-600" />
            Prévia da Rota Otimizada
          </DialogTitle>
          <DialogDescription>
            Visualize a rota otimizada antes de {isEditing ? 'salvar as alterações' : 'criar'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Informações da Rota */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="text-center">
              <h3 className="font-semibold text-lg text-blue-600">{previewData.name}</h3>
              {previewData.description && (
                <p className="text-sm text-gray-600 mt-1">{previewData.description}</p>
              )}
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{previewData.totalDistance.toFixed(2)} km</div>
              <div className="text-sm text-gray-600">Distância Total</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600 flex items-center justify-center gap-1">
                <Clock className="h-5 w-5" />
                {previewData.estimatedTime}
              </div>
              <div className="text-sm text-gray-600">Tempo Estimado</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Mapa */}
            <div className="space-y-2">
              <h4 className="font-medium">Visualização da Rota</h4>
              <div ref={mapRef} className="w-full h-64 rounded-lg border bg-gray-100" />
            </div>

            {/* Sequência de Pontos */}
            <div className="space-y-2">
              <h4 className="font-medium">Sequência Otimizada</h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {previewData.points
                  .sort((a: any, b: any) => a.order - b.order)
                  .map((point: any, index: number) => (
                  <div key={point.id} className="flex items-center gap-3 p-3 bg-white border rounded-lg shadow-sm">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                      point.type === 'origin' ? 'bg-green-500' :
                      point.type === 'destination' ? 'bg-red-500' : 'bg-blue-500'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{point.address}</p>
                      <p className="text-xs text-gray-600 capitalize">
                        {point.type === 'origin' ? 'Origem' : 
                         point.type === 'destination' ? 'Destino' : 'Parada'}
                      </p>
                      {point.cep && <p className="text-xs text-gray-500">CEP: {point.cep}</p>}
                    </div>
                    <MapPin className="h-4 w-4 text-gray-400" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Botões */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onBack}
            >
              Voltar para Edição
            </Button>
            <Button 
              onClick={onSave}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700"
            >
              {loading ? `${isEditing ? 'Atualizando' : 'Criando'}...` : `${isEditing ? 'Atualizar' : 'Criar'} Rota`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
