import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { currentUser, listMonthPunches, type TodayPunch } from './api';
import { toast } from 'sonner';

const TIPO_ABBR: Record<TodayPunch['tipo'], string> = {
  'entrada': 'E', 'saida-almoco': 'SA', 'volta-almoco': 'VA', 'saida': 'S',
};

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export default function PontoMobileEspelho() {
  const user = currentUser();
  const [ref, setRef] = useState(() => new Date());
  const [punches, setPunches] = useState<TodayPunch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fid = user?.funcionario_id || user?.id;
    if (!fid) return;
    setLoading(true);
    listMonthPunches(fid, ref)
      .then(setPunches)
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Erro ao carregar espelho'))
      .finally(() => setLoading(false));
  }, [user, ref]);

  const grouped = useMemo(() => {
    const map = new Map<string, TodayPunch[]>();
    for (const p of punches) {
      const d = new Date(p.timestamp);
      const key = d.toISOString().slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return Array.from(map.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([k, list]) => ({
        key: k,
        list: list.sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1)),
      }));
  }, [punches]);

  const totalDias = grouped.length;

  return (
    <div className="pm-safe-top space-y-5 px-5 pb-6">
      <header className="pt-2">
        <p className="text-xs font-medium text-muted-foreground">Espelho de ponto</p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Meus registros</h1>
      </header>

      {/* Seletor de mês */}
      <div className="flex items-center justify-between rounded-2xl bg-card p-2 shadow-sm">
        <button
          onClick={() => setRef(new Date(ref.getFullYear(), ref.getMonth() - 1, 1))}
          aria-label="Mês anterior"
          className="flex h-10 w-10 items-center justify-center rounded-xl text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2 text-sm font-semibold capitalize text-foreground">
          <CalendarDays className="h-4 w-4 text-primary" />
          {ref.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
        </div>
        <button
          onClick={() => setRef(new Date(ref.getFullYear(), ref.getMonth() + 1, 1))}
          aria-label="Próximo mês"
          className="flex h-10 w-10 items-center justify-center rounded-xl text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-card p-4 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground">Dias trabalhados</p>
          <p className="pm-numeric mt-1 text-2xl font-bold text-foreground">{totalDias}</p>
        </div>
        <div className="rounded-2xl bg-card p-4 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground">Batidas totais</p>
          <p className="pm-numeric mt-1 text-2xl font-bold text-foreground">{punches.length}</p>
        </div>
      </div>

      {/* Lista */}
      <section>
        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : grouped.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center">
            <p className="text-sm text-muted-foreground">Nenhum registro neste mês.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {grouped.map(({ key, list }) => {
              const d = new Date(key + 'T00:00:00');
              return (
                <li key={key} className="overflow-hidden rounded-2xl bg-card shadow-sm">
                  <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                    <div>
                      <p className="text-sm font-semibold capitalize text-foreground">
                        {d.toLocaleDateString('pt-BR', { weekday: 'long' })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                      </p>
                    </div>
                    <span className="pm-numeric text-xs font-medium text-muted-foreground">
                      {list.length} {list.length === 1 ? 'batida' : 'batidas'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 px-4 py-3">
                    {list.map((p) => (
                      <span
                        key={p.id}
                        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium"
                        style={{ background: 'hsl(var(--primary-soft))', color: 'hsl(var(--primary-strong))' }}
                      >
                        <span className="pm-numeric">{fmtTime(p.timestamp)}</span>
                        <span className="opacity-60">·</span>
                        <span className="opacity-80">{TIPO_ABBR[p.tipo]}</span>
                      </span>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
