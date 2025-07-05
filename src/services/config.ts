
// Configurações da API
console.log('🔍 [CONFIG] Mode atual:', import.meta.env.MODE);
console.log('🔍 [CONFIG] Prod check:', import.meta.env.PROD);

export const API_BASE_URL = import.meta.env.PROD || import.meta.env.MODE === 'production'
  ? 'https://admmicban.com.br/api' 
  : 'http://localhost:3001/api';

console.log('🔍 [CONFIG] API_BASE_URL definida como:', API_BASE_URL);

export const GOOGLE_MAPS_API_KEY = 'AIzaSyAbITueefJWwTTyXO-9Nz9pgzbgKZ5sV9w';
