
import { useState, useEffect } from 'react';
import { routesService } from '@/services/routes';
import { API_CONFIG } from '@/services/config';

export interface RoutePoint {
  id: string;
  address: string;
  cep?: string;
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
      console.log('🔄 [USE ROUTES] Iniciando carregamento de rotas');
      setLoading(true);
      
      const data = await routesService.getRoutes();
      
      console.log('✅ [USE ROUTES] Resposta bruta do backend:', {
        type: typeof data,
        isArray: Array.isArray(data),
        length: Array.isArray(data) ? data.length : 'N/A'
      });
      
      if (!Array.isArray(data)) {
        console.warn('⚠️ [USE ROUTES] Resposta não é um array:', data);
        setRoutes([]);
        return [];
      }
      
      // Validar e processar cada rota
      const validatedRoutes = data.map((route, index) => {
        if (!route?.id) {
          console.warn(`⚠️ [USE ROUTES] Rota ${index} inválida:`, route);
          return null;
        }

        // Processar pontos da rota
        const processedPoints = Array.isArray(route.points) ? route.points.map((point: any, pointIndex: number) => {
          const processedPoint = {
            id: point?.id || `point-${pointIndex}`,
            address: point?.address || 'Endereço não definido',
            cep: point?.cep || '',
            lat: typeof point?.lat === 'number' ? point.lat : 0,
            lng: typeof point?.lng === 'number' ? point.lng : 0,
            order: typeof point?.order === 'number' ? point.order : pointIndex,
            type: point?.type || 'waypoint',
            completed: Boolean(point?.completed),
            completedAt: point?.completedAt || null,
          };
          
          console.log(`📍 [USE ROUTES] Ponto ${pointIndex + 1} da rota ${route.name}:`, {
            id: processedPoint.id.substring(0, 8) + '...',
            address: processedPoint.address,
            completed: processedPoint.completed
          });
          
          return processedPoint;
        }) : [];

        const processedRoute = {
          id: route.id,
          name: route.name || 'Rota sem nome',
          description: route.description || '',
          points: processedPoints,
          totalDistance: typeof route.totalDistance === 'number' ? route.totalDistance : 0,
          estimatedTime: route.estimatedTime || '0min',
          optimizedOrder: Array.isArray(route.optimizedOrder) ? route.optimizedOrder : [],
          status: route.status || 'active',
          createdAt: route.createdAt || new Date().toISOString(),
          polyline: route.polyline || ''
        };

        console.log(`✅ [USE ROUTES] Rota processada: ${processedRoute.name}`, {
          id: processedRoute.id.substring(0, 8) + '...',
          pointsCount: processedRoute.points.length,
          completedPoints: processedRoute.points.filter(p => p.completed).length,
          totalDistance: processedRoute.totalDistance,
          estimatedTime: processedRoute.estimatedTime
        });

        return processedRoute;
      }).filter(route => route !== null);
      
      console.log('✅ [USE ROUTES] Total de rotas válidas:', validatedRoutes.length);
      
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
    if (!cep || cep.trim().length === 0) {
      throw new Error('CEP não pode estar vazio');
    }

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
      console.log(`🎯 [OPTIMIZE] Iniciando otimização ${useIntelligent ? 'INTELIGENTE' : 'TRADICIONAL'}`);
      console.log(`🎯 [OPTIMIZE] Route ID: ${routeId || 'NOVA ROTA'}`);
      console.log(`🎯 [OPTIMIZE] Pontos: ${Array.isArray(allPoints) ? allPoints.length : 0}`);

      if (!Array.isArray(allPoints) || allPoints.length < 2) {
        throw new Error('É necessário pelo menos 2 pontos para criar uma rota');
      }

      const validPoints = allPoints.filter(point => {
        return point && point.id && point.address && typeof point.lat === 'number' && typeof point.lng === 'number';
      });

      if (validPoints.length < 2) {
        throw new Error('É necessário pelo menos 2 pontos válidos para criar uma rota');
      }

      const isValidUUID = (id: string) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

