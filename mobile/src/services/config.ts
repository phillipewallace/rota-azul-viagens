
// Configurações da API alinhadas com a VPS
console.log('🔍 [CONFIG] Mode atual:', import.meta.env.MODE);
console.log('🔍 [CONFIG] Prod check:', import.meta.env.PROD);
console.log('🔍 [CONFIG] Dev check:', import.meta.env.DEV);

// URL da API baseada no ambiente - alinhada com a VPS admmicban.com.br
export const API_BASE_URL = import.meta.env.MODE === 'production' 
  ? 'https://admmicban.com.br/api' 
  : (import.meta.env.VITE_API_URL || 'http://localhost:3001/api');

console.log('🔍 [CONFIG] API_BASE_URL definida como:', API_BASE_URL);

// Google Maps API Key (mesma chave do sistema principal)
export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyAbITueefJWwTTyXO-9Nz9pgzbgKZ5sV9w';

// Configurações específicas do mobile
export const APP_CONFIG = {
  version: import.meta.env.VITE_APP_VERSION || '2.0',
  name: import.meta.env.VITE_APP_NAME || 'AlchemyRotas Mobile',
  apiTimeout: 10000, // 10 segundos
  locationUpdateInterval: 30000, // 30 segundos
};

console.log('🔍 [CONFIG] Configurações do app:', APP_CONFIG);
