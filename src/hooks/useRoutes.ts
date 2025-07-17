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
    const maxRetries = 3;
    let lastError: any;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔍 [CEP] Tentativa ${attempt}/${maxRetries} para CEP: ${cep}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout
        
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
          // Delay progressivo: 1s, 2s, 3s
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
    const TIMEOUT_MS = 60000; // 60 segundos
    
    try {
      console.log(`🎯 [OPTIMIZE] Iniciando ${useIntelligent ? 'INTELIGENTE' : 'TRADICIONAL'}`);
      console.log(`🎯 [OPTIMIZE] Route ID: ${routeId || 'NOVA ROTA'}`);
      console.log(`🎯 [OPTIMIZE] Pontos: ${allPoints.length}`);

      if (!allPoints || allPoints.length < 2) {
        throw new Error('É necessário pelo menos 2 pontos para criar uma rota');
      }

      // Validação robusta de UUID
      const isValidUUID = (id: string) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

      // Tentar otimização inteligente se possível
      if (useIntelligent && routeId && isValidUUID(routeId)) {
        const maxRetries = 2;
        let lastError: any;
        
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
            lastError = error;
            console.log(`⚠️ [OPTIMIZE] Tentativa ${attempt} falhou: ${error.message}`);
            
            if (attempt < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 2000)); // 2s delay
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
