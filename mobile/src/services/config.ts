/**
 * Configurações da API para o app mobile
 * 
 * IMPORTANTE: No APK, import.meta.env.MODE pode não ser 'production'
 * dependendo de como o build foi feito. Por isso, usamos detecção mais robusta.
 */

// Detectar se está rodando no Android/iOS (APK) ou no navegador
const isNativeApp = typeof (window as any).Capacitor !== 'undefined' && 
                    (window as any).Capacitor.isNativePlatform?.() === true;

// Detectar se é ambiente de desenvolvimento local
const isLocalDev = typeof window !== 'undefined' && 
                   (window.location.hostname === 'localhost' || 
                    window.location.hostname === '127.0.0.1' ||
                    window.location.hostname.startsWith('192.168.'));

console.log('🔍 [CONFIG] isNativeApp:', isNativeApp);
console.log('🔍 [CONFIG] isLocalDev:', isLocalDev);
console.log('🔍 [CONFIG] Mode:', import.meta.env.MODE);

// URL da API - APK sempre usa produção, dev local usa localhost
export const API_BASE_URL = isNativeApp || import.meta.env.MODE === 'production'
  ? 'https://admmicban.com.br/api'
  : (import.meta.env.VITE_API_URL || 'http://localhost:3001/api');

console.log('🔍 [CONFIG] API_BASE_URL definida como:', API_BASE_URL);

// Google Maps API Key (mesma chave do sistema principal)
export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyAbITueefJWwTTyXO-9Nz9pgzbgKZ5sV9w';

// Configurações específicas do mobile
export const APP_CONFIG = {
  version: import.meta.env.VITE_APP_VERSION || '2.0',
  name: import.meta.env.VITE_APP_NAME || 'AlchemyRotas Mobile',
  apiTimeout: 15000, // 15 segundos
  locationUpdateInterval: 30000, // 30 segundos
};

console.log('🔍 [CONFIG] Configurações do app:', APP_CONFIG);
