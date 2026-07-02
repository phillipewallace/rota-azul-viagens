import { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft, ChevronRight, CalendarDays, AlertCircle, RefreshCw,
  Clock3, Wallet, TrendingUp, TrendingDown, CalendarCheck2,
} from 'lucide-react';
import {
  currentUser, listMonthPunches, getMyFuncionario, listJornadas,
  type TodayPunch, type FuncionarioMini, type JornadaMini,
} from './api';
import { toast } from 'sonner';

const TIPO_ABBR: Record<TodayPunch['tipo'], string> = {
  'entrada': 'E', 'saida-almoco': 'SA', 'volta-almoco': 'VA', 'saida': 'S',
};

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function fmtHm(min: number) {
  const sign = min < 0 ? '-' : '';
  const a = Math.abs(Math.round(min));
  return `${sign}${String(Math.floor(a / 60)).padStart(2, '0')}h${String(a % 60).padStart(2, '0')}`;
}

function hhmmToMin(t?: string | null) {
  if (!t) return null;
  const [h, m] = t.slice(0, 5).split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

// Minutos trabalhados no dia: pareia entrada/saida-almoco + volta-almoco/saida.
// Fallback: se só houver entrada + saida, usa o intervalo inteiro.
function workedMinutes(list: TodayPunch[]): number {
  const byT = (t: TodayPunch['tipo']) => list.find((p) => p.tipo === t);
  const e = byT('entrada'); const sa = byT('saida-almoco');
  const va = byT('volta-almoco'); const s = byT('saida');
  let total = 0;
  if (e && sa) total += (new Date(sa.timestamp).getTime() - new Date(e.timestamp).getTime()) / 60000;
  if (va && s) total += (new Date(s.timestamp).getTime() - new Date(va.timestamp).getTime()) / 60000;
  if (!sa && !va && e && s) total += (new Date(s.timestamp).getTime() - new Date(e.timestamp).getTime()) / 60000;
  return Math.max(0, Math.round(total));
}

function previstoDia(j?: JornadaMini | null): number {
  if (!j) return 0;
  const e = hhmmToMin(j.entrada); const sa = hhmmToMin(j.saida_almoco);
  const va = hhmmToMin(j.volta_almoco); const s = hhmmToMin(j.saida);
  if (e == null || s == null) return 0;
  if (sa != null && va != null) return (sa - e) + (s - va);
  return s - e;
}

export default function PontoMobileEspelho() {
  const user = useMemo(() => currentUser(), []);
  const funcionarioId = user?.funcionario_id || user?.id;
  const [ref, setRef] = useState(() => new Date());
  const [punches, setPunches] = useState<TodayPunch[]>([]);
  const [func, setFunc] = useState<FuncionarioMini | null>(null);
  const [jornada, setJornada] = useState<JornadaMini | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Carrega funcionário + jornada 1x (independente do mês selecionado)
  useEffect(() => {
    let active = true;
    if (!funcionarioId) return;
    (async () => {
      try {
        const [f, jList] = await Promise.all([
          getMyFuncionario(funcionarioId),
          listJornadas().catch(() => [] as JornadaMini[]),
        ]);
        if (!active) return;
        setFunc(f);
        setJornada(jList.find((j) => j.id === f.jornada_id) ?? null);
      } catch {
        /* saldo/jornada são secundários — não bloqueia a tela */
      }
    })();
    return () => { active = false; };
  }, [funcionarioId, reloadKey]);

  useEffect(() => {
    let active = true;
    if (!funcionarioId) {
      setLoading(false);
      setError('Sessão expirada. Entre novamente para ver seus registros.');
      return;
    }
    setLoading(true);
    setError(null);
    listMonthPunches(funcionarioId, ref)
      .then((data) => { if (active) setPunches(data); })
      .catch((e) => {
        if (!active) return;
        const message = e instanceof Error ? e.message : 'Erro ao carregar espelho';
        setError(/Failed to fetch|NetworkError|insufficient/i.test(message)
          ? 'Não foi possível carregar o espelho agora. Verifique a conexão e tente novamente.'
          : message);
        toast.error('Espelho não carregou', { description: message });
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [funcionarioId, ref, reloadKey]);

  const grouped = useMemo(() => {
    const map = new Map<string, TodayPunch[]>();
    for (const p of punches) {
      const key = new Date(p.timestamp).toISOString().slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return Array.from(map.entries())
      .map(([k, list]) => ({
        key: k,
        list: list.sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1)),
      }))
      .sort((a, b) => (a.key < b.key ? 1 : -1));
  }, [punches]);

  // Resumo do mês (trabalhado, saldo, previsto)
  const resumo = useMemo(() => {
    const diaPrev = previstoDia(jornada);
    let trabMin = 0;
    let previstoMin = 0;
    let diasComPar = 0;
    let melhorDia = 0;
    for (const g of grouped) {
      const w = workedMinutes(g.list);
      if (w > 0) { trabMin += w; diasComPar += 1; melhorDia = Math.max(melhorDia, w); }
      if (jornada) {
        const dow = new Date(g.key + 'T00:00:00').getDay();
        if (jornada.dias_semana?.includes(dow)) previstoMin += diaPrev;
      }
    }
    return {
      trabMin,
      previstoMin,
      diasComPar,
      melhorDia,
      saldoMes: jornada ? trabMin - previstoMin : null,
    };
  }, [grouped, jornada]);

  const bancoMin = func?.banco_horas_min ?? 0;

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
          className="flex h-10 w-10 items-center justify-center rounded-xl text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
          className="flex h-10 w-10 items-center justify-center rounded-xl text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Cards principais: Horas trabalhadas + Banco de horas */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-gradient-to-br from-primary to-primary/80 p-4 text-primary-foreground shadow-sm">
          <div className="flex items-center gap-1.5 text-[11px] font-medium opacity-90">
            <Clock3 className="h-3.5 w-3.5" /> Trabalhado no mês
          </div>
          <p className="pm-numeric mt-1.5 text-2xl font-bold leading-none">{fmtHm(resumo.trabMin)}</p>
          <p className="mt-1.5 text-[11px] opacity-80">
            {resumo.diasComPar} {resumo.diasComPar === 1 ? 'dia' : 'dias'} · pico {fmtHm(resumo.melhorDia)}
          </p>
        </div>
        <div className="rounded-2xl bg-card p-4 shadow-sm">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <Wallet className="h-3.5 w-3.5" /> Banco de horas
          </div>
          <p className={`pm-numeric mt-1.5 text-2xl font-bold leading-none ${bancoMin >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {bancoMin >= 0 ? '+' : ''}{fmtHm(bancoMin)}
          </p>
          <p className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
            {bancoMin >= 0
              ? <><TrendingUp className="h-3 w-3 text-emerald-600" /> Saldo a compensar</>
              : <><TrendingDown className="h-3 w-3 text-rose-600" /> Horas devidas</>}
          </p>
        </div>
      </div>

      {/* Cards secundários */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-card p-3 shadow-sm">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Previsto</p>
          <p className="pm-numeric mt-1 text-base font-bold text-foreground">
            {jornada ? fmtHm(resumo.previstoMin) : '—'}
          </p>
        </div>
        <div className="rounded-2xl bg-card p-3 shadow-sm">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Saldo do mês</p>
          <p className={`pm-numeric mt-1 text-base font-bold ${
            resumo.saldoMes == null ? 'text-foreground' : resumo.saldoMes >= 0 ? 'text-emerald-600' : 'text-rose-600'
          }`}>
            {resumo.saldoMes == null ? '—' : `${resumo.saldoMes >= 0 ? '+' : ''}${fmtHm(resumo.saldoMes)}`}
          </p>
        </div>
        <div className="rounded-2xl bg-card p-3 shadow-sm">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Batidas</p>
          <p className="pm-numeric mt-1 text-base font-bold text-foreground">{punches.length}</p>
        </div>
      </div>

      {!jornada && !loading && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
          <CalendarCheck2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Você ainda não tem jornada atribuída. Peça ao gestor para vincular uma jornada — sem ela, previsto e saldo do mês não são calculados.
        </div>
      )}

      {/* Lista */}
      <section>
        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-destructive/20 bg-card p-5 text-center shadow-sm">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertCircle className="h-5 w-5" />
            </div>
            <p className="mt-3 text-sm font-semibold text-foreground">Não conseguimos carregar seus registros.</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{error}</p>
            <button
              onClick={() => setReloadKey((v) => v + 1)}
              className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <RefreshCw className="h-4 w-4" />
              Tentar novamente
            </button>
          </div>
        ) : grouped.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center">
            <p className="text-sm text-muted-foreground">Nenhum registro neste mês.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {grouped.map(({ key, list }) => {
              const d = new Date(key + 'T00:00:00');
              const w = workedMinutes(list);
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
                    <div className="text-right">
                      <p className="pm-numeric text-sm font-bold text-foreground">{w > 0 ? fmtHm(w) : '—'}</p>
                      <p className="pm-numeric text-[11px] font-medium text-muted-foreground">
                        {list.length} {list.length === 1 ? 'batida' : 'batidas'}
                      </p>
                    </div>
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
