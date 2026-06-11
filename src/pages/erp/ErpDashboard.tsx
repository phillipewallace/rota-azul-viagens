/**
 * ERP Dashboard — visão executiva com KPIs e atalhos.
 * Consome dados das mesmas APIs do sistema principal (sanitários, clientes, OS).
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText, ClipboardList, Users, Boxes, AlertTriangle, TrendingUp,
  Loader2, ArrowRight, Building2, Activity, DollarSign,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { quotesService, serviceOrdersService } from '@/services/quotes';
import { erpService, fetchSanitarioStockSummary, SanitarioStockSummary } from '@/services/erp';
import { useCustomers } from '@/hooks/useCustomers';

const BRL = (n: number) =>
  (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

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

  const receitaAberta = os.filter((x) => x.status === 'aberta').reduce((a, b) => a + Number(b.valorTotal || 0), 0);
  const receitaFechada = os.filter((x) => x.status === 'fechada').reduce((a, b) => a + Number(b.valorTotal || 0), 0);
  const orcAprovados = quotes.filter((q) => q.status === 'aprovado').length;
  const orcRascunho = quotes.filter((q) => q.status === 'rascunho').length;
  const orcEnviados = quotes.filter((q) => q.status === 'enviado').length;

  const kpis = [
    { label: 'Receita em Aberto', value: BRL(receitaAberta), icon: DollarSign, accent: 'from-indigo-500 to-purple-600' },
    { label: 'Receita Fechada', value: BRL(receitaFechada), icon: TrendingUp, accent: 'from-emerald-500 to-teal-600' },
    { label: 'Orçamentos Ativos', value: String(orcRascunho + orcEnviados), icon: FileText, accent: 'from-amber-500 to-orange-600' },
    { label: 'OS em Atraso', value: String(overdue), icon: AlertTriangle, accent: 'from-rose-500 to-red-600', alert: overdue > 0 },
  ];

  const modules = [
    { to: '/erp/orcamentos', icon: FileText, title: 'Orçamentos', desc: `${quotes.length} no total · ${orcAprovados} aprovados`, color: 'text-indigo-600' },
    { to: '/erp/ordens-servico', icon: ClipboardList, title: 'Ordens de Serviço', desc: `${os.filter(x => x.status === 'aberta').length} abertas · ${overdue} atrasadas`, color: 'text-violet-600' },
    { to: '/erp/clientes', icon: Users, title: 'Clientes', desc: `${customers.length} cadastrados`, color: 'text-emerald-600' },
    { to: '/erp/estoque', icon: Boxes, title: 'Estoque & Insumos', desc: `${items} itens controlados`, color: 'text-amber-600' },
    { to: '/erp/empresas', icon: Building2, title: 'Empresas Emissoras', desc: 'CNPJs para emissão de orçamentos', color: 'text-blue-600' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin mr-2" /> Carregando painel...
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <header className="mb-8">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-indigo-600 font-semibold mb-1">
          <Activity className="h-3.5 w-3.5" /> Visão Geral
        </div>
        <h1 className="text-3xl font-bold text-slate-900">Bem-vindo ao ERP Suite</h1>
        <p className="text-slate-500 mt-1">
          Painel consolidado · dados sincronizados em tempo real com o AlchemyRotas.
        </p>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.label} className={`border-0 shadow-md overflow-hidden ${k.alert ? 'ring-2 ring-red-300' : ''}`}>
              <CardContent className="p-0">
                <div className={`bg-gradient-to-br ${k.accent} p-4 text-white`}>
                  <div className="flex items-center justify-between mb-2">
                    <Icon className="h-5 w-5 opacity-80" />
                    {k.alert && <Badge className="bg-white/20 text-white border-0 text-[10px]">ATENÇÃO</Badge>}
                  </div>
                  <p className="text-xs uppercase tracking-wider opacity-80">{k.label}</p>
                  <p className="text-2xl font-bold mt-1">{k.value}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Stock summary if available */}
      {stock && (
        <Card className="mb-8 border-0 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Sanitários · Estoque em tempo real</h2>
                <p className="text-xs text-slate-500">Sincronizado com o sistema principal</p>
              </div>
              <Link to="/sanitarios" className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
                Ver detalhes <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { l: 'Total', v: stock.total, c: 'bg-slate-100 text-slate-700' },
                { l: 'Disponíveis', v: stock.disponivel, c: 'bg-emerald-100 text-emerald-700' },
                { l: 'Em Cliente', v: stock.em_cliente, c: 'bg-blue-100 text-blue-700' },
                { l: 'Em OS', v: stock.em_os || 0, c: 'bg-indigo-100 text-indigo-700' },
                { l: 'Manutenção', v: stock.manutencao, c: 'bg-amber-100 text-amber-700' },
              ].map((s) => (
                <div key={s.l} className={`rounded-lg px-3 py-2.5 ${s.c}`}>
                  <p className="text-[11px] uppercase tracking-wide opacity-80">{s.l}</p>
                  <p className="text-xl font-bold">{s.v}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modules grid */}
      <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3">Módulos</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {modules.map((m) => {
          const Icon = m.icon;
          return (
            <Link key={m.to} to={m.to} className="group">
              <Card className="h-full border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className={`h-10 w-10 rounded-lg bg-slate-50 flex items-center justify-center ${m.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
                  </div>
                  <h3 className="font-semibold text-slate-900">{m.title}</h3>
                  <p className="text-xs text-slate-500 mt-1">{m.desc}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="mt-8 p-4 rounded-lg bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100">
        <p className="text-xs text-indigo-900">
          <strong>Integração:</strong> Este ERP compartilha clientes, sanitários e frota com o AlchemyRotas.
          Toda OS criada aqui reserva sanitários do estoque real, e o fechamento devolve automaticamente ao sistema principal.
        </p>
      </div>
    </div>
  );
};

export default ErpDashboard;
