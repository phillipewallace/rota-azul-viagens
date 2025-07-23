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

  const optimizeRoute = async (
    allPoints: RoutePoint[],
    routeId?: string,
    useIntelligent: boolean = true
  ) => {
    const startTime = Date.now();
    const TIMEOUT_MS = 45000; // 45 segundos para otimização
    
    try {
      console.log('🎯🎯🎯 [USE ROUTES] ========================================');
      console.log(`🎯 [USE ROUTES] INICIANDO OTIMIZAÇÃO ${useIntelligent ? 'INTELIGENTE' : 'TRADICIONAL'}`);
      console.log(`🎯 [USE ROUTES] Route ID: ${routeId || 'NOVA ROTA'}`);
      console.log(`🎯 [USE ROUTES] Pontos para otimizar: ${allPoints.length}`);
      console.log(`🎯 [USE ROUTES] API Base URL: ${API_CONFIG.BASE_URL}`);
      console.log(`🎯 [USE ROUTES] Timestamp: ${new Date().toISOString()}`);

      if (!allPoints || allPoints.length < 2) {
        throw new Error('É necessário pelo menos 2 pontos para criar uma rota');
      }

      // ✅ VALIDAÇÃO DE UUID MELHORADA
      const isValidUUID = (id: string) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

      // ✅ OTIMIZAÇÃO INTELIGENTE COM VALIDAÇÕES ROBUSTAS
      if (useIntelligent && routeId && typeof routeId === 'string' && isValidUUID(routeId)) {
        console.log('🧠 [USE ROUTES] EXECUTANDO: Otimização Inteligente');
        const intelligentUrl = `${API_CONFIG.BASE_URL}/routes/${routeId}/optimize-intelligent`;
        console.log(`🧠 [USE ROUTES] Endpoint: ${intelligentUrl}`);

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
          
          const response = await fetch(intelligentUrl, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Accept': 'application/json'
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
            signal: controller.signal
          });

          clearTimeout(timeoutId);
          console.log(`🌐 [USE ROUTES] Resposta do servidor: ${response.status} ${response.statusText}`);
          console.log(`🌐 [USE ROUTES] Response headers:`, Object.fromEntries(response.headers.entries()));

          if (response.ok) {
            const intelligentData = await response.json();
            const processingTime = Date.now() - startTime;

            console.log(`✅✅✅ [USE ROUTES] SUCESSO INTELLIGENT:`);
            console.log(`   📊 Pontos na resposta: ${intelligentData.optimizedOrder?.length || 0}`);
            console.log(`   📊 Pontos preservados: ${intelligentData.preservedPoints || 0}`);
            console.log(`   📊 Pontos otimizados: ${intelligentData.optimizedPoints || 0}`);
            console.log(`   📊 Distância: ${intelligentData.totalDistance}km`);
            console.log(`   📊 Tempo estimado: ${intelligentData.estimatedTime}`);
            console.log(`   📊 Tempo total de processamento: ${processingTime}ms`);
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
          if (intelligentError.name === 'AbortError') {
            console.error('❌❌❌ [USE ROUTES] Timeout na otimização inteligente');
            throw new Error('Timeout na otimização inteligente. Tente novamente.');
          }
          
          console.error('❌❌❌ [USE ROUTES] Erro na chamada Intelligent:');
          console.error(`   💥 Erro: ${intelligentError.message}`);
          console.error(`   💥 Tipo: ${intelligentError.name}`);
          throw intelligentError;
        }
      } else {
        if (useIntelligent) {
          console.log('⚠️ [USE ROUTES] routeId inválido ou não fornecido, usando otimização tradicional');
        }
      }

      // ✅ FALLBACK TRADICIONAL COM MELHORIAS
      console.log('🔄 [USE ROUTES] FALLBACK: Usando otimização tradicional');
      const traditionalUrl = `${API_CONFIG.BASE_URL}/geocoding/optimize`;
      console.log(`🔄 [USE ROUTES] Endpoint: ${traditionalUrl}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const response = await fetch(traditionalUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
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
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro na otimização tradicional: ${errorText}`);
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
      
      if (error.name === 'AbortError') {
        console.error('❌❌❌ [USE ROUTES] TIMEOUT NA OTIMIZAÇÃO:');
        console.error(`   ⏱️ Tempo até o timeout: ${processingTime}ms`);
        console.log('🎯🎯🎯 [USE ROUTES] ========================================');
        throw new Error('Tempo limite excedido. A otimização está demorando muito.');
      }
      
      console.error('❌❌❌ [USE ROUTES] ERRO CRÍTICO NA OTIMIZAÇÃO:');
      console.error(`   💥 Erro: ${error.message}`);
      console.error(`   ⏱️ Tempo até o erro: ${processingTime}ms`);
      console.error(`   📋 Stack: ${error.stack}`);
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
