
import { useState, useEffect } from 'react';
import { routesService } from '@/services/routes';
import { API_CONFIG } from '@/services/config';

export interface RoutePoint {
  id: string;
  address: string;
  cep?: string; // ✅ OPCIONAL - apenas para geocoding
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
      console.log('🔄 [USE ROUTES] ===== CARREGANDO ROTAS DO BACKEND =====');
      setLoading(true);
      
      // ✅ AGUARDAR UM MOMENTO PARA GARANTIR DADOS FRESCOS
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const data = await routesService.getRoutes();
      
      console.log('✅ [USE ROUTES] Rotas carregadas do servidor:', {
        count: data?.length || 0,
        routes: data?.map(r => ({ 
          id: r.id.substring(0, 8) + '...', 
          name: r.name, 
          pointsCount: r.points?.length || 0,
          completedPoints: r.points?.filter(p => p.completed).length || 0
        }))
      });
      
      // ✅ GARANTIR QUE OS DADOS SEJAM VÁLIDOS E CONSISTENTES
      const validatedRoutes = (data || []).map(route => ({
        ...route,
        points: (route.points || []).map((point, index) => ({
          ...point,
          order: point.order ?? index,
          completed: point.completed ?? false,
          completedAt: point.completedAt ?? null,
        }))
      }));
      
      console.log('✅ [USE ROUTES] Dados validados e prontos:', {
        count: validatedRoutes.length,
        detailedRoutes: validatedRoutes.map(r => ({
          id: r.id.substring(0, 8) + '...',
          name: r.name,
          pointsCount: r.points?.length || 0,
          completedPoints: r.points?.filter(p => p.completed).length || 0,
          totalDistance: r.totalDistance,
          estimatedTime: r.estimatedTime
        }))
      });
      
