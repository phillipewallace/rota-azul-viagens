
import React, { useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTrucks } from '@/hooks/useTrucks';
import { useRealTimeSync } from '@/hooks/useRealTimeSync';
import { RefreshCw, Wifi, WifiOff, MapPin } from 'lucide-react';

const TrackingPanel = () => {
  const { trucks, loading, error, loadTrucks } = useTrucks();
  const { connectionStatus } = useRealTimeSync();

  // Auto-refresh a cada 10 segundos
  useEffect(() => {
    const autoRefresh = setInterval(() => {
      if (!loading) {
        loadTrucks();
      }
    }, 10000);

    return () => clearInterval(autoRefresh);
  }, [loadTrucks, loading]);

  if (loading) {
    return (
      <div className="fixed top-4 right-4 w-80 max-w-[90vw] bg-white rounded-lg shadow-xl p-4 z-50">
        <div className="animate-pulse">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
            <div className="h-4 bg-gray-300 rounded w-32"></div>
          </div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed top-4 right-4 w-80 max-w-[90vw] bg-white rounded-lg shadow-xl p-4 z-50">
        <div className="text-red-500 text-sm mb-2">{error}</div>
        <Button size="sm" onClick={loadTrucks} variant="outline" className="w-full">
          <RefreshCw className="h-4 w-4 mr-2" />
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed top-4 right-4 w-80 max-w-[90vw] bg-white rounded-lg shadow-xl p-4 z-50 max-h-[80vh] overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            connectionStatus.isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
          }`}></div>
          <h2 className="font-semibold text-gray-800 text-sm lg:text-base">
            Rastreamento Tempo Real
          </h2>
        </div>
        <div className="flex items-center gap-1">
          {connectionStatus.isConnected ? (
            <Wifi className="h-4 w-4 text-green-500" />
          ) : (
            <WifiOff className="h-4 w-4 text-red-500" />
          )}
          <Button size="sm" onClick={loadTrucks} variant="ghost" className="p-2">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Status da conexão */}
      <div className="mb-3 p-2 bg-gray-50 rounded text-xs">
        <div className="flex justify-between items-center">
          <span>Status:</span>
          <Badge 
            variant={connectionStatus.isConnected ? "default" : "destructive"}
            className={`text-xs ${connectionStatus.isConnected ? 'bg-green-500' : 'bg-red-500'}`}
          >
            {connectionStatus.isConnected ? 'Online' : 'Offline'}
          </Badge>
        </div>
        {connectionStatus.lastUpdate && (
          <div className="flex justify-between items-center mt-1">
            <span>Última atualização:</span>
            <span className="font-mono">
              {connectionStatus.lastUpdate.toLocaleTimeString('pt-BR')}
            </span>
          </div>
        )}
        <div className="flex justify-between items-center mt-1">
          <span>Caminhões rastreados:</span>
          <span className="font-semibold">{connectionStatus.trackedTrucks}</span>
        </div>
      </div>
      
      {trucks.length === 0 ? (
        <div className="text-center text-gray-500 py-8">
          <p className="text-sm">Nenhum caminhão encontrado</p>
          <p className="text-xs mt-1">Verifique a conexão com o servidor</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {trucks.map((truck) => (
            <Card key={truck.id} className="p-3 border-l-4 border-l-blue-500">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-sm">{truck.name}</h3>
                <div className="flex items-center gap-1">
                  {truck.location && (
                    <MapPin className="h-3 w-3 text-green-500" />
                  )}
                  <Badge 
                    variant={truck.status === 'in-route' ? 'default' : truck.status === 'maintenance' ? 'destructive' : 'secondary'}
                    className={`text-xs ${
                      truck.status === 'in-route' ? 'bg-green-500' : 
                      truck.status === 'maintenance' ? 'bg-red-500' : 
                      'bg-gray-500'
                    }`}
                  >
                    <div className={`w-2 h-2 rounded-full mr-1 ${
                      truck.status === 'in-route' ? 'bg-green-200 animate-pulse' : 
                      truck.status === 'maintenance' ? 'bg-red-200' : 
                      'bg-gray-200'
                    }`}></div>
                    {truck.status === 'in-route' ? 'Em movimento' : 
                     truck.status === 'maintenance' ? 'Manutenção' : 'Disponível'}
                  </Badge>
                </div>
              </div>
              
              <div className="text-xs text-gray-600 space-y-1">
                <div className="flex justify-between">
                  <span>Placa:</span>
                  <span className="font-medium">{truck.plate}</span>
                </div>
                <div className="flex justify-between">
                  <span>Modelo:</span>
                  <span className="font-medium">{truck.model} ({truck.year})</span>
                </div>
                {truck.driver && (
                  <div className="flex justify-between">
                    <span>Motorista:</span>
                    <span className="font-medium truncate ml-2">{truck.driver}</span>
                  </div>
                )}
                {truck.currentRoute && (
                  <div className="flex justify-between">
                    <span>Rota:</span>
                    <span className="font-medium truncate ml-2">{truck.currentRoute}</span>
                  </div>
                )}
                {truck.location && (
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span>Localização:</span>
                      <span className="font-medium text-xs">
                        {truck.location.lat.toFixed(4)}, {truck.location.lng.toFixed(4)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Última posição:</span>
                      <span className="font-medium text-xs text-green-600">
                        Tempo real
                      </span>
                    </div>
                  </div>
                )}
                
                {/* Indicador de GPS ativo para caminhões em rota */}
                {truck.status === 'in-route' && (
                  <div className="mt-2 p-2 bg-green-50 rounded border border-green-200">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-xs text-green-700 font-medium">
                        GPS Tracking Ativo
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default TrackingPanel;
