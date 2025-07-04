
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MapPin, Clock, Route } from "lucide-react";

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
  if (!previewData) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Route className="h-5 w-5 text-blue-600" />
            Preview da Rota Otimizada
          </DialogTitle>
          <DialogDescription>
            Revise os detalhes da rota otimizada antes de salvá-la.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Informações Básicas */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-semibold text-lg text-blue-900 mb-2">{previewData.name}</h3>
            {previewData.description && (
              <p className="text-blue-700">{previewData.description}</p>
            )}
          </div>

          {/* Estatísticas da Rota */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-green-50 p-4 rounded-lg text-center">
              <MapPin className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-green-800">
                {previewData.points?.length || 0}
              </div>
              <div className="text-sm text-green-600">Pontos de Parada</div>
            </div>
            
            <div className="bg-orange-50 p-4 rounded-lg text-center">
              <Route className="h-8 w-8 text-orange-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-orange-800">
                {previewData.totalDistance?.toFixed(1) || '0.0'} km
              </div>
              <div className="text-sm text-orange-600">Distância Total</div>
            </div>
            
            <div className="bg-purple-50 p-4 rounded-lg text-center">
              <Clock className="h-8 w-8 text-purple-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-purple-800">
                {previewData.estimatedTime || 'N/A'}
              </div>
              <div className="text-sm text-purple-600">Tempo Estimado</div>
            </div>
          </div>

          {/* Sequência de Pontos Otimizada */}
          {previewData.points && previewData.points.length > 0 && (
            <div>
              <h4 className="font-semibold mb-3 text-gray-900">Sequência Otimizada:</h4>
              <div className="space-y-2">
                {previewData.points
                  .sort((a: any, b: any) => a.order - b.order)
                  .map((point: any, index: number) => (
                  <div key={point.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                      point.type === 'origin' ? 'bg-green-500' :
                      point.type === 'destination' ? 'bg-red-500' : 'bg-blue-500'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{point.address}</p>
                      <p className="text-sm text-gray-500 capitalize">
                        {point.type === 'origin' ? 'Origem' : 
                         point.type === 'destination' ? 'Destino' : 'Parada Intermediária'}
                      </p>
                      {point.cep && (
                        <p className="text-xs text-gray-400">CEP: {point.cep}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mapa Preview Placeholder */}
          <div className="bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg h-64 flex items-center justify-center">
            <div className="text-center text-gray-500">
              <MapPin className="h-12 w-12 mx-auto mb-2" />
              <p>Preview do Mapa</p>
              <p className="text-sm">A rota será exibida aqui no futuro</p>
            </div>
          </div>

          {/* Ações */}
          <div className="flex justify-between gap-3 pt-4 border-t">
            <Button 
              variant="outline" 
              onClick={onBack}
              disabled={loading}
            >
              Voltar para Edição
            </Button>
            
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button 
                onClick={onSave}
                disabled={loading}
                className="bg-green-600 hover:bg-green-700"
              >
                {loading ? 'Salvando...' : (isEditing ? 'Atualizar Rota' : 'Criar Rota')}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RoutePreviewModal;