      setRoutes(validatedRoutes);
      return validatedRoutes;
      
    } catch (error) {
      console.error('❌ [USE ROUTES] Erro ao carregar rotas:', error);
      setRoutes([]);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const getAddressByCep = async (cep: string) => {
    const maxRetries = 3;
    let lastError: any;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔍 [CEP] Tentativa ${attempt}/${maxRetries} para CEP: ${cep}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);
        
        const response = await fetch(`${API_CONFIG.BASE_URL}/geocoding/cep/${cep}`, {
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log(`✅ [CEP] Sucesso na tentativa ${attempt}`);
        return result;
        
      } catch (error) {
        lastError = error;
        console.log(`⚠️ [CEP] Tentativa ${attempt} falhou: ${error.message}`);
        
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, attempt * 1000));
        }
      }
    }
    
    console.error(`❌ [CEP] Todas as tentativas falharam para ${cep}`);
    throw lastError;
  };

  const optimizeRoute = async (
    allPoints: RoutePoint[],
    routeId?: string,
    useIntelligent: boolean = true
  ) => {
    const startTime = Date.now();
    const TIMEOUT_MS = 60000;
    
    try {
      console.log(`🎯 [OPTIMIZE] ===== INICIANDO OTIMIZAÇÃO =====`);
      console.log(`🎯 [OPTIMIZE] Tipo: ${useIntelligent ? 'INTELIGENTE' : 'TRADICIONAL'}`);
      console.log(`🎯 [OPTIMIZE] Route ID: ${routeId || 'NOVA ROTA'}`);
      console.log(`🎯 [OPTIMIZE] Pontos: ${allPoints.length}`);

      if (!allPoints || allPoints.length < 2) {
        throw new Error('É necessário pelo menos 2 pontos para criar uma rota');
      }

      const isValidUUID = (id: string) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

      // ✅ TENTAR OTIMIZAÇÃO INTELIGENTE SE POSSÍVEL
      if (useIntelligent && routeId && isValidUUID(routeId)) {
        const maxRetries = 2;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            console.log(`🧠 [OPTIMIZE] Tentativa ${attempt}/${maxRetries} - Otimização Inteligente`);
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
            
            const intelligentUrl = `${API_CONFIG.BASE_URL}/routes/${routeId}/optimize-intelligent`;
            console.log(`🧠 [OPTIMIZE] Endpoint: ${intelligentUrl}`);
            
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
            
            if (response.ok) {
              const intelligentData = await response.json();
              const processingTime = Date.now() - startTime;

              console.log(`✅ [OPTIMIZE] Inteligente concluída em ${processingTime}ms`);
              
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
              throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
          } catch (error) {
            console.log(`⚠️ [OPTIMIZE] Tentativa ${attempt} falhou: ${error.message}`);
            
            if (attempt < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          }
        }
        
        console.log(`⚠️ [OPTIMIZE] Inteligente falhou, usando fallback tradicional`);
      }

      // ✅ FALLBACK PARA OTIMIZAÇÃO TRADICIONAL
      console.log(`🔄 [OPTIMIZE] Executando otimização tradicional`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const traditionalUrl = `${API_CONFIG.BASE_URL}/geocoding/optimize`;
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

      console.log(`✅ [OPTIMIZE] Tradicional concluída em ${processingTime}ms`);

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
      
      console.error(`❌ [OPTIMIZE] Erro crítico após ${processingTime}ms:`, error.message);
      throw error;
    }
  };

  const createRoute = async (routeData: Omit<Route, 'id' | 'createdAt'>) => {
    try {
      console.log('➕ [USE ROUTES] ===== CRIANDO ROTA =====');
      console.log('➕ [USE ROUTES] Dados da rota:', {
        name: routeData.name,
        pointsCount: routeData.points?.length || 0,
        completedPoints: routeData.points?.filter(p => p.completed).length || 0
      });
      
      const newRoute = await routesService.createRoute(routeData);
      
      console.log('✅ [USE ROUTES] Rota criada com sucesso:', {
        id: newRoute.id.substring(0, 8) + '...',
        name: newRoute.name,
        pointsCount: newRoute.points?.length || 0
      });
      
      // ✅ AGUARDAR E RECARREGAR DADOS APÓS CRIAR
      await new Promise(resolve => setTimeout(resolve, 300));
      await loadRoutes();
      
      return newRoute;
    } catch (error) {
      console.error('❌ [USE ROUTES] Erro ao criar rota:', error);
      throw error;
    }
  };

  const updateRoute = async (id: string, routeData: Partial<Route>) => {
    try {
      console.log('📝 [USE ROUTES] ===== ATUALIZANDO ROTA =====');
      console.log('📝 [USE ROUTES] ID da rota:', id.substring(0, 8) + '...');
      console.log('📝 [USE ROUTES] Dados de atualização:', {
        name: routeData.name,
        pointsCount: routeData.points?.length || 0,
        completedPoints: routeData.points?.filter(p => p.completed).length || 0,
        totalDistance: routeData.totalDistance,
        estimatedTime: routeData.estimatedTime
      });
      
      const updatedRoute = await routesService.updateRoute(id, routeData);
      
      console.log('✅ [USE ROUTES] Rota atualizada com sucesso:', {
        id: updatedRoute.id.substring(0, 8) + '...',
        name: updatedRoute.name,
        pointsCount: updatedRoute.points?.length || 0,
        completedPoints: updatedRoute.points?.filter(p => p.completed).length || 0
      });
      
      // ✅ AGUARDAR E RECARREGAR DADOS APÓS ATUALIZAR
      await new Promise(resolve => setTimeout(resolve, 300));
      await loadRoutes();
      
      return updatedRoute;
    } catch (error) {
      console.error('❌ [USE ROUTES] Erro ao atualizar rota:', error);
      throw error;
    }
  };

  const deleteRoute = async (id: string) => {
    try {
      console.log('🗑️ [USE ROUTES] Excluindo rota:', id.substring(0, 8) + '...');
      await routesService.deleteRoute(id);
      
      // ✅ RECARREGAR DADOS APÓS EXCLUIR
      await loadRoutes();
    } catch (error) {
      console.error('❌ [USE ROUTES] Erro ao excluir rota:', error);
      throw error;
    }
  };

  // ✅ CARREGAR DADOS INICIAIS
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
