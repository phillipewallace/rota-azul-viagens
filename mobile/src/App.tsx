
import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Truck, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { useMobile, TruckMobileData } from '@/hooks/useMobile';
import MobileRoute from '@/pages/MobileRoute';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30000,
    },
  },
});

const MobileApp = () => {
  const [plateNumber, setPlateNumber] = useState('');
  const [truckData, setTruckData] = useState<TruckMobileData | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getTruckByPlate } = useMobile();

  // Verificar se já está logado ao carregar o app
  useEffect(() => {
    const savedTruckData = localStorage.getItem('mobile-truck-data');
    if (savedTruckData) {
      try {
        const data = JSON.parse(savedTruckData);
        setTruckData(data);
        setIsLoggedIn(true);
        setPlateNumber(data.plate);
        console.log('📱 Dados do caminhão restaurados do localStorage');
      } catch (err) {
        console.error('Erro ao restaurar dados do localStorage:', err);
        localStorage.removeItem('mobile-truck-data');
      }
    }
  }, []);

  const handleLogin = async () => {
    if (!plateNumber.trim()) {
      setError('Por favor, insira o número da placa');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('🔍 [MOBILE] Fazendo login com placa:', plateNumber);
      
      const data = await getTruckByPlate(plateNumber.trim().toUpperCase());
      
      setTruckData(data);
      setIsLoggedIn(true);
      
      // Salvar no localStorage para persistir o login
      localStorage.setItem('mobile-truck-data', JSON.stringify(data));
      
      toast.success(`Bem-vindo, ${data.name}!`);
      console.log('🚛 Login realizado com sucesso:', data.name);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao fazer login';
      setError(errorMessage);
      console.error('❌ Erro no login:', err);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setTruckData(null);
    setPlateNumber('');
    setError(null);
    localStorage.removeItem('mobile-truck-data');
    toast.success('Logout realizado com sucesso');
    console.log('👋 Logout realizado');
  };

  const handleFinishRoute = () => {
    // Após finalizar a rota, pode fazer logout ou voltar para tela inicial
    handleLogout();
  };

  if (isLoggedIn && truckData) {
    return <MobileRoute truckData={truckData} onFinishRoute={handleFinishRoute} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-6">
          <div className="text-center mb-6">
            <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Truck className="h-8 w-8 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Rota Azul Viagens
            </h1>
            <p className="text-gray-600">
              Aplicativo do Motorista
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
              <strong className="font-medium">Erro:</strong>
              <p className="text-sm mt-1">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="plate" className="block text-sm font-medium text-gray-700 mb-2">
                Placa do Caminhão
              </label>
              <Input
                id="plate"
                type="text"
                placeholder="Ex: ABC-1234"
                value={plateNumber}
                onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
                disabled={loading}
                className="text-center font-mono"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleLogin();
                  }
                }}
              />
            </div>
            
            <Button 
              onClick={handleLogin} 
              disabled={loading || !plateNumber.trim()}
              className="w-full"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Carregando...
                </>
              ) : (
                <>
                  <MapPin className="h-4 w-4 mr-2" />
                  Entrar
                </>
              )}
            </Button>
          </div>

          <div className="mt-6 text-center text-xs text-gray-500">
            <p>Digite a placa do seu caminhão para acessar</p>
            <p>as rotas e iniciar as entregas</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MobileApp />
      <Toaster position="top-center" />
    </QueryClientProvider>
  );
}

export default App;
