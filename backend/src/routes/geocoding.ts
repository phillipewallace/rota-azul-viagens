
import { Router } from 'express';

const router = Router();

// Get address by CEP
router.get('/cep/:cep', async (req, res) => {
  try {
    const { cep } = req.params;
    
    // Busca no ViaCEP
    const viaCepResponse = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const viaCepData = await viaCepResponse.json();
    
    if (viaCepData.erro) {
      return res.status(404).json({ error: 'CEP não encontrado' });
    }

    const address = `${viaCepData.logradouro}, ${viaCepData.bairro}, ${viaCepData.localidade}, ${viaCepData.uf}, Brasil`;
    
    // Use Google Maps Geocoding API para obter coordenadas
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=AIzaSyAbITueefJWwTTyXO-9Nz9pgzbgKZ5sV9w`;
    const geocodeResponse = await fetch(geocodeUrl);
    const geocodeData = await geocodeResponse.json();
    
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

// Algoritmo de otimização de rotas inteligente usando TSP (Traveling Salesman Problem)
router.post('/optimize', async (req, res) => {
  try {
    const { points } = req.body;
    
    if (!points || points.length < 2) {
      return res.status(400).json({ error: 'É necessário pelo menos 2 pontos' });
    }

    // Identificar origem e destino
    const origin = points.find((p: any) => p.type === 'origin') || points[0];
    const destination = points.find((p: any) => p.type === 'destination') || points[points.length - 1];
    const waypoints = points.filter((p: any) => p.type === 'waypoint' || (p.id !== origin.id && p.id !== destination.id));

    let optimizedRoute;
    let totalDistance = 0;
    let totalDuration = 0;
    let optimizedPoints = [origin];

    // Implementar algoritmo de otimização inteligente
    if (waypoints.length > 0) {
      // Usar Google Directions API com otimização automática
      const waypointsParam = `optimize:true|${waypoints.map((p: any) => `${p.lat},${p.lng}`).join('|')}`;
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&waypoints=${waypointsParam}&key=AIzaSyAbITueefJWwTTyXO-9Nz9pgzbgKZ5sV9w`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.routes.length > 0) {
        optimizedRoute = data.routes[0];
        totalDistance = optimizedRoute.legs.reduce((sum: number, leg: any) => sum + leg.distance.value, 0) / 1000;
        totalDuration = optimizedRoute.legs.reduce((sum: number, leg: any) => sum + leg.duration.value, 0);
        
        // Reordenar pontos conforme otimização do Google
        if (optimizedRoute.waypoint_order && optimizedRoute.waypoint_order.length > 0) {
          const reorderedWaypoints = optimizedRoute.waypoint_order.map((index: number) => waypoints[index]);
          optimizedPoints = [origin, ...reorderedWaypoints, destination];
        } else {
          optimizedPoints = [origin, ...waypoints, destination];
        }
      } else {
        // Fallback: usar algoritmo simples de vizinho mais próximo
        optimizedPoints = nearestNeighborTSP([origin, ...waypoints, destination]);
        totalDistance = calculateTotalDistance(optimizedPoints);
        totalDuration = totalDistance * 60; // Estimativa: 1 km/min
      }
    } else {
      // Rota simples entre dois pontos
      optimizedPoints = [origin, destination];
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&key=AIzaSyAbITueefJWwTTyXO-9Nz9pgzbgKZ5sV9w`;
      
      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.routes.length > 0) {
        optimizedRoute = data.routes[0];
        totalDistance = optimizedRoute.legs[0].distance.value / 1000;
        totalDuration = optimizedRoute.legs[0].duration.value;
      } else {
        totalDistance = calculateDistance(origin, destination);
        totalDuration = totalDistance * 60;
      }
    }

    // Atualizar ordem e tipo dos pontos otimizados
    const finalOptimizedPoints = optimizedPoints.map((point, index) => ({
      ...point,
      order: index,
      type: index === 0 ? 'origin' : 
            index === optimizedPoints.length - 1 ? 'destination' : 'waypoint'
    }));

    const hours = Math.floor(totalDuration / 3600);
    const minutes = Math.floor((totalDuration % 3600) / 60);
    const estimatedTime = `${hours}h ${minutes}min`;

    res.json({
      points: finalOptimizedPoints,
      optimizedOrder: finalOptimizedPoints.map(p => p.id),
      totalDistance: totalDistance,
      estimatedTime: estimatedTime,
      polyline: optimizedRoute?.overview_polyline?.points || null
    });

  } catch (error) {
    console.error('Error optimizing route:', error);
    res.status(500).json({ error: 'Erro ao otimizar rota' });
  }
});

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
