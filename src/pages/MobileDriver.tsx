
import React, { useState } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from 'sonner';

interface TruckData {
  id: string;
  name: string;
  plate: string;
  model: string;
  currentRoute?: {
    id: string;
    name: string;
    points: Array<{
      id: string;
      address: string;
      completed: boolean;
    }>;
  };
}

const MobileDriver = () => {
  const [plateNumber, setPlateNumber] = useState('');
  const [truckData, setTruckData] = useState<TruckData | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      
      console.log('📍 Updated active tracking list:', activeTrucks);
    } catch (error) {
      console.error('Error updating active tracking storage:', error);
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
      const response = await fetch(`https://admmicban.com.br/api/mobile/truck/${plateNumber}`);
      
      if (!response.ok) {
        throw new Error('Caminhão não encontrado');
      }

      const data = await response.json();
      setTruckData(data);
      setIsLoggedIn(true);
      
      // Marcar como ativo no rastreamento
      updateActiveTrackingInStorage(data.id, true);
      
      toast.success(`Bem-vindo, ${data.name}!`);
      console.log('🚛 Truck login successful:', data.name);
      
      // Log dados dos pontos para verificar se estão corretos
      if (data.currentRoute && data.currentRoute.points) {
        console.log('📍 Pontos da rota:', data.currentRoute.points.map((p: any) => ({
          id: p.id,
          address: p.address,
          completed: p.completed
        })));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao fazer login');
      console.error('❌ Login error:', err);
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
    console.log('👋 Truck logout');
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-100">
      <Card className="w-96">
        <CardContent className="p-6">
          <h2 className="text-2xl font-semibold mb-4 text-center">
            {isLoggedIn ? 'Painel do Motorista' : 'Acessar Caminhão'}
          </h2>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
              <strong className="font-bold">Erro:</strong>
              <span className="block sm:inline">{error}</span>
            </div>
          )}

          {isLoggedIn ? (
            <div className="space-y-4">
              <p className="text-gray-700">
                Bem-vindo, <span className="font-semibold">{truckData?.name}</span>!
              </p>
              <p className="text-gray-700">
                Placa do caminhão: <span className="font-semibold">{truckData?.plate}</span>
              </p>
              
              {truckData?.currentRoute && (
                <div className="space-y-2">
                  <p className="text-gray-700">
                    Rota ativa: <span className="font-semibold">{truckData.currentRoute.name}</span>
                  </p>
                  <div className="bg-blue-50 p-3 rounded">
                    <p className="text-sm text-blue-800">
                      Pontos: {truckData.currentRoute.points.filter(p => p.completed).length} / {truckData.currentRoute.points.length} concluídos
                    </p>
                    <div className="mt-2 space-y-1">
                      {truckData.currentRoute.points.map((point, index) => (
                        <div key={point.id} className="text-xs flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${point.completed ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                          <span className={point.completed ? 'text-green-700' : 'text-gray-600'}>
                            {index + 1}. {point.address}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              
              <Button variant="destructive" className="w-full" onClick={handleLogout}>
                Sair
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <Input
                type="text"
                placeholder="Número da placa"
                value={plateNumber}
                onChange={(e) => setPlateNumber(e.target.value)}
                disabled={loading}
              />
              <Button className="w-full" onClick={handleLogin} disabled={loading}>
                {loading ? 'Carregando...' : 'Entrar'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MobileDriver;
