import { App } from '@capacitor/app';
import { sharedLocationStore } from '@/store/sharedLocationStore';

export const initializeShareHandler = () => {
  // Listener para URLs recebidas (deep links e compartilhamentos)
  App.addListener('appUrlOpen', (data: any) => {
    console.log('📱 [SHARE HANDLER] App URL recebida:', data);
    
    if (data.url) {
      try {
        const url = new URL(data.url);
        
        // Verificar se é compartilhamento de texto
        if (url.pathname === '//share' || url.host === 'share') {
          const sharedText = url.searchParams.get('text');
          if (sharedText) {
            console.log('📍 [SHARE HANDLER] Texto compartilhado:', sharedText);
            sharedLocationStore.setSharedContent(decodeURIComponent(sharedText));
          }
        }
        // Verificar se é URI de localização
        else if (url.pathname === '//location' || url.host === 'location') {
          const locationUri = url.searchParams.get('uri');
          if (locationUri) {
            console.log('📍 [SHARE HANDLER] URI de localização:', locationUri);
            sharedLocationStore.setSharedContent(decodeURIComponent(locationUri));
          }
        }
        // Fallback - tentar extrair texto de qualquer parâmetro
        else {
          const text = url.searchParams.get('text') || url.searchParams.get('uri');
          if (text) {
            console.log('📍 [SHARE HANDLER] Conteúdo extraído:', text);
            sharedLocationStore.setSharedContent(decodeURIComponent(text));
          }
        }
      } catch (error) {
        console.error('❌ [SHARE HANDLER] Erro ao processar URL:', error);
        // Tentar usar URL diretamente como conteúdo
        if (data.url && data.url.includes('maps')) {
          sharedLocationStore.setSharedContent(data.url);
        }
      }
    }
  });

  // Verificar se app foi aberto com intent de compartilhamento
  App.getLaunchUrl().then((result) => {
    if (result?.url) {
      console.log('📱 [SHARE HANDLER] App iniciado com URL:', result.url);
      
      try {
        const url = new URL(result.url);
        
        const sharedText = url.searchParams.get('text') || url.searchParams.get('uri');
        if (sharedText) {
          console.log('📍 [SHARE HANDLER] Texto compartilhado no launch:', sharedText);
          sharedLocationStore.setSharedContent(decodeURIComponent(sharedText));
        }
      } catch (error) {
        console.error('❌ [SHARE HANDLER] Erro ao processar launch URL:', error);
        // Tentar usar URL diretamente se for link de mapa
        if (result.url.includes('maps') || result.url.includes('geo:')) {
          sharedLocationStore.setSharedContent(result.url);
        }
      }
    }
  }).catch(err => {
    console.warn('⚠️ [SHARE HANDLER] Erro ao obter launch URL:', err);
  });

  console.log('✅ [SHARE HANDLER] Share handler inicializado');
};

// Função auxiliar para extrair coordenadas de links do Google Maps
export const extractCoordinatesFromText = (text: string): { lat?: number; lng?: number; address?: string } => {
  // Padrões para extrair coordenadas
  const patterns = [
    /maps\?q=(-?\d+\.?\d*),(-?\d+\.?\d*)/,           // ?q=lat,lng
    /@(-?\d+\.?\d*),(-?\d+\.?\d*)/,                   // @lat,lng
    /maps\/place\/[^\/]+\/@(-?\d+\.?\d*),(-?\d+\.?\d*)/, // place/@lat,lng
    /(-?\d+\.\d{4,}),\s*(-?\d+\.\d{4,})/,             // lat, lng (formato decimal longo)
    /geo:(-?\d+\.?\d*),(-?\d+\.?\d*)/,                // geo:lat,lng
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return {
        lat: parseFloat(match[1]),
        lng: parseFloat(match[2]),
      };
    }
  }
  
  // Se não encontrou coordenadas, retornar texto como endereço
  return {
    address: text
  };
};
