
import React, { useState, useEffect } from 'react';
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { toast } from 'sonner';
import { useMobile, type TruckMobileData } from '../hooks/useMobile';
import { Truck, User, Route, LogOut, MapPin, Navigation } from 'lucide-react';

const MobileDriver = () => {
  const [plateNumber, setPlateNumber] = useState('');
  const [truckData, setTruckData] = useState<TruckMobileData | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { getTruckByPlate } = useMobile();

  // Check if already logged in on component mount
  useEffect(() => {
    const savedTruckData = localStorage.getItem('mobile-truck-data');
    if (savedTruckData) {
      try {
        const parsedData = JSON.parse(savedTruckData);
        setTruckData(parsedData);
        setIsLoggedIn(true);
        setPlateNumber(parsedData.plate);
        updateActiveTrackingInStorage(parsedData.id, true);
      } catch (error) {
        console.error('❌ [MOBILE] Erro ao recuperar dados salvos:', error);
        localStorage.removeItem('mobile-truck-data');
      }
    }
  }, []);

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
      
      // Salvar dados localmente
      localStorage.setItem('mobile-truck-data', JSON.stringify(data));
      
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
    
    // Limpar dados salvos
    localStorage.removeItem('mobile-truck-data');
    
    setIsLoggedIn(false);
    setTruckData(null);
    setPlateNumber('');
    setError(null);
    toast.success('Logout realizado com sucesso');
    console.log('👋 [MOBILE] Truck logout');
  };

  const formatPlate = (value: string) => {
    // Remove caracteres não alfanuméricos
    const cleaned = value.replace(/[^A-Z0-9]/g, '');
    
    // Aplica formatação ABC-1234
    if (cleaned.length <= 3) {
      return cleaned;
    } else if (cleaned.length <= 7) {
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
    } else {
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}`;
    }
  };

  const handlePlateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPlate(e.target.value.toUpperCase());
    setPlateNumber(formatted);
  };

  const openGoogleMaps = (lat: number, lng: number, address: string) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${encodeURIComponent(address)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header with Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-3xl shadow-lg mb-4">
            <Truck className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            AlchemyRouter
          </h1>
          <p className="text-gray-600 mt-2">
            {isLoggedIn ? 'Painel do Motorista' : 'Sistema de Rastreamento'}
          </p>
        </div>

        <Card className="backdrop-blur-sm bg-white/80 border-0 shadow-xl">
          <CardContent className="p-8">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span className="text-sm font-medium">{error}</span>
              </div>
            )}

            {isLoggedIn ? (
              <div className="space-y-6">
                {/* Truck Info */}
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-6 border border-green-100">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                      <Truck className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-green-800 text-lg">{truckData?.name}</h3>
                      <p className="text-green-600 text-sm font-medium">Placa: {truckData?.plate}</p>
                    </div>
                  </div>
                  
                  {truckData?.driver && (
                    <div className="flex items-center gap-2 text-green-700 mb-2">
                      <User className="w-4 h-4" />
                      <span className="text-sm font-medium">{truckData.driver}</span>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2 text-green-700">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium">Sistema Ativo</span>
                  </div>
                </div>

                {/* Current Route */}
                {truckData?.currentRoute && (
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                        <Route className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="font-bold text-blue-800">Rota Atual</h4>
                        <p className="text-blue-600 text-sm">{truckData.currentRoute.name}</p>
                      </div>
                    </div>
                    
                    {truckData.currentRoute.description && (
                      <p className="text-blue-700 text-sm bg-blue-100/50 rounded-lg p-3 mt-3">
                        {truckData.currentRoute.description}
                      </p>
                    )}
                    
                    {truckData.currentRoute.points && truckData.currentRoute.points.length > 0 && (
                      <div className="mt-4">
                        <div className="flex items-center gap-2 text-blue-700 mb-2">
                          <MapPin className="w-4 h-4" />
                          <span className="text-sm font-medium">
                            {truckData.currentRoute.points.filter(p => p.completed).length} de {truckData.currentRoute.points.length} pontos concluídos
                          </span>
                        </div>
                        <div className="w-full bg-blue-200 rounded-full h-2 mb-4">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ 
                              width: `${(truckData.currentRoute.points.filter(p => p.completed).length / truckData.currentRoute.points.length) * 100}%` 
                            }}
                          ></div>
                        </div>

                        {/* Route Points */}
                        <div className="space-y-3">
                          {truckData.currentRoute.points
                            .sort((a, b) => a.order - b.order)
                            .map((point, index) => (
                              <div 
                                key={point.id} 
                                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                                  point.completed 
                                    ? 'bg-green-50 border-green-200' 
                                    : index === truckData.currentRoute!.points.filter(p => p.completed).length
                                      ? 'bg-yellow-50 border-yellow-200'
                                      : 'bg-gray-50 border-gray-200'
                                }`}
                              >
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                                  point.completed 
                                    ? 'bg-green-100 text-green-700' 
                                    : index === truckData.currentRoute!.points.filter(p => p.completed).length
                                      ? 'bg-yellow-100 text-yellow-700'
                                      : 'bg-gray-100 text-gray-500'
                                }`}>
                                  {point.order}
                                </div>
                                
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm font-medium truncate ${
                                    point.completed ? 'text-green-800' : 'text-gray-700'
                                  }`}>
                                    {point.address}
                                  </p>
                                  <p className={`text-xs ${
                                    point.completed ? 'text-green-600' : 'text-gray-500'
                                  }`}>
                                    {point.type === 'origin' ? 'Origem' : 
                                     point.type === 'destination' ? 'Destino' : 'Parada'}
                                  </p>
                                </div>

                                {point.lat && point.lng && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openGoogleMaps(point.lat, point.lng, point.address)}
                                    className="shrink-0 h-8 w-8 p-0"
                                  >
                                    <Navigation className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Logout Button */}
                <Button 
                  variant="destructive" 
                  className="w-full h-12 rounded-xl font-semibold bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 border-0 shadow-lg"
                  onClick={handleLogout}
                >
                  <LogOut className="w-5 h-5 mr-2" />
                  Sair do Sistema
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <label htmlFor="plate" className="block text-sm font-semibold text-gray-700 mb-3">
                    Número da Placa do Caminhão
                  </label>
                  <Input
                    id="plate"
                    type="text"
                    placeholder="ABC-1234"
                    value={plateNumber}
                    onChange={handlePlateChange}
                    disabled={loading}
                    className="h-14 text-center font-mono text-lg bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:bg-white transition-all duration-200"
                    maxLength={8}
                  />
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    Digite a placa no formato ABC-1234
                  </p>
                </div>
                
                <Button 
                  className="w-full h-14 rounded-xl font-bold text-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 border-0 shadow-lg transition-all duration-200 transform hover:scale-[1.02]"
                  onClick={handleLogin} 
                  disabled={loading || !plateNumber.trim()}
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Conectando...
                    </div>
                  ) : (
                    <>
                      <Truck className="w-5 h-5 mr-2" />
                      Entrar no Sistema
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-xs text-gray-500">
            © 2024 AlchemyRouter - Sistema de Rastreamento
          </p>
        </div>
      </div>
    </div>
  );
};

export default MobileDriver;
