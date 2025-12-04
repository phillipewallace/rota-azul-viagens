/**
 * AddStopModal - Modal para adicionar parada extra à rota
 * 
 * Funcionalidades:
 * - Campo de endereço com suporte a Google Maps Places Autocomplete
 * - Extração automática de coordenadas (lat/lng) de links de mapa
 * - Pré-preenchimento com localização compartilhada via WhatsApp/deep link
 * - Botão "Sugerir melhor posição" que calcula posição ótima usando GPS
 * - Seleção manual de posição na rota
 * 
 * IMPORTANTE: Não quebra o drag & drop existente na StopsList
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { X, MapPin, Navigation, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { sharedLocationStore } from '@/store/sharedLocationStore';
import { GOOGLE_MAPS_API_KEY } from '@/services/config';
import { toast } from 'sonner';

interface RoutePoint {
  id: string;
  name?: string;
  address: string;
  lat: number;
  lng: number;
  completed: boolean;
  order: number;
}

interface AddStopModalProps {
  points: RoutePoint[];
  onClose: () => void;
  onAdd: (data: {
    name: string;
    stopType: string;
    location: string;
    lat?: number;
    lng?: number;
    insertBeforeId?: string;
  }) => void;
}

// Fórmula de Haversine para calcular distância entre dois pontos
const haversineDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371; // Raio da Terra em km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Extrair coordenadas de texto/link
const extractCoordinatesFromText = (text: string): { lat?: number; lng?: number } => {
  const patterns = [
    /maps\?q=(-?\d+\.?\d*),(-?\d+\.?\d*)/,
    /@(-?\d+\.?\d*),(-?\d+\.?\d*)/,
    /maps\/place\/[^\/]+\/@(-?\d+\.?\d*),(-?\d+\.?\d*)/,
    /q=(-?\d+\.?\d*),(-?\d+\.?\d*)/,
    /(-?\d+\.\d{4,}),\s*(-?\d+\.\d{4,})/,
    /geo:(-?\d+\.?\d*),(-?\d+\.?\d*)/,
    /place\/(-?\d+\.?\d*),(-?\d+\.?\d*)/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
        return { lat, lng };
      }
    }
  }
  
  return {};
};

const AddStopModal: React.FC<AddStopModalProps> = ({ points, onClose, onAdd }) => {
  const [name, setName] = useState('');
  const [stopType, setStopType] = useState('Entrega');
  const [location, setLocation] = useState('');
  const [coordinates, setCoordinates] = useState<{ lat?: number; lng?: number }>({});
  const [insertPosition, setInsertPosition] = useState<string>('end');
  const [isLoadingGPS, setIsLoadingGPS] = useState(false);
  const [isCalculatingPosition, setIsCalculatingPosition] = useState(false);
  const [suggestedPosition, setSuggestedPosition] = useState<string | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  // Pontos ainda não concluídos (para cálculo de posição)
  const pendingPoints = points.filter(p => !p.completed).sort((a, b) => a.order - b.order);

  // Inicializar Google Places Autocomplete
  useEffect(() => {
    if (!inputRef.current || !window.google?.maps?.places) {
      // Tentar carregar Google Maps API se não estiver disponível
      if (!window.google?.maps?.places) {
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
        script.async = true;
        script.onload = () => {
          initializeAutocomplete();
        };
        document.head.appendChild(script);
      }
      return;
    }
    
    initializeAutocomplete();
  }, []);

  const initializeAutocomplete = () => {
    if (!inputRef.current || !window.google?.maps?.places) return;
    
    try {
      autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, {
        types: ['geocode', 'establishment'],
        componentRestrictions: { country: 'br' },
        fields: ['formatted_address', 'geometry', 'name']
      });

      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current?.getPlace();
        if (place?.geometry?.location) {
          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();
          const address = place.formatted_address || place.name || '';
          
          setLocation(address);
          setCoordinates({ lat, lng });
          
          console.log('📍 [ADD STOP] Endereço selecionado via autocomplete:', { address, lat, lng });
        }
      });
    } catch (error) {
      console.error('❌ [ADD STOP] Erro ao inicializar autocomplete:', error);
    }
  };

  // Pré-preencher com localização compartilhada
  useEffect(() => {
    const sharedState = sharedLocationStore.getState();
    if (sharedState.sharedContent) {
      console.log('📍 [ADD STOP] Preenchendo com localização compartilhada:', sharedState.sharedContent);
      setLocation(sharedState.sharedContent);
      
      // Tentar extrair coordenadas
      const coords = extractCoordinatesFromText(sharedState.sharedContent);
      if (coords.lat && coords.lng) {
        setCoordinates(coords);
        console.log('📍 [ADD STOP] Coordenadas extraídas:', coords);
      }
    }
  }, []);

  // Monitorar mudanças no campo de localização para extrair coordenadas
  const handleLocationChange = (value: string) => {
    setLocation(value);
    
    // Tentar extrair coordenadas se for um link
    const coords = extractCoordinatesFromText(value);
    if (coords.lat && coords.lng) {
      setCoordinates(coords);
    }
  };

  // Obter localização atual do motorista via GPS
  const getCurrentPosition = (): Promise<{ lat: number; lng: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('GPS não disponível neste dispositivo'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          let message = 'Erro ao obter localização';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              message = 'Permissão de localização negada. Habilite nas configurações.';
              break;
            case error.POSITION_UNAVAILABLE:
              message = 'Localização não disponível no momento.';
              break;
            case error.TIMEOUT:
              message = 'Tempo esgotado ao obter localização.';
              break;
          }
          reject(new Error(message));
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 30000
        }
      );
    });
  };

  /**
   * Calcular a melhor posição para inserir a parada extra
   * considerando apenas paradas pendentes e a posição atual do motorista
   */
  const handleSuggestPosition = async () => {
    setIsCalculatingPosition(true);
    setGpsError(null);

    try {
      // Verificar se temos coordenadas da nova parada
      if (!coordinates.lat || !coordinates.lng) {
        throw new Error('Primeiro selecione um endereço válido com localização');
      }

      // Obter posição atual do motorista
      setIsLoadingGPS(true);
      const driverPosition = await getCurrentPosition();
      setIsLoadingGPS(false);

      console.log('📍 [SUGGEST] Posição do motorista:', driverPosition);
      console.log('📍 [SUGGEST] Coordenadas da nova parada:', coordinates);
      console.log('📍 [SUGGEST] Paradas pendentes:', pendingPoints.length);

      if (pendingPoints.length === 0) {
        setSuggestedPosition('end');
        setInsertPosition('end');
        toast.success('Sem paradas pendentes. Parada será adicionada no final.');
        return;
      }

      // Calcular a melhor posição
      // Consideramos: posição atual do motorista + sequência de paradas pendentes + nova parada
      
      let bestPosition = 'end';
      let minExtraDistance = Infinity;

      // Para cada posição possível, calcular a distância extra adicionada
      for (let i = 0; i <= pendingPoints.length; i++) {
        let totalExtraDistance = 0;

        if (i === 0) {
          // Inserir antes da primeira parada pendente
          // Distância extra: driver -> nova parada -> primeira parada
          // vs distância original: driver -> primeira parada
          const distDriverToNew = haversineDistance(
            driverPosition.lat, driverPosition.lng,
            coordinates.lat!, coordinates.lng!
          );
          const distNewToFirst = haversineDistance(
            coordinates.lat!, coordinates.lng!,
            pendingPoints[0].lat, pendingPoints[0].lng
          );
          const distDriverToFirst = haversineDistance(
            driverPosition.lat, driverPosition.lng,
            pendingPoints[0].lat, pendingPoints[0].lng
          );
          
          totalExtraDistance = distDriverToNew + distNewToFirst - distDriverToFirst;
          
          if (totalExtraDistance < minExtraDistance) {
            minExtraDistance = totalExtraDistance;
            bestPosition = pendingPoints[0].id;
          }
        } else if (i === pendingPoints.length) {
          // Inserir no final
          const lastPoint = pendingPoints[pendingPoints.length - 1];
          const distLastToNew = haversineDistance(
            lastPoint.lat, lastPoint.lng,
            coordinates.lat!, coordinates.lng!
          );
          
          totalExtraDistance = distLastToNew;
          
          if (totalExtraDistance < minExtraDistance) {
            minExtraDistance = totalExtraDistance;
            bestPosition = 'end';
          }
        } else {
          // Inserir entre duas paradas
          const prevPoint = pendingPoints[i - 1];
          const nextPoint = pendingPoints[i];
          
          // Distância extra: prev -> nova -> next
          // vs distância original: prev -> next
          const distPrevToNew = haversineDistance(
            prevPoint.lat, prevPoint.lng,
            coordinates.lat!, coordinates.lng!
          );
          const distNewToNext = haversineDistance(
            coordinates.lat!, coordinates.lng!,
            nextPoint.lat, nextPoint.lng
          );
          const distPrevToNext = haversineDistance(
            prevPoint.lat, prevPoint.lng,
            nextPoint.lat, nextPoint.lng
          );
          
          totalExtraDistance = distPrevToNew + distNewToNext - distPrevToNext;
          
          if (totalExtraDistance < minExtraDistance) {
            minExtraDistance = totalExtraDistance;
            bestPosition = nextPoint.id; // Inserir "antes de" nextPoint
          }
        }
      }

      console.log('📍 [SUGGEST] Melhor posição calculada:', bestPosition, 'Distância extra:', minExtraDistance.toFixed(2), 'km');

      setSuggestedPosition(bestPosition);
      setInsertPosition(bestPosition);
      
      const positionLabel = bestPosition === 'end' 
        ? 'no final da rota'
        : `antes da parada ${pendingPoints.findIndex(p => p.id === bestPosition) + 1}`;
      
      toast.success(`Melhor posição sugerida: ${positionLabel} (+${minExtraDistance.toFixed(1)} km)`);

    } catch (error: any) {
      console.error('❌ [SUGGEST] Erro ao calcular posição:', error);
      setGpsError(error.message);
      toast.error(error.message);
    } finally {
      setIsCalculatingPosition(false);
      setIsLoadingGPS(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Por favor, preencha o nome do cliente/ponto');
      return;
    }

    if (!location.trim()) {
      toast.error('Por favor, preencha o endereço ou localização');
      return;
    }

    const data = {
      name: name.trim(),
      stopType,
      location: location.trim(),
      lat: coordinates.lat,
      lng: coordinates.lng,
      insertBeforeId: insertPosition !== 'end' ? insertPosition : undefined
    };

    console.log('📍 [ADD STOP] Enviando dados:', data);
    onAdd(data);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        <CardContent className="p-0 flex flex-col h-full">
          {/* Header fixo */}
          <div className="flex justify-between items-center p-4 border-b bg-white sticky top-0 z-10">
            <h2 className="text-xl font-bold text-gray-900">Adicionar Parada Extra</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-10 w-10 p-0 rounded-full"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Conteúdo rolável */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Nome */}
            <div>
              <Label htmlFor="name" className="text-sm font-semibold text-gray-700">
                Nome do cliente/ponto *
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: João Silva"
                className="mt-1 h-12"
                required
              />
            </div>

            {/* Tipo de Parada */}
            <div>
              <Label htmlFor="stopType" className="text-sm font-semibold text-gray-700">
                Tipo de parada
              </Label>
              <select
                id="stopType"
                value={stopType}
                onChange={(e) => setStopType(e.target.value)}
                className="w-full mt-1 border rounded-lg px-3 py-3 text-base bg-white"
              >
                <option value="Coleta">Coleta</option>
                <option value="Serviço">Serviço</option>
                <option value="Entrega">Entrega</option>
                <option value="Outro">Outro</option>
              </select>
            </div>

            {/* Localização com Autocomplete */}
            <div>
              <Label htmlFor="location" className="text-sm font-semibold text-gray-700">
                Endereço *
              </Label>
              <div className="relative mt-1">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  ref={inputRef}
                  id="location"
                  value={location}
                  onChange={(e) => handleLocationChange(e.target.value)}
                  placeholder="Digite ou cole um endereço/link"
                  className="pl-10 h-12"
                  required
                />
              </div>
              
              {/* Indicador de coordenadas */}
              {coordinates.lat && coordinates.lng ? (
                <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                  <Navigation className="h-3 w-3" />
                  Coordenadas detectadas: {coordinates.lat.toFixed(6)}, {coordinates.lng.toFixed(6)}
                </p>
              ) : (
                <p className="text-xs text-gray-500 mt-1">
                  Selecione da lista ou cole um link do Google Maps/WhatsApp
                </p>
              )}
            </div>

            {/* Botão Sugerir Melhor Posição */}
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <Button
                type="button"
                variant="outline"
                onClick={handleSuggestPosition}
                disabled={isCalculatingPosition || !coordinates.lat}
                className="w-full h-12 gap-2 border-blue-300 text-blue-700 hover:bg-blue-100"
              >
                {isCalculatingPosition ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    {isLoadingGPS ? 'Obtendo GPS...' : 'Calculando...'}
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5" />
                    Sugerir melhor posição na rota
                  </>
                )}
              </Button>
              
              <p className="text-xs text-blue-600 mt-2 text-center">
                Usa sua localização GPS atual para otimizar a posição
              </p>
              
              {gpsError && (
                <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {gpsError}
                </p>
              )}
              
              {suggestedPosition && !gpsError && (
                <p className="text-xs text-green-600 mt-2 font-medium text-center">
                  ✓ Posição otimizada selecionada automaticamente
                </p>
              )}
            </div>

            {/* Posição na Rota */}
            <div>
              <Label className="text-sm font-semibold text-gray-700">
                Posição na rota
              </Label>
              <div className="space-y-2 mt-2 max-h-48 overflow-y-auto">
                {pendingPoints.map((point, index) => (
                  <label
                    key={point.id}
                    className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                      insertPosition === point.id 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="position"
                      value={point.id}
                      checked={insertPosition === point.id}
                      onChange={(e) => setInsertPosition(e.target.value)}
                      className="h-5 w-5 text-blue-600"
                    />
                    <span className="text-sm flex-1">
                      <strong>Antes da parada {index + 1}</strong>
                      <br />
                      <span className="text-gray-500 text-xs">
                        {point.name || point.address.substring(0, 35)}...
                      </span>
                    </span>
                  </label>
                ))}
                
                <label 
                  className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                    insertPosition === 'end' 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="position"
                    value="end"
                    checked={insertPosition === 'end'}
                    onChange={(e) => setInsertPosition(e.target.value)}
                    className="h-5 w-5 text-blue-600"
                  />
                  <span className="text-sm font-semibold">No final da rota</span>
                </label>
              </div>
            </div>
          </form>

          {/* Footer fixo com botões */}
          <div className="border-t bg-white p-4 flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 h-12"
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              onClick={handleSubmit}
              className="flex-1 h-12 font-semibold"
            >
              Adicionar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AddStopModal;
