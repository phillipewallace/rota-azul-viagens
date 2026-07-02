/**
 * ERP Dashboard — visão executiva com KPIs e atalhos.
 * Redesign: hierarquia clara, tokens semânticos (dark mode "de graça"),
 * uso econômico da cor com accent primário apenas onde importa.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText, ClipboardList, Users, Boxes, AlertTriangle, TrendingUp,
  Loader2, ArrowUpRight, Building2, Activity, DollarSign, PackageCheck,
  TruckIcon, Wrench, Sparkles,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { quotesService, serviceOrdersService } from '@/services/quotes';
import { erpService, fetchSanitarioStockSummary, SanitarioStockSummary } from '@/services/erp';
import { useCustomers } from '@/hooks/useCustomers';

const BRL = (n: number) =>
  (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const NUM = (n: number) => (Number(n) || 0).toLocaleString('pt-BR');

// -----------------------------------------------------------------------------
// Building blocks
// -----------------------------------------------------------------------------

type Tone = 'default' | 'success' | 'warning' | 'destructive' | 'primary';

const toneStyles: Record<Tone, { chip: string; dot: string; ring: string }> = {
  default:    { chip: 'bg-muted text-muted-foreground',                dot: 'bg-muted-foreground/60', ring: '' },
  primary:    { chip: 'bg-primary/10 text-primary',                    dot: 'bg-primary',             ring: '' },
  success:    { chip: 'bg-success/10 text-success',                    dot: 'bg-success',             ring: '' },
  warning:    { chip: 'bg-warning/10 text-warning',                    dot: 'bg-warning',             ring: '' },
  destructive:{ chip: 'bg-destructive/10 text-destructive',            dot: 'bg-destructive',         ring: 'ring-1 ring-destructive/30' },
};

interface KpiProps {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: Tone;
  featured?: boolean;
}

const KpiCard: React.FC<KpiProps> = ({ label, value, hint, icon: Icon, tone = 'default', featured }) => {
  const t = toneStyles[tone];
  return (
    <Card
      className={cn(
        'group relative overflow-hidden border-border/60 bg-card transition-all duration-200',
        'hover:-translate-y-0.5 hover:shadow-lg hover:border-border',
        t.ring,
        featured && 'lg:col-span-2 lg:row-span-1',
      )}
    >
      <CardContent className={cn('p-5 md:p-6 flex flex-col gap-4', featured && 'md:p-7')}>
        <div className="flex items-start justify-between gap-3">
          <span className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider',
            t.chip,
          )}>
            <span className={cn('h-1.5 w-1.5 rounded-full', t.dot)} />
            {label}
          </span>
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
            <Icon className="h-4.5 w-4.5" />
          </span>
        </div>
        <div>
          <p className={cn(
            'font-display font-semibold tabular-nums tracking-tight text-foreground',
            featured ? 'text-4xl md:text-5xl' : 'text-3xl',
          )}>
            {value}
          </p>
          {hint && (
            <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">{hint}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

interface StockPillProps {
  label: string;
  value: number;
  tone?: Tone;
}

const StockPill: React.FC<StockPillProps> = ({ label, value, tone = 'default' }) => {
  const t = toneStyles[tone];
  return (
    <div className="rounded-lg border border-border/60 bg-card px-3 py-3 transition-colors hover:bg-muted/40">
      <div className="flex items-center gap-1.5">
        <span className={cn('h-1.5 w-1.5 rounded-full', t.dot)} />
        <p className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      </div>
      <p className="mt-1.5 font-display text-2xl font-semibold tabular-nums text-foreground">{NUM(value)}</p>
    </div>
  );
};

interface ModuleCardProps {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  meta?: string;
}

const ModuleCard: React.FC<ModuleCardProps> = ({ to, icon: Icon, title, desc, meta }) => (
  <Link
    to={to}
    className={cn(
      'group relative flex flex-col rounded-xl border border-border/60 bg-card p-5 transition-all duration-200',
      'hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    )}
  >
    <div className="flex items-start justify-between gap-3">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform duration-200 group-hover:scale-105">
        <Icon className="h-5 w-5" />
      </span>
      <ArrowUpRight className="h-4 w-4 text-muted-foreground/50 transition-all duration-200 group-hover:text-primary group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
    </div>
    <h3 className="mt-4 font-display text-base font-semibold text-foreground">{title}</h3>
    <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{desc}</p>
    {meta && (
      <p className="mt-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/80">{meta}</p>
    )}
  </Link>
);

// -----------------------------------------------------------------------------
// Skeleton
// -----------------------------------------------------------------------------

const Skeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('animate-pulse rounded-md bg-muted', className)} />
);

const DashboardSkeleton: React.FC = () => (
  <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
    <div className="space-y-3">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-9 w-80" />
      <Skeleton className="h-4 w-96" />
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-36" />)}
    </div>
    <Skeleton className="h-44" />
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[0, 1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-32" />)}
    </div>
  </div>
);

// -----------------------------------------------------------------------------
// Page
// -----------------------------------------------------------------------------

const ErpDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [os, setOs] = useState<any[]>([]);
  const [stock, setStock] = useState<SanitarioStockSummary | null>(null);
  const [items, setItems] = useState<number>(0);
  const [overdue, setOverdue] = useState(0);
  const { customers } = useCustomers();

  useEffect(() => {
    (async () => {
      try {
        const [q, o, s, it, ov] = await Promise.all([
          quotesService.list().catch(() => []),
          serviceOrdersService.list().catch(() => []),
          fetchSanitarioStockSummary().catch(() => null),
          erpService.listItems().then((x) => x.length).catch(() => 0),
          serviceOrdersService.overdueCount().then((r) => r.overdue).catch(() => 0),
        ]);
        setQuotes(q); setOs(o); setStock(s); setItems(it); setOverdue(ov);
      } finally { setLoading(false); }
    })();
  }, []);

  const {
    receitaAberta, receitaFechada, orcAprovados, orcRascunho, orcEnviados, osAbertas,
  } = useMemo(() => ({
    receitaAberta:  os.filter((x) => x.status === 'aberta').reduce((a, b) => a + Number(b.valorTotal || 0), 0),
    receitaFechada: os.filter((x) => x.status === 'fechada').reduce((a, b) => a + Number(b.valorTotal || 0), 0),
    orcAprovados:   quotes.filter((q) => q.status === 'aprovado').length,
    orcRascunho:    quotes.filter((q) => q.status === 'rascunho').length,
    orcEnviados:    quotes.filter((q) => q.status === 'enviado').length,
    osAbertas:      os.filter((x) => x.status === 'aberta').length,
  }), [os, quotes]);

  const modules: ModuleCardProps[] = [
    {
      to: '/erp/orcamentos', icon: FileText, title: 'Orçamentos',
      desc: `${NUM(quotes.length)} no total`,
      meta: `${orcAprovados} aprovados · ${orcEnviados} enviados`,
    },
    {
      to: '/erp/ordens-servico', icon: ClipboardList, title: 'Ordens de Serviço',
      desc: `${osAbertas} em andamento`,
      meta: overdue > 0 ? `${overdue} em atraso` : 'nenhuma em atraso',
    },
    {
      to: '/erp/contratos', icon: PackageCheck, title: 'Contratos',
      desc: 'Locação recorrente e eventos',
      meta: 'gestão de vigências',
    },
    {
      to: '/erp/financeiro', icon: DollarSign, title: 'Financeiro',
      desc: 'Recibos, pendentes e recebimentos',
      meta: 'competência mensal',
    },
    {
      to: '/erp/clientes', icon: Users, title: 'Clientes',
      desc: `${NUM(customers.length)} cadastrados`,
      meta: 'cadastro unificado',
    },
    {
      to: '/erp/estoque', icon: Boxes, title: 'Estoque & Insumos',
      desc: `${NUM(items)} itens controlados`,
      meta: 'consumo por OS',
    },
    {
      to: '/erp/empresas', icon: Building2, title: 'Empresas Emissoras',
      desc: 'CNPJs para emissão de documentos',
      meta: 'assinatura e logo',
    },
  ];

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      {/* Header ---------------------------------------------------------- */}
      <header className="mb-8 md:mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
            <Activity className="h-3.5 w-3.5" /> Visão Geral
          </div>
          <h1 className="font-display text-3xl md:text-[2.25rem] font-semibold tracking-tight text-foreground">
            Painel do ERP
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground max-w-xl leading-relaxed">
            Consolidado financeiro e operacional, sincronizado em tempo real com o AlchemyRotas.
          </p>
        </div>
        {overdue > 0 && (
          <Link
            to="/erp/ordens-servico"
            className={cn(
              'group inline-flex items-center gap-2.5 self-start rounded-lg border border-destructive/30',
              'bg-destructive/5 px-3.5 py-2.5 text-sm text-destructive transition-colors',
              'hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40',
            )}
          >
            <AlertTriangle className="h-4 w-4" />
            <span className="font-medium">{overdue} OS em atraso</span>
            <ArrowUpRight className="h-3.5 w-3.5 opacity-70 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        )}
      </header>

      {/* KPIs ------------------------------------------------------------ */}
      <section className="mb-8 md:mb-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Receita fechada"
            value={BRL(receitaFechada)}
            hint="Somatório de OS finalizadas no período"
            icon={TrendingUp}
            tone="success"
          />
          <KpiCard
            label="Receita em aberto"
            value={BRL(receitaAberta)}
            hint={`${osAbertas} OS aguardando fechamento`}
            icon={DollarSign}
            tone="primary"
          />
          <KpiCard
            label="Orçamentos ativos"
            value={NUM(orcRascunho + orcEnviados)}
            hint={`${orcAprovados} aprovados · ${orcRascunho} rascunhos`}
            icon={FileText}
            tone="default"
          />
          <KpiCard
            label="OS em atraso"
            value={NUM(overdue)}
            hint={overdue > 0 ? 'Requer atenção imediata' : 'Tudo em dia, ótimo trabalho.'}
            icon={AlertTriangle}
            tone={overdue > 0 ? 'destructive' : 'success'}
          />
        </div>
      </section>

      {/* Estoque de sanitários ------------------------------------------ */}
      {stock && (
        <section className="mb-8 md:mb-10">
          <Card className="border-border/60 bg-card">
            <CardContent className="p-5 md:p-6">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <TruckIcon className="h-4.5 w-4.5" />
                  </span>
                  <div>
                    <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-foreground">
                      Sanitários · Estoque em tempo real
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Sincronizado com o sistema principal
                    </p>
                  </div>
                </div>
                <Link
                  to="/sanitarios"
                  className={cn(
                    'group inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-primary',
                    'transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  )}
                >
                  Ver detalhes
                  <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </Link>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <StockPill label="Total"        value={stock.total}              tone="default" />
                <StockPill label="Disponíveis"  value={stock.disponivel}         tone="success" />
                <StockPill label="Em Cliente"   value={stock.em_cliente}         tone="primary" />
                <StockPill label="Em OS"        value={stock.em_os || 0}         tone="primary" />
                <StockPill label="Manutenção"   value={stock.manutencao}         tone="warning" />
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Módulos --------------------------------------------------------- */}
      <section className="mb-8 md:mb-10">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-foreground">
            Módulos
          </h2>
          <span className="text-xs text-muted-foreground">{modules.length} áreas</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map((m) => (
            <ModuleCard key={m.to} {...m} />
          ))}
        </div>
      </section>

      {/* Integração ------------------------------------------------------ */}
      <section>
        <div className={cn(
          'relative overflow-hidden rounded-xl border border-primary/20 bg-primary/5 p-5 md:p-6',
        )}>
          <div className="flex items-start gap-4">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </span>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-sm font-semibold text-foreground">Integração AlchemyRotas</h3>
                <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">Ativa</Badge>
              </div>
              <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed max-w-3xl">
                Este ERP compartilha clientes, sanitários e frota com o AlchemyRotas.
                Toda OS criada aqui reserva sanitários do estoque real, e o fechamento devolve
                automaticamente ao sistema principal.
              </p>
            </div>
            <Wrench className="hidden md:block h-5 w-5 text-primary/40" />
          </div>
        </div>
      </section>
    </div>
  );
};

export default ErpDashboard;
