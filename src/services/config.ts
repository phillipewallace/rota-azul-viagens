
// Configurações da API
console.log('🔍 [CONFIG] Mode atual:', import.meta.env.MODE);
console.log('🔍 [CONFIG] Prod check:', import.meta.env.PROD);
console.log('🔍 [CONFIG] Dev check:', import.meta.env.DEV);

// Forçar produção sempre para evitar problemas
export const API_BASE_URL = 'https://admmicban.com.br/api';

console.log('🔍 [CONFIG] API_BASE_URL definida como:', API_BASE_URL);

export const GOOGLE_MAPS_API_KEY = 'AIzaSyAbITueefJWwTTyXO-9Nz9pgzbgKZ5sV9w';
