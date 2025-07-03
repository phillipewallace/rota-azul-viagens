
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

// Optimize route - Melhorada com TSP (Traveling Salesman Problem)
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

    // Se temos waypoints, otimizar a rota
    if (waypoints.length > 0) {
      const waypointsParam = `optimize:true|${waypoints.map((p: any) => `${p.lat},${p.lng}`).join('|')}`;
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&waypoints=${waypointsParam}&key=AIzaSyAbITueefJWwTTyXO-9Nz9pgzbgKZ5sV9w`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.routes.length > 0) {
        optimizedRoute = data.routes[0];
        totalDistance = optimizedRoute.legs.reduce((sum: number, leg: any) => sum + leg.distance.value, 0) / 1000;
        totalDuration = optimizedRoute.legs.reduce((sum: number, leg: any) => sum + leg.duration.value, 0);
      }
    } else {
      // Rota simples entre dois pontos
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&key=AIzaSyAbITueefJWwTTyXO-9Nz9pgzbgKZ5sV9w`;
      
      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.routes.length > 0) {
        optimizedRoute = data.routes[0];
        totalDistance = optimizedRoute.legs[0].distance.value / 1000;
        totalDuration = optimizedRoute.legs[0].duration.value;
      }
    }

    if (optimizedRoute) {
      const hours = Math.floor(totalDuration / 3600);
      const minutes = Math.floor((totalDuration % 3600) / 60);
      const estimatedTime = `${hours}h ${minutes}min`;

      // Criar ordem otimizada
      let optimizedOrder = [origin.id];
      if (optimizedRoute.waypoint_order && optimizedRoute.waypoint_order.length > 0) {
        optimizedOrder.push(...optimizedRoute.waypoint_order.map((index: number) => waypoints[index].id));
      }
      optimizedOrder.push(destination.id);

      res.json({
        optimizedOrder,
        totalDistance,
        estimatedTime,
        routes: [optimizedRoute],
        polyline: optimizedRoute.overview_polyline.points
      });
    } else {
      // Fallback para quando não há rota disponível
      const estimatedDistance = points.length * 10;
      const estimatedTime = `${Math.floor(estimatedDistance / 60)}h ${estimatedDistance % 60}min`;

      res.json({
        optimizedOrder: points.map((p: any) => p.id),
        totalDistance: estimatedDistance,
        estimatedTime,
        routes: [],
        polyline: null
      });
    }
  } catch (error) {
    console.error('Error optimizing route:', error);
    res.status(500).json({ error: 'Erro ao otimizar rota' });
  }
});

export default router;
