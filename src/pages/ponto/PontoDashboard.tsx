/**
 * Painel do Ponto Eletrônico. KPIs, gráfico semanal, presença ao vivo,
 * pendências e atalhos para módulos. 100% via tokens semânticos.
 */
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, UserCheck, UserX, AlertCircle, Timer, TrendingUp, ArrowRight, Clock,
  Scale, BarChart3, FileCheck2, Settings2, ShieldCheck, Fingerprint,
  Cake, Umbrella, ClockAlert, CalendarClock,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from 'recharts';
import {
  EMPLOYEES, PUNCHES, JUSTIFICATIONS, JORNADAS, computeDay, minutesToHHmm, groupPunchesByDay,
  employeesMissingPunchToday, aniversariantesProximos, feriasVencendo, daysBetween,
} from './pontoMock';

const weekDays = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

const PontoDashboard: React.FC = () => {
  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const punchesToday = PUNCHES.filter((p) => p.timestamp.startsWith(today));
    const presentIds = new Set(
      punchesToday.filter((p) => p.tipo === 'entrada').map((p) => p.employeeId)
    );
    const leftIds = new Set(
      punchesToday.filter((p) => p.tipo === 'saida').map((p) => p.employeeId)
    );
    const ativos = EMPLOYEES.filter((e) => e.status === 'ativo').length;
    return {
      totalAtivos: ativos,
      presentes: [...presentIds].filter((id) => !leftIds.has(id)).length,
      ausentes: ativos - presentIds.size,
      pendencias: JUSTIFICATIONS.filter((j) => j.status === 'pendente').length,
    };
  }, []);

  const weekChart = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (6 - i));
      const iso = d.toISOString().slice(0, 10);
      const byEmp = new Map<string, ReturnType<typeof computeDay>>();
      EMPLOYEES.forEach((e) => {
        const j = JORNADAS.find((x) => x.id === e.jornadaId)!;
        const pts = PUNCHES.filter((p) => p.employeeId === e.id && p.timestamp.startsWith(iso));
        if (pts.length) byEmp.set(e.id, computeDay(pts, j, iso));
      });
      const trabalhado = [...byEmp.values()].reduce((a, b) => a + b.trabalhado, 0);
      const extras = [...byEmp.values()].reduce((a, b) => a + b.extra, 0);
      return {
        day: weekDays[d.getDay()],
        date: iso.slice(8, 10),
        horas: +(trabalhado / 60).toFixed(1),
        extras: +(extras / 60).toFixed(1),
      };
    });
  }, []);

  const liveActivity = useMemo(() => {
    return [...PUNCHES]
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, 8)
      .map((p) => ({
        ...p,
        employee: EMPLOYEES.find((e) => e.id === p.employeeId)!,
      }));
  }, []);

  const overtime = useMemo(() => {
    return EMPLOYEES.filter((e) => e.status === 'ativo')
      .map((e) => ({ e, bh: e.bancoHoras }))
      .sort((a, b) => b.bh - a.bh)
      .slice(0, 5);
  }, []);

  const modules = [
    { to: '/ponto/registros', label: 'Registros', desc: 'Todas as batidas em tempo real', icon: Clock, tint: 'from-sky-500/20 to-cyan-500/5', ring: 'ring-sky-500/30' },
    { to: '/ponto/espelho', label: 'Espelho de Ponto', desc: 'Detalhamento diário por funcionário', icon: FileCheck2, tint: 'from-emerald-500/20 to-teal-500/5', ring: 'ring-emerald-500/30' },
    { to: '/ponto/justificativas', label: 'Justificativas', desc: 'Abonar atrasos, faltas e atestados', icon: Scale, tint: 'from-amber-500/20 to-orange-500/5', ring: 'ring-amber-500/30' },
    { to: '/ponto/banco-horas', label: 'Banco de Horas', desc: 'Créditos, débitos e compensações', icon: Timer, tint: 'from-violet-500/20 to-indigo-500/5', ring: 'ring-violet-500/30' },
    { to: '/ponto/relatorios', label: 'Relatórios', desc: 'AFD, AEJ, espelho oficial em PDF', icon: BarChart3, tint: 'from-rose-500/20 to-pink-500/5', ring: 'ring-rose-500/30' },
    { to: '/ponto/configuracoes', label: 'Configurações', desc: 'Jornadas, empresas e permissões', icon: Settings2, tint: 'from-slate-500/20 to-slate-500/5', ring: 'ring-slate-500/30' },
  ];

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-[1600px] mx-auto">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl p-6 md:p-8 bg-gradient-to-br from-emerald-600 via-teal-700 to-emerald-900 text-white shadow-xl">
        <div className="absolute -top-20 -right-16 h-64 w-64 rounded-full bg-emerald-300/20 blur-3xl" />
        <div className="absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-teal-400/20 blur-3xl" />
        <div className="relative flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur px-3 py-1 text-[11px] font-medium tracking-wide uppercase">
              <ShieldCheck className="h-3.5 w-3.5" /> Homologável Portaria MTP 671/2021
            </div>
            <h1 className="mt-4 font-display text-3xl md:text-4xl font-bold tracking-tight">Ponto Digital</h1>
            <p className="mt-2 text-emerald-50/90 max-w-xl text-sm md:text-base">
              Controle de jornada com REP-P conforme legislação brasileira. Geolocalização, NSR, assinatura digital e exportação de arquivos oficiais.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="rounded-xl bg-white/10 backdrop-blur border border-white/20 px-5 py-3 min-w-[130px]">
              <p className="text-[10px] uppercase tracking-wider text-emerald-100/80">Agora</p>
              <p className="font-display text-2xl font-bold tabular-nums">
                {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <div className="rounded-xl bg-white/10 backdrop-blur border border-white/20 px-5 py-3 min-w-[130px]">
              <p className="text-[10px] uppercase tracking-wider text-emerald-100/80">NSR emitidos</p>
              <p className="font-display text-2xl font-bold tabular-nums">{PUNCHES.length.toLocaleString('pt-BR')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* KPIs */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Funcionários ativos', value: stats.totalAtivos, icon: Users, accent: 'bg-primary', tint: 'from-primary/10' },
          { label: 'Presentes agora', value: stats.presentes, icon: UserCheck, accent: 'bg-emerald-500', tint: 'from-emerald-500/10' },
          { label: 'Ausentes hoje', value: stats.ausentes, icon: UserX, accent: 'bg-rose-500', tint: 'from-rose-500/10' },
          { label: 'Pendências RH', value: stats.pendencias, icon: AlertCircle, accent: 'bg-amber-500', tint: 'from-amber-500/10' },
        ].map((k) => (
          <Card key={k.label} className={`relative overflow-hidden border-border/60 bg-gradient-to-br ${k.tint} to-transparent`}>
            <div className={`absolute top-0 left-0 right-0 h-1 ${k.accent}`} />
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{k.label}</p>
                  <p className="font-display text-3xl font-bold tabular-nums mt-2">{k.value}</p>
                </div>
                <div className={`h-10 w-10 rounded-lg ${k.accent} bg-opacity-15 flex items-center justify-center`}>
                  <k.icon className="h-5 w-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      {/* Chart + Live */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 border-border/60">
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-display text-base font-semibold">Horas trabalhadas · últimos 7 dias</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Total consolidado da equipe</p>
              </div>
              <Badge variant="secondary" className="gap-1">
                <TrendingUp className="h-3 w-3" /> Semana
              </Badge>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weekChart} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="horas" name="Trabalhadas" radius={[6, 6, 0, 0]}>
                    {weekChart.map((_, i) => (
                      <Cell key={i} fill="hsl(var(--primary))" />
                    ))}
                  </Bar>
                  <Bar dataKey="extras" name="Extras" radius={[6, 6, 0, 0]} fill="hsl(var(--warning, 38 92% 50%))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-display text-base font-semibold">Atividade ao vivo</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Últimas batidas registradas</p>
              </div>
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75 animate-ping" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
              </span>
            </div>
            <ul className="space-y-3">
              {liveActivity.map((p) => (
                <li key={p.id} className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-gradient-to-br from-teal-400 to-emerald-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {p.employee.nome.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.employee.nome}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {p.tipo.replace('-', ' ')} · {p.origem}
                    </p>
                  </div>
                  <span className="text-xs tabular-nums text-muted-foreground shrink-0">
                    {new Date(p.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>

      {/* Banco de horas + pendências */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-border/60">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-display text-base font-semibold">Top saldos · Banco de Horas</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Maiores créditos acumulados</p>
              </div>
              <Button asChild size="sm" variant="ghost" className="gap-1">
                <Link to="/ponto/banco-horas">Ver todos <ArrowRight className="h-3.5 w-3.5" /></Link>
              </Button>
            </div>
            <ul className="space-y-2.5">
              {overtime.map(({ e, bh }) => (
                <li key={e.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/60 transition-colors">
                  <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0">
                    {e.nome.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{e.nome}</p>
                    <p className="text-[11px] text-muted-foreground">{e.cargo}</p>
                  </div>
                  <div
                    className={`px-2.5 py-1 rounded-md text-xs font-bold tabular-nums ${
                      bh >= 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {bh >= 0 ? '+' : ''}{minutesToHHmm(bh)}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-display text-base font-semibold">Justificativas pendentes</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Aguardando análise do RH</p>
              </div>
              <Button asChild size="sm" variant="ghost" className="gap-1">
                <Link to="/ponto/justificativas">Analisar <ArrowRight className="h-3.5 w-3.5" /></Link>
              </Button>
            </div>
            <ul className="space-y-2.5">
              {JUSTIFICATIONS.filter((j) => j.status === 'pendente').map((j) => {
                const emp = EMPLOYEES.find((e) => e.id === j.employeeId)!;
                return (
                  <li key={j.id} className="flex items-start gap-3 p-2.5 rounded-lg border border-border/60 bg-amber-500/[0.03]">
                    <div className="h-9 w-9 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
                      <Fingerprint className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium">{emp.nome}</p>
                        <Badge variant="outline" className="capitalize text-[10px] px-1.5 py-0">{j.tipo}</Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{j.motivo}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {new Date(j.data).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </li>
                );
              })}
              {JUSTIFICATIONS.filter((j) => j.status === 'pendente').length === 0 && (
                <li className="text-sm text-muted-foreground text-center py-8">Nenhuma pendência 🎉</li>
              )}
            </ul>
          </CardContent>
        </Card>
      </section>

      {/* Módulos */}
      <section>
        <h3 className="font-display text-base font-semibold mb-3 px-1">Módulos</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {modules.map((m) => (
            <Link
              key={m.to}
              to={m.to}
              className={`group relative overflow-hidden rounded-xl border border-border/60 bg-card p-4 hover:shadow-lg hover:-translate-y-0.5 hover:ring-2 ${m.ring} transition-all duration-200`}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${m.tint} to-transparent opacity-60 pointer-events-none`} />
              <div className="relative flex items-start gap-3">
                <div className="h-11 w-11 rounded-lg bg-background/70 backdrop-blur border border-border/60 flex items-center justify-center shrink-0">
                  <m.icon className="h-5 w-5 text-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-semibold text-sm">{m.label}</p>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{m.desc}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
};

export default PontoDashboard;