      // Tentar otimização inteligente se possível
      if (useIntelligent && routeId && isValidUUID(routeId)) {
        const maxRetries = 2;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            console.log(`🧠 [OPTIMIZE] Tentativa ${attempt}/${maxRetries} - Otimização Inteligente`);
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
            
            const intelligentUrl = `${API_CONFIG.BASE_URL}/routes/${routeId}/optimize-intelligent`;
            
            const response = await fetch(intelligentUrl, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
              },
              body: JSON.stringify({
                points: validPoints.map((point, index) => ({
                  id: point.id,
                  address: point.address,
                  cep: point.cep || '',
                  lat: point.lat,
                  lng: point.lng,
                  order: index,
                  type: point.type || 'waypoint',
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
                optimizedOrder: Array.isArray(intelligentData.optimizedOrder) ? intelligentData.optimizedOrder : [],
                totalDistance: intelligentData.totalDistance || 0,
                estimatedTime: intelligentData.estimatedTime || '0min',
                polyline: intelligentData.polyline || '',
                detailedRoute: null,
                points: Array.isArray(intelligentData.points) ? intelligentData.points.map((p: any, index: number) => ({
                  id: p?.id || `point-${index}`,
                  address: p?.address || 'Endereço não definido',
                  cep: p?.cep || '',
                  lat: p?.lat || 0,
                  lng: p?.lng || 0,
                  order: index,
                  type: p?.type || 'waypoint',
                  completed: p?.completed ?? false,
                  completedAt: p?.completedAt ?? null,
                })) : [],
                isExtended: intelligentData.isExtended || false,
                batchCount: intelligentData.batchCount || 1,
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

      // Fallback para otimização tradicional
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
          points: validPoints.map((point, index) => ({
            id: point.id,
            address: point.address,
            cep: point.cep || '',
            lat: point.lat,
            lng: point.lng,
            order: index,
            type: point.type || 'waypoint',
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
        optimizedOrder: Array.isArray(optimizedData.optimizedOrder) ? optimizedData.optimizedOrder : [],
        totalDistance: optimizedData.totalDistance || 0,
        estimatedTime: optimizedData.estimatedTime || '0min',
        polyline: optimizedData.polyline || '',
        detailedRoute: null,
        points: Array.isArray(optimizedData.points) ? optimizedData.points.map((p: any, index: number) => ({
          id: p?.id || `point-${index}`,
          address: p?.address || 'Endereço não definido',
          cep: p?.cep || '',
          lat: p?.lat || 0,
          lng: p?.lng || 0,
          order: index,
          type: p?.type || 'waypoint',
          completed: p?.completed ?? false,
          completedAt: p?.completedAt ?? null,
        })) : [],
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
      console.log('➕ [USE ROUTES] Criando rota:', routeData.name);
      
      if (!routeData?.name) {
        throw new Error('Nome da rota é obrigatório');
      }

      if (!Array.isArray(routeData.points) || routeData.points.length < 2) {
        throw new Error('É necessário pelo menos 2 pontos para criar uma rota');
      }
      
      const newRoute = await routesService.createRoute(routeData);
      console.log('✅ [USE ROUTES] Rota criada:', newRoute.id);
      
      // Forçar recarregamento completo dos dados
      await loadRoutes();
      
      return newRoute;
    } catch (error) {
      console.error('❌ [USE ROUTES] Erro ao criar rota:', error);
      throw error;
    }
  };

  const updateRoute = async (id: string, routeData: Partial<Route>) => {
    try {
      console.log('📝 [USE ROUTES] Atualizando rota:', id);
      
      if (!id) {
        throw new Error('ID da rota é obrigatório');
      }

      if (!routeData) {
        throw new Error('Dados da rota são obrigatórios');
      }
      
      const updatedRoute = await routesService.updateRoute(id, routeData);
      console.log('✅ [USE ROUTES] Rota atualizada:', updatedRoute.id);
      
      // Forçar recarregamento completo dos dados
      await loadRoutes();
      
      return updatedRoute;
    } catch (error) {
      console.error('❌ [USE ROUTES] Erro ao atualizar rota:', error);
      throw error;
    }
  };

  const deleteRoute = async (id: string) => {
    try {
      if (!id) {
        throw new Error('ID da rota é obrigatório');
      }

      console.log('🗑️ [USE ROUTES] Excluindo rota:', id);
      await routesService.deleteRoute(id);
      
      // Forçar recarregamento completo dos dados
      await loadRoutes();
    } catch (error) {
      console.error('❌ [USE ROUTES] Erro ao excluir rota:', error);
      throw error;
    }
  };

  // Carregar dados iniciais
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
