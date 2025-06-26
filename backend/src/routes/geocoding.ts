
import { Router } from 'express';

const router = Router();

// Get address by CEP
router.get('/cep/:cep', async (req, res) => {
  try {
    const { cep } = req.params;
    
    // Busca via ViaCEP primeiro
    const viaCepResponse = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const viaCepData = await viaCepResponse.json();
    
    if (!viaCepData.erro) {
      const address = `${viaCepData.logradouro}, ${viaCepData.bairro}, ${viaCepData.localidade}, ${viaCepData.uf}, Brasil`;
      
      // Para coordenadas, você precisaria usar Google Maps API
      // Por enquanto, retorna coordenadas dummy
      res.json({
        address,
        lat: -23.5505, // São Paulo default
        lng: -46.6333,
        cep
      });
    } else {
      res.status(404).json({ error: 'CEP não encontrado' });
    }
  } catch (error) {
    console.error('Error fetching address by CEP:', error);
    res.status(500).json({ error: 'Erro ao buscar endereço' });
  }
});

export default router;
