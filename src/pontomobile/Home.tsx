import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, DoorOpen, UtensilsCrossed, ArrowRight, Clock, LogOut } from 'lucide-react';
import { currentUser, listTodayPunches, logout, type TodayPunch } from './api';
import { toast } from 'sonner';

const TIPO_META: Record<TodayPunch['tipo'], { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  'entrada': { label: 'Entrada', icon: DoorOpen },
  'saida-almoco': { label: 'Almoço saída', icon: UtensilsCrossed },
  'volta-almoco': { label: 'Almoço volta', icon: UtensilsCrossed },
  'saida': { label: 'Saída', icon: LogOut },
};

const ORDER: TodayPunch['tipo'][] = ['entrada', 'saida-almoco', 'volta-almoco', 'saida'];

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export default function PontoMobileHome() {
  const user = currentUser();
  const navigate = useNavigate();
  const [now, setNow] = useState(new Date());
  const [punches, setPunches] = useState<TodayPunch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const fid = user?.funcionario_id || user?.id;
    if (!fid) return;
    listTodayPunches(fid)
      .then(setPunches)
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Erro ao carregar registros'))
      .finally(() => setLoading(false));
  }, [user]);

  const timeline = useMemo(() => {
    const map = new Map<TodayPunch['tipo'], TodayPunch>();
    for (const p of punches) if (!map.has(p.tipo)) map.set(p.tipo, p);
    return ORDER.map((tipo) => ({ tipo, punch: map.get(tipo) ?? null }));
  }, [punches]);

  const nextTipo = timeline.find((t) => !t.punch)?.tipo ?? null;

  const handleLogout = () => {
    logout();
    navigate('/pontomobile/login', { replace: true });
  };

  return (
    <div className="pm-safe-top flex flex-col gap-6 px-5 pb-6">
      {/* Header */}
      <header className="flex items-center justify-between pt-2">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Olá,</p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {user?.name?.split(' ')[0] ?? 'Funcionário'}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            aria-label="Notificações"
            className="relative flex h-11 w-11 items-center justify-center rounded-full bg-card text-foreground shadow-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-primary ring-2 ring-card" />
          </button>
          <button
            onClick={handleLogout}
            aria-label="Sair"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-card text-muted-foreground shadow-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Card principal */}
      <section
        className="relative overflow-hidden rounded-3xl p-6 text-primary-foreground"
        style={{ background: 'var(--pm-gradient)', boxShadow: 'var(--pm-shadow-lg)' }}
      >
        <div aria-hidden className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary-foreground/5" />
        <div aria-hidden className="absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-primary-foreground/5" />

        <div className="relative">
          <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-primary-foreground/80">
            <Clock className="h-3.5 w-3.5" />
            Ponto Digital
          </div>

          <div className="mt-4 flex items-baseline gap-1 pm-numeric">
            <span className="text-6xl font-bold leading-none">
              {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
            <span className="text-2xl font-semibold text-primary-foreground/70">
              :{String(now.getSeconds()).padStart(2, '0')}
            </span>
          </div>

          <p className="mt-2 text-sm capitalize text-primary-foreground/85">
            {now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>

          <button
            onClick={() => navigate('/pontomobile/bater')}
            className="group mt-6 flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-card text-base font-bold uppercase tracking-wide text-primary shadow-md hover:bg-card/95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/60"
          >
            <Clock className="h-5 w-5" />
            Bater Ponto
            <ArrowRight className="h-4 w-4 opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-100" />
          </button>
        </div>
      </section>

      {/* Timeline do dia */}
      <section>
        <div className="mb-3 flex items-center justify-between px-1">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Hoje</h2>
          {nextTipo && (
            <span className="text-xs font-medium text-muted-foreground">
              Próximo: {TIPO_META[nextTipo].label}
            </span>
          )}
        </div>

        <div className="overflow-hidden rounded-2xl bg-card shadow-sm">
          {loading ? (
            <div className="space-y-3 p-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                    <div className="h-2.5 w-16 animate-pulse rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {timeline.map(({ tipo, punch }) => {
                const meta = TIPO_META[tipo];
                const Icon = meta.icon;
                const done = !!punch;
                return (
                  <li key={tipo} className="flex items-center gap-3 px-4 py-3.5">
                    <div
                      className={[
                        'flex h-10 w-10 items-center justify-center rounded-full',
                        done ? 'text-primary' : 'text-muted-foreground',
                      ].join(' ')}
                      style={{ background: done ? 'hsl(var(--primary-soft))' : 'hsl(var(--muted))' }}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <p className={['text-sm font-semibold', done ? 'text-foreground' : 'text-muted-foreground'].join(' ')}>
                        {meta.label}
                      </p>
                      <p className="text-xs text-muted-foreground">{done ? 'Registrado' : 'Pendente'}</p>
                    </div>
                    <span
                      className={[
                        'pm-numeric text-base font-semibold tabular-nums',
                        done ? 'text-foreground' : 'text-muted-foreground/60',
                      ].join(' ')}
                    >
                      {punch ? fmtTime(punch.timestamp) : '—:—'}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
