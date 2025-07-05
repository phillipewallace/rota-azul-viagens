
import React, { useState } from 'react';
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { toast } from 'sonner';
import { useMobile, type TruckMobileData } from '../hooks/useMobile';

const MobileDriver = () => {
  const [plateNumber, setPlateNumber] = useState('');
  const [truckData, setTruckData] = useState<TruckMobileData | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { getTruckByPlate } = useMobile();

  const updateActiveTrackingInStorage = (truckId: string | null, isActive: boolean) => {
    try {
      const stored = localStorage.getItem('active-truck-tracking') || '[]';
      let activeTrucks = JSON.parse(stored);
      
      if (isActive && truckId && !activeTrucks.includes(truckId)) {
        activeTrucks.push(truckId);
      } else if (!isActive && truckId) {
        activeTrucks = activeTrucks.filter((id: string) => id !== truckId);
      }
      
      localStorage.setItem('active-truck-tracking', JSON.stringify(activeTrucks));
      
      // Disparar evento para sincronizar com outros componentes
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'active-truck-tracking',
        newValue: JSON.stringify(activeTrucks)
      }));
      
      console.log('📍 [MOBILE] Updated active tracking list:', activeTrucks);
    } catch (error) {
      console.error('❌ [MOBILE] Error updating active tracking storage:', error);
    }
  };

  const handleLogin = async () => {
    if (!plateNumber.trim()) {
      setError('Por favor, insira o número da placa');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('🚛 [MOBILE] Iniciando login com placa:', plateNumber);
      
      const data = await getTruckByPlate(plateNumber);
      setTruckData(data);
      setIsLoggedIn(true);
      
      // Marcar como ativo no rastreamento
      updateActiveTrackingInStorage(data.id, true);
      
      toast.success(`Bem-vindo, ${data.name}!`);
      console.log('✅ [MOBILE] Truck login successful:', data.name);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao fazer login';
      setError(errorMessage);
      console.error('❌ [MOBILE] Login error:', err);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    // Remover do rastreamento ativo
    if (truckData?.id) {
      updateActiveTrackingInStorage(truckData.id, false);
    }
    
    setIsLoggedIn(false);
    setTruckData(null);
    setPlateNumber('');
    setError(null);
    toast.success('Logout realizado com sucesso');
    console.log('👋 [MOBILE] Truck logout');
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-6">
          <h2 className="text-2xl font-semibold mb-4 text-center">
            {isLoggedIn ? 'Painel do Motorista' : 'Acessar Caminhão'}
          </h2>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
              <strong className="font-bold">Erro: </strong>
              <span className="block sm:inline">{error}</span>
            </div>
          )}

          {isLoggedIn ? (
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-gray-700 mb-2">
                  Bem-vindo, <span className="font-semibold text-blue-600">{truckData?.name}</span>!
                </p>
                <p className="text-gray-600">
                  Placa: <span className="font-semibold">{truckData?.plate}</span>
                </p>
                {truckData?.driver && (
                  <p className="text-gray-600">
                    Motorista: <span className="font-semibold">{truckData.driver}</span>
                  </p>
                )}
                {truckData?.currentRoute && (
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm font-semibold text-blue-800">Rota Atual:</p>
                    <p className="text-sm text-blue-700">{truckData.currentRoute.name}</p>
                    {truckData.currentRoute.description && (
                      <p className="text-xs text-blue-600 mt-1">{truckData.currentRoute.description}</p>
                    )}
                  </div>
                )}
              </div>
              <Button variant="destructive" className="w-full" onClick={handleLogout}>
                Sair do Sistema
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label htmlFor="plate" className="block text-sm font-medium text-gray-700 mb-2">
                  Número da Placa
                </label>
                <Input
                  id="plate"
                  type="text"
                  placeholder="Ex: ABC-1234"
                  value={plateNumber}
                  onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
                  disabled={loading}
                  className="text-center font-mono text-lg"
                />
              </div>
              <Button 
                className="w-full" 
                onClick={handleLogin} 
                disabled={loading || !plateNumber.trim()}
              >
                {loading ? 'Carregando...' : 'Entrar no Sistema'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MobileDriver;

