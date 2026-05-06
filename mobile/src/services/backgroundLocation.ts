/**
 * Rastreamento em background — "Ativo apenas em movimento"
 * Usa @capacitor-community/background-geolocation quando disponível.
 *
 * Para builds nativos, instalar:
 *   npm i @capacitor-community/background-geolocation
 *   npx cap sync android
 *
 * E permissões no AndroidManifest.xml:
 *   ACCESS_FINE_LOCATION, ACCESS_BACKGROUND_LOCATION,
 *   FOREGROUND_SERVICE, FOREGROUND_SERVICE_LOCATION
 */
import { API_BASE_URL } from './config';

let watcherId: string | null = null;

async function loadPlugin(): Promise<any | null> {
  try {
    // Import dinâmico — só funciona se o plugin estiver instalado no APK
    const mod: any = await import(/* @vite-ignore */ '@capacitor-community/background-geolocation');
    return mod.BackgroundGeolocation;
  } catch {
    return null;
  }
}

async function postLocation(routeId: string, lat: number, lng: number, speed?: number) {
  try {
    const token = localStorage.getItem('auth-token') || '';
    await fetch(`${API_BASE_URL}/tracking/location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        routeId,
        lat,
        lng,
        speed: speed ?? null,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (e) {
    console.warn('[BG-LOC] Envio falhou:', e);
  }
}

export async function startBackgroundTracking(routeId: string): Promise<boolean> {
  const BG = await loadPlugin();
  if (!BG) {
    console.log('[BG-LOC] Plugin não disponível — usando geolocation padrão');
    return false;
  }
  try {
    watcherId = await BG.addWatcher(
      {
        backgroundMessage: 'Rastreando rota em segundo plano',
        backgroundTitle: 'Rota em andamento',
        requestPermissions: true,
        stale: false,
        distanceFilter: 50, // só dispara após 50m de deslocamento (modo movimento)
      },
      (loc: any, err: any) => {
        if (err) {
          console.warn('[BG-LOC] erro:', err);
          return;
        }
        if (!loc) return;
        // Filtra paradas: só envia quando há velocidade ou deslocamento
        if (loc.speed !== null && loc.speed !== undefined && loc.speed < 0.5) return;
        postLocation(routeId, loc.latitude, loc.longitude, loc.speed);
      }
    );
    console.log('[BG-LOC] Iniciado, watcher:', watcherId);
    return true;
  } catch (e) {
    console.error('[BG-LOC] Falha ao iniciar:', e);
    return false;
  }
}

export async function stopBackgroundTracking(): Promise<void> {
  if (!watcherId) return;
  const BG = await loadPlugin();
  if (BG) {
    try {
      await BG.removeWatcher({ id: watcherId });
    } catch (e) {
      console.warn('[BG-LOC] erro ao parar:', e);
    }
  }
  watcherId = null;
}
