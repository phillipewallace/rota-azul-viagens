
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
    
    // Aqui você pode integrar com Google Maps para obter coordenadas
    // Por agora, retornando dados básicos
    res.json({
      address: address,
      cep: cep,
      lat: -23.5505, // Coordenadas padrão (São Paulo)
      lng: -46.6333
    });
  } catch (error) {
    console.error('Error fetching address by CEP:', error);
    res.status(500).json({ error: 'Erro ao buscar endereço' });
  }
});

// Optimize route
router.post('/optimize', async (req, res) => {
  try {
    const { points } = req.body;
    
    if (!points || points.length < 2) {
      return res.status(400).json({ error: 'É necessário pelo menos 2 pontos' });
    }

    // Simulação de otimização - em produção, usar Google Maps Directions API
    const optimizedOrder = points.map((_: any, index: number) => index.toString());
    const totalDistance = points.length * 10; // Distância simulada
    const estimatedTime = `${Math.floor(totalDistance / 60)}h ${totalDistance % 60}min`;

    res.json({
      optimizedOrder,
      totalDistance,
      estimatedTime,
      routes: []
    });
  } catch (error) {
    console.error('Error optimizing route:', error);
    res.status(500).json({ error: 'Erro ao otimizar rota' });
  }
});

export default router;
