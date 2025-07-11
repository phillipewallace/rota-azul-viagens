
import { API_BASE_URL } from './config';

export class BaseApiService {
  protected async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    console.log('🔍 [BASE_API] Fazendo requisição para:', url);
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options?.headers,
      },
      credentials: 'omit',
      ...options,
    };

    console.log('🔍 [BASE_API] Config da requisição:', config);

    try {
      const response = await fetch(url, config);
      
      console.log('📡 [BASE_API] Response status:', response.status);
      console.log('📡 [BASE_API] Response ok:', response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [BASE_API] Erro na resposta:', errorText);
        throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ [BASE_API] Dados recebidos:', data);
      return data;
    } catch (error) {
      console.error('❌ [BASE_API] Erro na requisição:', error);
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Erro de conexão. Verifique se o servidor está rodando e acessível.');
      }
      throw error;
    }
  }
}
