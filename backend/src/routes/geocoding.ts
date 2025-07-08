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

interface GoogleGeocodeResponse {
  status: string;
  results: Array<{
    geometry: {
      location: {
        lat: number;
        lng: number;
      };
    };
  }>;
}

interface GoogleDirectionsResponse {
  status: string;
  routes: Array<{
    legs: Array<{
      distance: { value: number };
      duration: { value: number; text: string };
    }>;
    waypoint_order: number[];
    overview_polyline: { points: string };
  }>;
}

// Get address by CEP
router.get('/cep/:cep', async (req, res) => {
  try {
    const { cep } = req.params;
    
    // Busca no ViaCEP
    const viaCepResponse = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const viaCepData = await viaCepResponse.json() as ViaCepResponse;
    
    if (viaCepData.erro) {
      return res.status(404).json({ error: 'CEP não encontrado' });
    }

    const address = `${viaCepData.logradouro}, ${viaCepData.bairro}, ${viaCepData.localidade}, ${viaCepData.uf}, Brasil`;
    
    // Use Google Maps Geocoding API para obter coordenadas
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=AIzaSyAbITueefJWwTTyXO-9Nz9pgzbgKZ5sV9w`;
    const geocodeResponse = await fetch(geocodeUrl);
    const geocodeData = await geocodeResponse.json() as GoogleGeocodeResponse;
    
    let lat = -23.5505; // Coordenadas padrão (São Paulo)
    let lng = -46.6333;
    
    if (geocodeData.status === 'OK' && geocodeData.results.length > 0) {
      const location = geocodeData.results[0].geometry.location;
      lat = location.lat;
      lng = location.lng;
    }

    res.json({
      address: address,
      cep: cep,
      lat: lat,
      lng: lng
    });
  } catch (error) {
    console.error('Error fetching address by CEP:', error);
    res.status(500).json({ error: 'Erro ao buscar endereço' });
  }
});

// Algoritmo de otimização ATUALIZADO usando Google Maps APIs avançadas
router.post('/optimize', async (req, res) => {
  try {
    const { points } = req.body;
    
    if (!points || points.length < 2) {
      return res.status(400).json({ error: 'É necessário pelo menos 2 pontos' });
    }

    console.log(`🚀 [GEOCODING OPTIMIZE] Otimizando ${points.length} pontos com Google Maps APIs avançadas`);

    // Formatar pontos para o otimizador
    const formattedPoints = points.map((point: any, index: number) => ({
      id: point.id || `point-${index}`,
      address: point.address || '',
      lat: Number(point.lat || 0),
      lng: Number(point.lng || 0),
      order: Number(point.order || index),
      type: point.type || (index === 0 ? 'origin' : 
             index === points.length - 1 ? 'destination' : 'waypoint')
    }));

    // Usar Google Maps Optimizer avançado
    const optimized = await googleMapsOptimizer.optimizeRouteWithGoogleAPIs(formattedPoints);

    // Calcular tempo estimado em formato legível
    const hours = Math.floor(optimized.totalDuration / 3600);
    const minutes = Math.floor((optimized.totalDuration % 3600) / 60);
    const estimatedTime = hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`;

    console.log(`✅ [GEOCODING OPTIMIZE] Otimização concluída: ${optimized.totalDistance.toFixed(1)}km, ${estimatedTime}`);

    res.json({
      points: optimized.optimizedPoints,
      optimizedOrder: optimized.optimizedOrder,
      totalDistance: optimized.totalDistance,
      estimatedTime: estimatedTime,
      polyline: optimized.polyline,
      optimization: 'GOOGLE_MAPS_ADVANCED'
    });

  } catch (error) {
    console.error('❌ [GEOCODING OPTIMIZE] Erro ao otimizar rota:', error);
    
    // Fallback para otimização básica em caso de falha
    try {
      console.log(`🔄 [GEOCODING OPTIMIZE] Tentando fallback para otimização básica`);
      const basicOptimized = basicOptimization(req.body.points);
      res.json(basicOptimized);
    } catch (fallbackError) {
      console.error('❌ [GEOCODING OPTIMIZE] Fallback também falhou:', fallbackError);
      res.status(500).json({ error: 'Erro ao otimizar rota com todas as APIs' });
    }
  }
});

// Função de fallback para otimização básica
function basicOptimization(points: any[]) {
  console.log(`⚡ [BASIC OPTIMIZE] Usando algoritmo básico de fallback`);
  
  const origin = points.find((p: any) => p.type === 'origin') || points[0];
  const destination = points.find((p: any) => p.type === 'destination') || points[points.length - 1];
  const waypoints = points.filter((p: any) => p.type === 'waypoint' || 
    (p.id !== origin.id && p.id !== destination.id));

  let optimizedPoints;
  let totalDistance = 0;

  if (waypoints.length > 0) {
    optimizedPoints = nearestNeighborTSP([origin, ...waypoints, destination]);
    totalDistance = calculateTotalDistance(optimizedPoints);
  } else {
    optimizedPoints = [origin, destination];
    totalDistance = calculateDistance(origin, destination);
  }

  const finalOptimizedPoints = optimizedPoints.map((point, index) => ({
    ...point,
    order: index,
    type: index === 0 ? 'origin' : 
          index === optimizedPoints.length - 1 ? 'destination' : 'waypoint'
  }));

  const estimatedDuration = totalDistance * 60; // 1 km/min estimate
  const hours = Math.floor(estimatedDuration / 3600);
  const minutes = Math.floor((estimatedDuration % 3600) / 60);
  const estimatedTime = hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`;

  return {
    points: finalOptimizedPoints,
    optimizedOrder: finalOptimizedPoints.map(p => p.id),
    totalDistance: totalDistance,
    estimatedTime: estimatedTime,
    polyline: null,
    optimization: 'BASIC_FALLBACK'
  };
}

// Algoritmo de vizinho mais próximo para TSP
function nearestNeighborTSP(points: any[]): any[] {
  if (points.length <= 2) return points;
  
  const result = [points[0]]; // Começar com o primeiro ponto (origem)
  const remaining = points.slice(1, -1); // Pontos intermediários
  const destination = points[points.length - 1]; // Último ponto (destino)
  
  let currentPoint = points[0];
  
  while (remaining.length > 0) {
    let nearestIndex = 0;
    let minDistance = calculateDistance(currentPoint, remaining[0]);
    
    for (let i = 1; i < remaining.length; i++) {
      const distance = calculateDistance(currentPoint, remaining[i]);
      if (distance < minDistance) {
        minDistance = distance;
        nearestIndex = i;
      }
    }
    
    currentPoint = remaining[nearestIndex];
    result.push(currentPoint);
    remaining.splice(nearestIndex, 1);
  }
  
  result.push(destination); // Adicionar destino no final
  return result;
}

// Calcular distância entre dois pontos (fórmula de Haversine)
function calculateDistance(point1: any, point2: any): number {
  const R = 6371; // Raio da Terra em km
  const dLat = toRadians(point2.lat - point1.lat);
  const dLng = toRadians(point2.lng - point1.lng);
  
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
           Math.cos(toRadians(point1.lat)) * Math.cos(toRadians(point2.lat)) *
           Math.sin(dLng/2) * Math.sin(dLng/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Calcular distância total de uma rota
function calculateTotalDistance(points: any[]): number {
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += calculateDistance(points[i], points[i + 1]);
  }
  return total;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

export default router;
