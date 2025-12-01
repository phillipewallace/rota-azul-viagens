import { App } from '@capacitor/app';
import { sharedLocationStore } from '@/store/sharedLocationStore';

export const initializeShareHandler = () => {
  // Listener para URLs recebidas (deep links e compartilhamentos)
  App.addListener('appUrlOpen', (data: any) => {
    console.log('📱 [SHARE HANDLER] App URL recebida:', data);
    
    // Extrair texto compartilhado da URL se houver
    if (data.url) {
      try {
        const url = new URL(data.url);
        const sharedText = url.searchParams.get('text');
        
        if (sharedText) {
          console.log('📍 [SHARE HANDLER] Texto compartilhado:', sharedText);
          sharedLocationStore.setSharedContent(sharedText);
        }
      } catch (error) {
        console.error('❌ [SHARE HANDLER] Erro ao processar URL:', error);
      }
    }
  });

  // Verificar se app foi aberto com intent de compartilhamento
  App.getLaunchUrl().then(({ url }) => {
    if (url) {
      console.log('📱 [SHARE HANDLER] App iniciado com URL:', url);
      
      try {
        const urlObj = new URL(url);
        const sharedText = urlObj.searchParams.get('text');
        
        if (sharedText) {
          console.log('📍 [SHARE HANDLER] Texto compartilhado no launch:', sharedText);
          sharedLocationStore.setSharedContent(sharedText);
        }
      } catch (error) {
        console.error('❌ [SHARE HANDLER] Erro ao processar launch URL:', error);
      }
    }
  });

  console.log('✅ [SHARE HANDLER] Share handler inicializado');
};

// Função auxiliar para extrair coordenadas de links do Google Maps
export const extractCoordinatesFromText = (text: string): { lat?: number; lng?: number; address?: string } => {
  // Padrões para extrair coordenadas
  const patterns = [
    /maps\?q=(-?\d+\.\d+),(-?\d+\.\d+)/,           // ?q=lat,lng
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,                   // @lat,lng
    /maps\/place\/[^\/]+\/@(-?\d+\.\d+),(-?\d+\.\d+)/, // place/@lat,lng
    /(-?\d+\.\d+),\s*(-?\d+\.\d+)/,                 // lat, lng (formato simples)
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
