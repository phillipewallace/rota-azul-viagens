
import React, { useState } from 'react';
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { toast } from 'sonner';

interface TruckData {
  id: string;
  name: string;
  plate: string;
  model: string;
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
      const response = await fetch(`http://localhost:3001/api/mobile/truck/${plateNumber}`);
      
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-20 left-10 w-32 h-32 bg-blue-400 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-24 h-24 bg-indigo-400 rounded-full blur-2xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 right-1/4 w-16 h-16 bg-cyan-400 rounded-full blur-xl animate-pulse delay-500"></div>
        <div className="absolute bottom-1/3 left-1/3 w-20 h-20 bg-purple-400 rounded-full blur-2xl animate-pulse delay-700"></div>
        
        {/* Additional background elements for full coverage */}
        <div className="absolute top-10 right-1/3 w-28 h-28 bg-violet-400 rounded-full blur-3xl animate-pulse delay-300"></div>
        <div className="absolute bottom-10 left-1/4 w-36 h-36 bg-sky-400 rounded-full blur-3xl animate-pulse delay-900"></div>
        <div className="absolute top-1/3 left-10 w-20 h-20 bg-teal-400 rounded-full blur-2xl animate-pulse delay-600"></div>
        <div className="absolute bottom-1/2 right-20 w-24 h-24 bg-indigo-300 rounded-full blur-xl animate-pulse delay-1200"></div>
      </div>

      <Card className="w-full max-w-md shadow-2xl backdrop-blur-sm bg-white/95 border-0 rounded-3xl overflow-hidden relative z-10">
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
