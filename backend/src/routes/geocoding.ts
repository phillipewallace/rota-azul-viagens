
import { Router } from 'express';
import { googleMapsOptimizer } from '../services/googleMapsOptimizer';

const router = Router();

interface ViaCepResponse {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  ibge: string;
  gia: string;
  ddd: string;
  siafi: string;
  erro?: boolean;
}

// Cache simples para CEPs (em produção usar Redis)
const cepCache = new Map<string, any>();
const CACHE_TTL = 1000 * 60 * 60; // 1 hora

// Função robusta para fetch com retry
async function fetchWithRetry(url: string, options: RequestInit = {}, maxRetries: number = 3): Promise<Response> {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        return response;
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      lastError = error;
      console.log(`⚠️ [GEOCODING] Tentativa ${attempt}/${maxRetries} falhou para ${url}: ${error.message}`);
      
      if (attempt < maxRetries) {
        // Backoff exponencial: 1s, 2s, 4s
        const delay = Math.pow(2, attempt - 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

// Get address by CEP com sistema robusto
router.get('/cep/:cep', async (req, res) => {
  try {
    const { cep } = req.params;
    const cleanCep = cep.replace(/\D/g, '');
    
    console.log(`🔍 [GEOCODING CEP] Buscando CEP: ${cleanCep}`);
    
    // Verificar cache primeiro
    const cacheKey = `cep_${cleanCep}`;
    const cached = cepCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
      console.log(`⚡ [GEOCODING CEP] Cache hit para ${cleanCep}`);
      return res.json(cached.data);
    }
    
    let addressData: ViaCepResponse | null = null;
    
    // Tentar APIs em ordem de prioridade
    const apis = [
      {
        name: 'ViaCEP',
        url: `https://viacep.com.br/ws/${cleanCep}/json/`,
        transform: (data: any) => data
      },
      {
        name: 'BrasilAPI',
        url: `https://brasilapi.com.br/api/cep/v1/${cleanCep}`,
        transform: (data: any) => ({
          cep: data.cep,
          logradouro: data.street || '',
          complemento: '',
          bairro: data.neighborhood || '',
          localidade: data.city || '',
          uf: data.state || '',
          ibge: '',
          gia: '',
          ddd: '',
          siafi: ''
        })
      },
      {
        name: 'PostmonAPI',
        url: `https://api.postmon.com.br/v1/cep/${cleanCep}`,
        transform: (data: any) => ({
          cep: data.cep,
          logradouro: data.logradouro || '',
          complemento: '',
          bairro: data.bairro || '',
          localidade: data.cidade || '',
          uf: data.estado || '',
          ibge: '',
          gia: '',
          ddd: '',
          siafi: ''
        })
      }
    ];
    
    for (const api of apis) {
      try {
        console.log(`🔄 [GEOCODING CEP] Tentando ${api.name}...`);
        const response = await fetchWithRetry(api.url);
        const data = await response.json();
        
        if (!data.erro && !data.error) {
          addressData = api.transform(data);
          console.log(`✅ [GEOCODING CEP] ${api.name} respondeu com sucesso`);
          break;
        }
      } catch (error) {
        console.log(`⚠️ [GEOCODING CEP] ${api.name} falhou: ${error.message}`);
        continue;
      }
    }
    
    if (!addressData) {
      console.log(`❌ [GEOCODING CEP] Todas as APIs falharam para ${cleanCep}`);
      return res.status(404).json({ 
        error: 'CEP não encontrado',
        cep: cleanCep,
        message: 'Todas as APIs de CEP estão indisponíveis no momento'
      });
    }
    
    const address = `${addressData.logradouro}, ${addressData.bairro}, ${addressData.localidade}, ${addressData.uf}, Brasil`;
    
    // Buscar coordenadas com Google Maps
    let lat = -23.5505; // Coordenadas padrão (São Paulo)
    let lng = -46.6333;
    
    try {
      const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=AIzaSyAbITueefJWwTTyXO-9Nz9pgzbgKZ5sV9w`;
      const geocodeResponse = await fetchWithRetry(geocodeUrl);
      const geocodeData = await geocodeResponse.json();
      
      if (geocodeData.status === 'OK' && geocodeData.results.length > 0) {
        const location = geocodeData.results[0].geometry.location;
        lat = location.lat;
        lng = location.lng;
        console.log(`✅ [GEOCODING CEP] Coordenadas obtidas: ${lat}, ${lng}`);
      }
    } catch (geocodeError) {
      console.log(`⚠️ [GEOCODING CEP] Google Geocoding falhou, usando coordenadas padrão`);
    }
    
    const result = {
      address: address,
      cep: cleanCep,
      lat: lat,
      lng: lng,
      source: 'geocoding_api'
    };
    
    // Salvar no cache
    cepCache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });
    
    console.log(`✅ [GEOCODING CEP] Resultado final para ${cleanCep}`);
    res.json(result);
    
  } catch (error) {
    console.error(`❌ [GEOCODING CEP] Erro fatal:`, error);
    res.status(500).json({ 
      error: 'Erro interno ao buscar endereço',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint de otimização (fallback quando inteligente falha)
router.post('/optimize', async (req, res) => {
  try {
    console.log(`🔄 [GEOCODING OPTIMIZE] Iniciando otimização tradicional`);
    const { points } = req.body;
    
    if (!points || points.length < 2) {
      return res.status(400).json({ error: 'É necessário pelo menos 2 pontos' });
    }
    
    // Usar Google Maps Optimizer
    const optimized = await googleMapsOptimizer.optimizeRouteWithGoogleAPIs(points);
    
    const hours = Math.floor(optimized.totalDuration / 3600);
    const minutes = Math.floor((optimized.totalDuration % 3600) / 60);
    const estimatedTime = hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`;
    
    const response = {
      points: optimized.optimizedPoints,
      optimizedOrder: optimized.optimizedOrder,
      totalDistance: optimized.totalDistance,
      estimatedTime: estimatedTime,
      polyline: optimized.polyline,
      optimization: 'TRADITIONAL'
    };
    
    console.log(`✅ [GEOCODING OPTIMIZE] Concluído: ${response.totalDistance}km`);
    res.json(response);
    
  } catch (error) {
    console.error(`❌ [GEOCODING OPTIMIZE] Erro:`, error);
    res.status(500).json({ error: 'Erro ao otimizar rota' });
  }
});

export default router;
