import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, X, MapPin, Camera, RotateCcw, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { createPunch, currentUser, listTodayPunches, type TodayPunch } from './api';

const TIPO_LABEL: Record<TodayPunch['tipo'], string> = {
  'entrada': 'Registrar Entrada',
  'saida-almoco': 'Registrar Saída Almoço',
  'volta-almoco': 'Registrar Volta do Almoço',
  'saida': 'Registrar Saída',
};

const ORDER: TodayPunch['tipo'][] = ['entrada', 'saida-almoco', 'volta-almoco', 'saida'];

export default function PontoMobileBater() {
  const navigate = useNavigate();
  const user = currentUser();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [tipo, setTipo] = useState<TodayPunch['tipo']>('entrada');
  const [photo, setPhoto] = useState<string | null>(null);
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [now, setNow] = useState(new Date());
  const [submitting, setSubmitting] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);

  // Descobre próximo tipo pendente
  useEffect(() => {
    const fid = user?.funcionario_id || user?.id;
    if (!fid) return;
    listTodayPunches(fid).then((today) => {
      const done = new Set(today.map((p) => p.tipo));
      const next = ORDER.find((t) => !done.has(t)) ?? 'saida';
      setTipo(next);
    }).catch(() => {});
  }, [user]);

  // Relógio
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Câmera
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 960 } },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => setCameraReady(true);
        }
      } catch {
        toast.error('Não foi possível acessar a câmera');
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // GPS — obrigatório para bater ponto
  function requestGps() {
    if (!navigator.geolocation) { setGpsStatus('error'); return; }
    setGpsStatus('loading');
    navigator.geolocation.getCurrentPosition(
      (pos) => { setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setGpsStatus('ok'); },
      () => { setGps(null); setGpsStatus('error'); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }
  useEffect(() => { requestGps(); }, []);

  function capture() {
    const v = videoRef.current;
    if (!v) return;
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1); // espelha (selfie)
    ctx.drawImage(v, 0, 0);
    setPhoto(canvas.toDataURL('image/jpeg', 0.82));
  }

  async function confirm() {
    const fid = user?.funcionario_id || user?.id;
    if (!fid) { toast.error('Sessão expirada'); return; }
    if (!photo) { toast.error('Tire a foto primeiro'); return; }
    if (!gps) {
      toast.error('Localização é obrigatória — ative o GPS');
      requestGps();
      return;
    }
    setSubmitting(true);
    try {
      await createPunch({
        funcionario_id: fid,
        tipo,
        latitude: gps.lat,
        longitude: gps.lng,
        foto_base64: photo,
      });
      toast.success('Ponto registrado!');
      navigate('/pontomobile', { replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao registrar');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="pm-safe-top flex min-h-full flex-col bg-background">
      {/* Topbar */}
      <header className="flex items-center justify-between px-4 py-3">
        <button
          onClick={() => navigate(-1)}
          aria-label="Voltar"
          className="flex h-10 w-10 items-center justify-center rounded-full text-primary hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-base font-bold tracking-tight text-foreground">{TIPO_LABEL[tipo]}</h1>
        <button
          onClick={() => navigate('/pontomobile')}
          aria-label="Fechar"
          className="flex h-10 w-10 items-center justify-center rounded-full text-primary hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      {/* Viewfinder */}
      <div className="relative mx-4 flex-1 overflow-hidden rounded-3xl bg-muted">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="Foto capturada" className="h-full w-full object-cover" />
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full object-cover"
            style={{ transform: 'scaleX(-1)' }}
          />
        )}

        {/* Guia oval + brackets */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-1/2 h-[68%] w-[62%] -translate-x-1/2 -translate-y-[52%] rounded-[50%] border-[3px] border-primary/85 shadow-[0_0_0_9999px_hsl(0_0%_0%/0.15)]" />
          {[
            'left-5 top-5 border-l-[3px] border-t-[3px] rounded-tl-md',
            'right-5 top-5 border-r-[3px] border-t-[3px] rounded-tr-md',
            'left-5 bottom-5 border-l-[3px] border-b-[3px] rounded-bl-md',
            'right-5 bottom-5 border-r-[3px] border-b-[3px] rounded-br-md',
          ].map((c) => (
            <span key={c} className={`absolute h-7 w-7 border-primary ${c}`} />
          ))}
        </div>

        {!cameraReady && !photo && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
      </div>

      {/* Info + CTA */}
      <div className="pm-safe-bottom space-y-3 px-4 pt-4">
        <div className="flex items-center justify-center gap-2">
          <div
            className={[
              'inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-medium transition-colors duration-200',
              gpsStatus === 'ok'
                ? 'border-primary/30 bg-primary/10 text-primary'
                : gpsStatus === 'error'
                ? 'border-destructive/30 bg-destructive/10 text-destructive'
                : 'border-border bg-card text-muted-foreground',
            ].join(' ')}
          >
            <MapPin className="h-3.5 w-3.5" />
            {gpsStatus === 'loading' && 'Obtendo localização...'}
            {gpsStatus === 'ok' && 'Localização confirmada'}
            {gpsStatus === 'error' && 'GPS obrigatório'}
            {gpsStatus === 'ok' && <span className="ml-1 h-1.5 w-1.5 rounded-full bg-primary" />}
          </div>
          {gpsStatus === 'error' && (
            <button
              onClick={requestGps}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Tentar
            </button>
          )}
        </div>

        <p className="pm-numeric text-center text-sm text-muted-foreground">
          {now.toLocaleTimeString('pt-BR')} — {now.toLocaleDateString('pt-BR')}
        </p>

        {photo ? (
          <div className="space-y-2 pt-1">
            <button
              onClick={confirm}
              disabled={submitting || !gps}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-base font-bold uppercase tracking-wide text-primary-foreground shadow-md transition-all duration-200 hover:brightness-105 active:scale-[.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              style={{ background: submitting || !gps ? undefined : 'var(--pm-gradient)' }}
            >
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
              {submitting
                ? 'Enviando...'
                : !gps
                ? 'Aguardando GPS...'
                : `Confirmar ${TIPO_LABEL[tipo].replace('Registrar ', '')}`}
            </button>
            <button
              onClick={() => setPhoto(null)}
              className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              <RotateCcw className="h-4 w-4" />
              Tirar novamente
            </button>
          </div>
        ) : (
          <button
            onClick={capture}
            disabled={!cameraReady}
            className="mt-1 flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-bold uppercase tracking-wide text-primary-foreground shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
            style={{ background: 'var(--pm-gradient)' }}
          >
            <Camera className="h-5 w-5" />
            Capturar foto
          </button>
        )}
      </div>
    </div>
  );
}
