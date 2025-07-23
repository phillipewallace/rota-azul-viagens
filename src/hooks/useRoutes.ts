
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
      console.log('🔄 [USE ROUTES] ===== CARREGANDO ROTAS =====');
      setLoading(true);
      
      const data = await routesService.getRoutes();
      
      console.log('📡 [USE ROUTES] Resposta do backend:', {
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
          totalDistance: processedRoute.totalDistance,
          estimatedTime: processedRoute.estimatedTime
        });

        return processedRoute;
      }).filter(route => route !== null);
      
      console.log('✅ [USE ROUTES] Total de rotas válidas carregadas:', validatedRoutes.length);
      
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

  const createRoute = async (routeData: Omit<Route, 'id' | 'createdAt'>) => {
    try {
      console.log('➕ [USE ROUTES] ===== CRIANDO ROTA =====');
      console.log('➕ [USE ROUTES] Dados recebidos:', {
        name: routeData.name,
        pointsCount: routeData.points?.length || 0,
        totalDistance: routeData.totalDistance,
        estimatedTime: routeData.estimatedTime
      });
      
      if (!routeData?.name) {
        throw new Error('Nome da rota é obrigatório');
      }

      if (!Array.isArray(routeData.points) || routeData.points.length < 2) {
        throw new Error('É necessário pelo menos 2 pontos para criar uma rota');
      }
      
      const newRoute = await routesService.createRoute(routeData);
      console.log('✅ [USE ROUTES] Rota criada no backend:', newRoute.id);
      
      // Recarregar dados para garantir sincronização
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
      console.log('📝 [USE ROUTES] ID:', id);
      console.log('📝 [USE ROUTES] Dados recebidos:', {
        name: routeData.name,
        pointsCount: routeData.points?.length || 0,
        totalDistance: routeData.totalDistance,
        estimatedTime: routeData.estimatedTime
      });
      
      if (!id) {
        throw new Error('ID da rota é obrigatório');
      }

      if (!routeData) {
        throw new Error('Dados da rota são obrigatórios');
      }
      
      const updatedRoute = await routesService.updateRoute(id, routeData);
      console.log('✅ [USE ROUTES] Rota atualizada no backend:', updatedRoute.id);
      
      // Recarregar dados para garantir sincronização
      await loadRoutes();
      
      return updatedRoute;
    } catch (error) {
      console.error('❌ [USE ROUTES] Erro ao atualizar rota:', error);
      throw error;
    }
  };

  const deleteRoute = async (id: string) => {
    try {
      console.log('🗑️ [USE ROUTES] ===== EXCLUINDO ROTA =====');
      console.log('🗑️ [USE ROUTES] ID:', id);
      
      if (!id) {
        throw new Error('ID da rota é obrigatório');
      }

      await routesService.deleteRoute(id);
      console.log('✅ [USE ROUTES] Rota excluída do backend');
      
      // Recarregar dados para garantir sincronização
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
    createRoute,
    updateRoute,
    deleteRoute
  };
};
