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

  const optimizeRoute = async (
    allPoints: RoutePoint[],
    routeId?: string,
    useIntelligent: boolean = true
  ) => {
    const startTime = Date.now();
    try {
      console.log('🎯🎯🎯 [USE ROUTES] ========================================');
      console.log(`🎯 [USE ROUTES] INICIANDO OTIMIZAÇÃO ${useIntelligent ? 'INTELIGENTE' : 'TRADICIONAL'}`);
      console.log(`🎯 [USE ROUTES] Route ID: ${routeId || 'NOVA ROTA'}`);
      console.log(`🎯 [USE ROUTES] Pontos para otimizar: ${allPoints.length}`);
      console.log(`🎯 [USE ROUTES] Timestamp: ${new Date().toISOString()}`);

      if (!allPoints || allPoints.length < 2) {
        throw new Error('É necessário pelo menos 2 pontos para criar uma rota');
      }

      if (allPoints.length > 25) {
        console.log(`🔢 [USE ROUTES] ROTA EXTENSA DETECTADA (${allPoints.length} pontos)`);
        console.log(`📦 [USE ROUTES] Será processada em lotes de até 23 pontos`);
      }

      const isValidUUID = (id: string) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

      if (useIntelligent && routeId && typeof routeId === 'string' && isValidUUID(routeId)) {
        console.log('🧠 [USE ROUTES] EXECUTANDO: Otimização Inteligente');
        console.log(`🧠 [USE ROUTES] Endpoint: ${API_CONFIG.BASE_URL}/routes/${routeId}/optimize-intelligent`);

        try {
          const response = await fetch(`${API_CONFIG.BASE_URL}/routes/${routeId}/optimize-intelligent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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

          console.log(`🌐 [USE ROUTES] Resposta do servidor: ${response.status} ${response.statusText}`);

          if (response.ok) {
            const intelligentData = await response.json();
            const processingTime = Date.now() - startTime;

            console.log(`✅✅✅ [USE ROUTES] SUCESSO INTELLIGENT:`);
            console.log(`   - Pontos na resposta: ${intelligentData.optimizedOrder?.length || 0}`);
            console.log(`   - Pontos preservados: ${intelligentData.preservedPoints || 0}`);
            console.log(`   - Pontos otimizados: ${intelligentData.optimizedPoints || 0}`);
            console.log(`   - Processamento em lotes: ${intelligentData.isExtended ? 'SIM' : 'NÃO'}`);
            console.log(`   - Tempo total: ${processingTime}ms`);
            
            if (intelligentData.isExtended) {
              console.log(`📦 [USE ROUTES] Lotes processados: ${intelligentData.batchCount}`);
            }

            console.log('🎯🎯🎯 [USE ROUTES] ========================================');

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
              isExtended: intelligentData.isExtended,
              batchCount: intelligentData.batchCount,
            };
          } else {
            const errorText = await response.text();
            console.log(`❌ [USE ROUTES] Intelligent falhou com status: ${response.status}`);
            console.log(`❌ [USE ROUTES] Erro da API: ${errorText}`);
            throw new Error(`Erro ${response.status}: ${errorText}`);
          }
        } catch (intelligentError) {
          console.error('❌❌❌ [USE ROUTES] Erro na chamada Intelligent:');
          console.error(`   - Erro: ${intelligentError.message}`);
          console.error(`   - Tipo: ${intelligentError.name}`);
          throw intelligentError;
        }
      } else {
        if (useIntelligent) {
          console.log('⚠️ [USE ROUTES] routeId inválido ou não fornecido, usando otimização tradicional');
        }
      }

      // Fallback tradicional
      console.log('🔄 [USE ROUTES] FALLBACK: Usando otimização tradicional');
      console.log(`🔄 [USE ROUTES] Endpoint: ${API_CONFIG.BASE_URL}/geocoding/optimize`);

      const response = await fetch(`${API_CONFIG.BASE_URL}/geocoding/optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      const processingTime = Date.now() - startTime;

      console.log(`✅ [USE ROUTES] GEOCODING FALLBACK CONCLUÍDO em ${processingTime}ms`);
      console.log('🎯🎯🎯 [USE ROUTES] ========================================');

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
        isExtended: false,
        batchCount: 1,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error('❌❌❌ [USE ROUTES] ERRO CRÍTICO NA OTIMIZAÇÃO:');
      console.error(`   - Erro: ${error.message}`);
      console.error(`   - Tempo até o erro: ${processingTime}ms`);
      console.error(`   - Stack: ${error.stack}`);
      console.log('🎯🎯🎯 [USE ROUTES] ========================================');
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
