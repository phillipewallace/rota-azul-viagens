import React, { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from 'sonner';
import { useMobile } from '@/hooks/useMobile';

const MobileDriver = () => {
  const { truckData, getTruckByPlate, clearTruckData } = useMobile();
  const [plateNumber, setPlateNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ✅ DERIVAR ESTADO DE LOGIN DOS DADOS PERSISTIDOS
  const isLoggedIn = !!truckData;

  // ✅ RECUPERAR PLACA SALVA AO INICIALIZAR
  useEffect(() => {
    if (truckData?.plate) {
      setPlateNumber(truckData.plate);
    }
  }, [truckData]);

  const handleLogin = async () => {
    if (!plateNumber.trim()) {
      setError('Por favor, insira o número da placa');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('🔍 [MOBILE] Fazendo login com placa:', plateNumber);
      
      await getTruckByPlate(plateNumber);
      
      toast.success(`Bem-vindo, ${truckData?.name || 'Motorista'}!`);
      console.log('🚛 Truck login successful');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao fazer login';
      setError(errorMessage);
      console.error('❌ Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    clearTruckData();
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
                <div className="bg-blue-50 p-3 rounded">
                  <p className="text-sm text-blue-700">
                    <strong>Rota Ativa:</strong> {truckData.currentRoute.name}
                  </p>
                  <p className="text-sm text-blue-600">
                    {truckData.currentRoute.points?.filter(p => p.completed).length || 0} de {truckData.currentRoute.points?.length || 0} pontos concluídos
                  </p>
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
