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

  // ✅ ATUALIZADO: Otimização com suporte melhorado para blocos
  const optimizeRoute = async (allPoints: RoutePoint[], routeId?: string) => {
    try {
      console.log('🎯 [USE ROUTES] ========================================');
      console.log('🎯 [USE ROUTES] Iniciando otimização inteligente por blocos');
      console.log(`🎯 [USE ROUTES] Route ID: ${routeId || 'NOVA ROTA'}`);
      console.log(`🎯 [USE ROUTES] Pontos para otimizar: ${allPoints.length}`);

      if (allPoints.length < 2) {
        throw new Error('É necessário pelo menos 2 pontos para criar uma rota');
      }

      let optimizationResult = null;

      // ✅ TENTATIVA 1: Otimização inteligente por blocos (SOMENTE se existe routeId válido)
      if (routeId && routeId !== 'NOVA ROTA') {
        console.log('🧠 [USE ROUTES] Tentando otimização inteligente por blocos...');
        
        try {
          const intelligentResult = await routesService.optimizeRouteIntelligent(routeId, allPoints);
          
          console.log('✅ [USE ROUTES] Otimização inteligente por blocos bem-sucedida');
          console.log(`📊 [USE ROUTES] ${intelligentResult.blocksProcessed} blocos processados`);
          console.log(`📊 [USE ROUTES] ${intelligentResult.preservedPoints} pontos preservados`);
          console.log(`📊 [USE ROUTES] ${intelligentResult.optimizedPoints} pontos otimizados`);
          
          optimizationResult = {
            optimizedOrder: intelligentResult.optimizedOrder,
            totalDistance: intelligentResult.totalDistance,
            estimatedTime: intelligentResult.estimatedTime,
            polyline: '', // Polyline será calculada pelo backend
            points: intelligentResult.points.map((p: any, index: number) => ({
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
            blocksProcessed: intelligentResult.blocksProcessed,
            preservedPoints: intelligentResult.preservedPoints,
            optimizedPoints: intelligentResult.optimizedPoints
          };

        } catch (error) {
          console.log('⚠️ [USE ROUTES] Erro na otimização inteligente por blocos:', error);
          
          // Verificar se deve usar fallback tradicional
          if (error instanceof Error && error.message.includes('useTraditional')) {
            console.log('🔄 [USE ROUTES] Backend solicitou usar otimização tradicional');
          }
        }
      } else {
        console.log('🆕 [USE ROUTES] Nova rota - pulando otimização inteligente');
      }

      // ✅ FALLBACK: Agora também usa otimização por blocos
      if (!optimizationResult) {
        console.log('🔄 [USE ROUTES] Usando fallback (agora com suporte a blocos)');
        console.log(`🔄 [USE ROUTES] URL: ${API_CONFIG.BASE_URL}/geocoding/optimize`);
        
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
          const errorText = await response.text();
          console.error('❌ [USE ROUTES] Erro no fallback:', errorText);
          throw new Error('Erro na otimização da rota');
        }

        const optimizedData = await response.json();
        console.log('✅ [USE ROUTES] Fallback concluído');
        console.log('📊 [USE ROUTES] Dados recebidos:', optimizedData);
        
        // ✅ NOVO: Detectar se o fallback usou blocos
        if (optimizedData.blocksProcessed > 1) {
          console.log(`🧩 [USE ROUTES] Fallback usou ${optimizedData.blocksProcessed} blocos`);
          console.log(`📊 [USE ROUTES] ${optimizedData.preservedPoints} pontos preservados`);
          console.log(`📊 [USE ROUTES] ${optimizedData.optimizedPoints} pontos otimizados`);
        }
        
        optimizationResult = {
          optimizedOrder: optimizedData.optimizedOrder,
          totalDistance: optimizedData.totalDistance,
          estimatedTime: optimizedData.estimatedTime,
          polyline: optimizedData.polyline,
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
          blocksProcessed: optimizedData.blocksProcessed || 1,
          preservedPoints: optimizedData.preservedPoints || 0,
          optimizedPoints: optimizedData.optimizedPoints || optimizedData.points.length
        };
      }

      console.log('✅ [USE ROUTES] Otimização concluída com sucesso');
      console.log(`📊 [USE ROUTES] ${optimizationResult.points.length} pontos otimizados`);
      console.log(`📊 [USE ROUTES] Distância total: ${optimizationResult.totalDistance.toFixed(1)}km`);
      console.log(`📊 [USE ROUTES] Tempo estimado: ${optimizationResult.estimatedTime}`);
      
      // ✅ NOVO: Log sobre blocos processados
      if (optimizationResult.blocksProcessed > 1) {
        console.log(`🧩 [USE ROUTES] ${optimizationResult.blocksProcessed} blocos processados`);
        console.log(`📊 [USE ROUTES] ${optimizationResult.preservedPoints} pontos preservados`);
        console.log(`📊 [USE ROUTES] ${optimizationResult.optimizedPoints} pontos otimizados`);
      }
      
      console.log('🎯 [USE ROUTES] ========================================');
      
      return optimizationResult;

    } catch (error) {
      console.error('❌ [USE ROUTES] Erro na otimização:', error);
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
