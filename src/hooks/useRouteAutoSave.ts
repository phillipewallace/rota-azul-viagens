import { useEffect, useRef, useCallback } from 'react';
import { RoutePoint } from '@/hooks/useRoutes';

interface RouteAutoSaveData {
  routeName: string;
  routeDescription: string;
  optimizationMode: 'fixed' | 'optimized';
  points: RoutePoint[];
  scrollPosition: number;
}

const AUTOSAVE_INTERVAL = 5000; // 5 segundos
const STORAGE_KEY_PREFIX = 'route-autosave-';

export const useRouteAutoSave = (routeId?: string) => {
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const storageKey = routeId ? `${STORAGE_KEY_PREFIX}${routeId}` : `${STORAGE_KEY_PREFIX}new`;

  const saveToStorage = useCallback((data: RouteAutoSaveData) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        ...data,
        timestamp: Date.now()
      }));
      console.log('💾 [AUTOSAVE] Dados salvos automaticamente:', {
        points: data.points.length,
        mode: data.optimizationMode
      });
    } catch (error) {
      console.error('❌ [AUTOSAVE] Erro ao salvar:', error);
    }
  }, [storageKey]);

  const loadFromStorage = useCallback((): RouteAutoSaveData | null => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (!stored) return null;

      const data = JSON.parse(stored);
      console.log('📥 [AUTOSAVE] Dados recuperados:', {
        points: data.points?.length || 0,
        timestamp: new Date(data.timestamp).toLocaleString()
      });
      return data;
    } catch (error) {
      console.error('❌ [AUTOSAVE] Erro ao carregar:', error);
      return null;
    }
  }, [storageKey]);

  const clearStorage = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
      console.log('🗑️ [AUTOSAVE] Dados limpos');
    } catch (error) {
      console.error('❌ [AUTOSAVE] Erro ao limpar:', error);
    }
  }, [storageKey]);

  const scheduleAutoSave = useCallback((data: RouteAutoSaveData) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveToStorage(data);
    }, AUTOSAVE_INTERVAL);
  }, [saveToStorage]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    scheduleAutoSave,
    loadFromStorage,
    clearStorage,
    saveToStorage
  };
};
