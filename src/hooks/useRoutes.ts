import { useState, useEffect } from 'react';
import { routesService } from '@/services/routes';
import { API_CONFIG } from '@/services/config';

export interface RoutePoint {
  id: string;
  address: string;
  cep: string;
  lat: number;
  lng: number;
  order: number;
  type: 'origin' | 'destination' | 'waypoint';
  completed?: boolean;
  completedAt?: string | null;
}

export interface Route {
  id: string;
  name: string;
  description?: string;
  points: RoutePoint[];
  totalDistance: number;
  estimatedTime: string;
  optimizedOrder: string[];
  status: 'active' | 'inactive' | 'completed';
  createdAt: string;
  polyline?: string;
}

export const useRoutes = () => {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRoutes = async () => {
    try {
      setLoading(true);
      const data = await routesService.getRoutes();
      setRoutes(data);
    } catch (error) {
      console.error('Error loading routes:', error);
    } finally {
      setLoading(false);
    }
  };

  const getAddressByCep = async (cep: string) => {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/geocoding/cep/${cep}`);
      if (!response.ok) {
        throw new Error('Erro ao buscar endereço por CEP');
      }
      return await response.json();
    } catch (error) {
      console.error('Error getting address by CEP:', error);
      throw error;
    }
  };

  const checkRouteInUse = async (routeId?: string) => {
    if (!routeId) return false;
    
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/routes/${routeId}/check-usage`);
      if (response.ok) {
        const data = await response.json();
        return data.inUse || false;
      }
      return false;
    } catch (error) {
      console.error('Error checking route usage:', error);
      return false;
    }
  };

  const optimizeRoute = async (allPoints: RoutePoint[], routeId?: string) => {
    try {
      console.log('🎯 [USE ROUTES] ========================================');
      console.log('🎯 [USE ROUTES] INICIANDO OTIMIZAÇÃO PRIORITÁRIA INTELIGENTE');
      console.log(`🎯 [USE ROUTES] Route ID: ${routeId || 'NOVA ROTA'}`);
      console.log(`🎯 [USE ROUTES] Pontos para otimizar: ${allPoints.length}`);

      if (allPoints.length < 2) {
        throw new Error('É necessário pelo menos 2 pontos para criar uma rota');
      }

      // 🚫 BLOQUEIO ABSOLUTO DO GEOCODING DIRETO
      console.log('🛡️ [USE ROUTES] VERIFICAÇÃO OBRIGATÓRIA: Route ID existe?', !!routeId);

      // ✅ PASSO 1: SE TEMOS ROUTE ID -> VERIFICAR USO E TENTAR INTELLIGENT
      if (routeId) {
        console.log('🔍 [USE ROUTES] PASSO 1: Verificando uso da rota existente...');
        
        const isRouteInUse = await checkRouteInUse(routeId);
        console.log(`${isRouteInUse ? '🚛' : '🆓'} [USE ROUTES] Rota ${routeId} ${isRouteInUse ? 'EM USO' : 'LIVRE'}`);

        // ✅ TENTAR INTELLIGENT SEMPRE PRIMEIRO (independente do uso)
        console.log('🧠 [USE ROUTES] TENTATIVA OBRIGATÓRIA: Otimização Inteligente');
        
        try {
          const response = await fetch(`${API_CONFIG.BASE_URL}/routes/${routeId}/optimize-intelligent`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              points: allPoints.map((point, index) => ({
                id: point.id,
                address: point.address,
                cep: point.cep,
                lat: point.lat,
                lng: point.lng,
                order: index,
                type: point.type,
                completed: point.completed ?? false,
                completedAt: point.completedAt ?? null,
              })),
            }),
          });

          if (response.ok) {
            const intelligentData = await response.json();
            console.log(`✅ [USE ROUTES] SUCESSO INTELLIGENT: ${intelligentData.optimizedOrder?.length || 0} pontos`);
            console.log(`🛡️ [USE ROUTES] Pontos preservados: ${intelligentData.preservedPoints || 0}`);
            console.log(`🎯 [USE ROUTES] Pontos otimizados: ${intelligentData.optimizedPoints || 0}`);
            console.log('🎯 [USE ROUTES] ========================================');

            return {
              optimizedOrder: intelligentData.optimizedOrder,
              totalDistance: intelligentData.totalDistance,
              estimatedTime: intelligentData.estimatedTime,
              polyline: intelligentData.polyline,
              detailedRoute: null,
              points: intelligentData.points.map((p: any, index: number) => ({
                id: p.id,
                address: p.address,
                cep: p.cep || '',
                lat: p.lat,
                lng: p.lng,
                order: index,
                type: p.type,
                completed: p.completed ?? false,
                completedAt: p.completedAt ?? null,
              })),
            };
          } else {
            console.log('⚠️ [USE ROUTES] Intelligent falhou com status:', response.status);
            const errorText = await response.text();
            console.log('⚠️ [USE ROUTES] Erro da API:', errorText);
          }

        } catch (intelligentError) {
          console.error('❌ [USE ROUTES] Erro na chamada Intelligent:', intelligentError);
        }
      }

      // ✅ FALLBACK: GEOCODING TRADICIONAL (APENAS SE INTELLIGENT FALHOU)
      console.log('🔄 [USE ROUTES] FALLBACK: Usando otimização tradicional');
      
      const response = await fetch(`${API_CONFIG.BASE_URL}/geocoding/optimize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          points: allPoints.map((point, index) => ({
            id: point.id,
            address: point.address,
            cep: point.cep,
            lat: point.lat,
            lng: point.lng,
            order: index,
            type: point.type,
            completed: point.completed ?? false,
            completedAt: point.completedAt ?? null,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('Erro na otimização tradicional da rota');
      }

      const optimizedData = await response.json();
      console.log(`✅ [USE ROUTES] GEOCODING FALLBACK CONCLUÍDO`);
      console.log('🎯 [USE ROUTES] ========================================');

      return {
        optimizedOrder: optimizedData.optimizedOrder,
        totalDistance: optimizedData.totalDistance,
        estimatedTime: optimizedData.estimatedTime,
        polyline: optimizedData.polyline,
        detailedRoute: null,
        points: optimizedData.points.map((p: any, index: number) => ({
          id: p.id,
          address: p.address,
          cep: p.cep || '',
          lat: p.lat,
          lng: p.lng,
          order: index,
          type: p.type,
          completed: p.completed ?? false,
          completedAt: p.completedAt ?? null,
        })),
      };

    } catch (error) {
      console.error('❌ [USE ROUTES] ERRO CRÍTICO NA OTIMIZAÇÃO:', error);
      console.log('🎯 [USE ROUTES] ========================================');
      throw error;
    }
  };

  const createRoute = async (routeData: Omit<Route, 'id' | 'createdAt'>) => {
    try {
      const newRoute = await routesService.createRoute(routeData);
      await loadRoutes();
      return newRoute;
    } catch (error) {
      console.error('Error creating route:', error);
      throw error;
    }
  };

  const updateRoute = async (id: string, routeData: Partial<Route>) => {
    try {
      const updatedRoute = await routesService.updateRoute(id, routeData);
      await loadRoutes();
      return updatedRoute;
    } catch (error) {
      console.error('Error updating route:', error);
      throw error;
    }
  };

  const deleteRoute = async (id: string) => {
    try {
      await routesService.deleteRoute(id);
      await loadRoutes();
    } catch (error) {
      console.error('Error deleting route:', error);
      throw error;
    }
  };

  useEffect(() => {
    loadRoutes();
  }, []);

  return {
    routes,
    loading,
    loadRoutes,
    getAddressByCep,
    optimizeRoute,
    createRoute,
    updateRoute,
    deleteRoute
  };
};
