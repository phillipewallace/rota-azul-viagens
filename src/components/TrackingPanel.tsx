
import React, { useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTrucks } from '@/hooks/useTrucks';
import { useRealTimeSync } from '@/hooks/useRealTimeSync';
import { RefreshCw, Wifi, WifiOff, MapPin, Clock } from 'lucide-react';

const TrackingPanel = () => {
  const { trucks, loading, error } = useTrucks();
  const { connectionStatus, forceRefresh } = useRealTimeSync();

  // Forçar refresh a cada 30 segundos
  useEffect(() => {
    const autoRefresh = setInterval(() => {
      if (!loading && connectionStatus.isConnected) {
        forceRefresh();
      }
    }, 30000);

    return () => clearInterval(autoRefresh);
  }, [forceRefresh, loading, connectionStatus.isConnected]);

  const handleRefresh = () => {
    console.log('🔄 [TRACKING PANEL] Refresh manual');
    forceRefresh();
  };

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
        <Button size="sm" onClick={handleRefresh} variant="outline" className="w-full">
          <RefreshCw className="h-4 w-4 mr-2" />
          Tentar novamente
        </Button>
      </div>
    );
  }

  // Filtrar apenas caminhões com localização ou em rota
  const activeTrucks = trucks.filter(truck => 
    truck.location || truck.status === 'in-route' || truck.currentRoute
  );

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
          <Button size="sm" onClick={handleRefresh} variant="ghost" className="p-2">
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
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-gray-500" />
              <span className="font-mono">
                {connectionStatus.lastUpdate.toLocaleTimeString('pt-BR')}
              </span>
            </div>
          </div>
        )}
        <div className="flex justify-between items-center mt-1">
          <span>Caminhões rastreados:</span>
          <span className="font-semibold">{connectionStatus.trackedTrucks}</span>
        </div>
      </div>
      
      {activeTrucks.length === 0 ? (
        <div className="text-center text-gray-500 py-8">
          <MapPin className="h-8 w-8 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">Nenhum caminhão ativo</p>
          <p className="text-xs mt-1">Aguardando dados de rastreamento</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {activeTrucks.map((truck) => {
            const isActive = truck.status === 'in-route';
            const hasLocation = truck.location;
            const hasRoute = truck.currentRoute;
            
            return (
              <Card key={truck.id} className={`p-3 border-l-4 ${
                isActive ? 'border-l-green-500' : 
                hasRoute ? 'border-l-blue-500' : 'border-l-gray-300'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-sm">{truck.name}</h3>
                  <div className="flex items-center gap-1">
                    {hasLocation && (
                      <MapPin className="h-3 w-3 text-green-500" />
                    )}
                    <Badge 
                      variant={isActive ? 'default' : truck.status === 'maintenance' ? 'destructive' : 'secondary'}
                      className={`text-xs ${
                        isActive ? 'bg-green-500' : 
                        truck.status === 'maintenance' ? 'bg-red-500' : 
                        'bg-gray-500'
                      }`}
                    >
                      <div className={`w-2 h-2 rounded-full mr-1 ${
                        isActive ? 'bg-green-200 animate-pulse' : 
                        truck.status === 'maintenance' ? 'bg-red-200' : 
                        'bg-gray-200'
                      }`}></div>
                      {isActive ? 'Em movimento' : 
                       truck.status === 'maintenance' ? 'Manutenção' : 'Disponível'}
                    </Badge>
                  </div>
                </div>
                
                <div className="text-xs text-gray-600 space-y-1">
                  <div className="flex justify-between">
                    <span>Placa:</span>
                    <span className="font-mono font-medium">{truck.plate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Modelo:</span>
                    <span className="font-medium">{truck.model} ({truck.year})</span>
                  </div>
                  {truck.driverName && (
                    <div className="flex justify-between">
                      <span>Motorista:</span>
                      <span className="font-medium truncate ml-2">{truck.driverName}</span>
                    </div>
                  )}
                  {truck.currentRouteName && (
                    <div className="flex justify-between">
                      <span>Rota:</span>
                      <span className="font-medium truncate ml-2">{truck.currentRouteName}</span>
                    </div>
                  )}
                  
                  {hasLocation && (
                    <div className="space-y-1 pt-1 border-t border-gray-100">
                      <div className="flex justify-between">
                        <span>Coordenadas:</span>
                        <span className="font-mono text-xs">
                          {truck.location.lat.toFixed(4)}, {truck.location.lng.toFixed(4)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>GPS Status:</span>
                        <span className="font-medium text-green-600 flex items-center gap-1">
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                          Ativo
                        </span>
                      </div>
                    </div>
                  )}
                  
                  {!hasLocation && isActive && (
                    <div className="pt-1 border-t border-gray-100">
                      <div className="flex items-center justify-center gap-1 text-orange-600">
                        <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                        <span className="text-xs">Aguardando GPS</span>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
      
      {/* Indicador de sincronização automática */}
      <div className="mt-3 pt-2 border-t border-gray-100">
        <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
          <span>Sincronização automática ativa</span>
        </div>
      </div>
    </div>
  );
};

export default TrackingPanel;
