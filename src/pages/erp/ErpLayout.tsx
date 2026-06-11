/**
 * ERP Shell — layout dedicado para o módulo ERP.
 * Sidebar fixa com identidade própria (Indigo/Slate) para diferenciar visualmente
 * do sistema principal de roteirização (Azul). Compartilha dados via API.
 */
import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, FileText, ClipboardList, Users, Boxes, Building2,
  ExternalLink, AlertTriangle, ArrowLeft, Sparkles, DollarSign,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { serviceOrdersService } from '@/services/quotes';

const navItems = [
  { to: '/erp', label: 'Painel', icon: LayoutDashboard, end: true },
  { to: '/erp/orcamentos', label: 'Orçamentos', icon: FileText },
  { to: '/erp/ordens-servico', label: 'Ordens de Serviço', icon: ClipboardList, badge: 'overdue' as const },
  { to: '/erp/financeiro', label: 'Financeiro', icon: DollarSign },
  { to: '/erp/clientes', label: 'Clientes', icon: Users },
  { to: '/erp/estoque', label: 'Estoque & Insumos', icon: Boxes },
  { to: '/erp/empresas', label: 'Empresas Emissoras', icon: Building2 },
];

const ErpLayout: React.FC = () => {
  const [overdue, setOverdue] = useState(0);
  const location = useLocation();

  useEffect(() => {
    let mounted = true;
    const tick = async () => {
      try {
        const r = await serviceOrdersService.overdueCount();
        if (mounted) setOverdue(r.overdue || 0);
      } catch {}
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-gradient-to-b from-slate-900 via-slate-900 to-indigo-950 text-slate-100 border-r border-slate-800 sticky top-0 h-screen">
        <div className="px-5 py-5 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-900/40">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight">ERP Suite</h1>
              <p className="text-[10px] uppercase tracking-wider text-indigo-300/80">Locação & Gestão</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-indigo-600/30 to-indigo-500/10 text-white border border-indigo-500/40 shadow-sm'
                      : 'text-slate-300 hover:bg-slate-800/70 hover:text-white border border-transparent'
                  }`
                }
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className="flex-1 truncate">{item.label}</span>
                {item.badge === 'overdue' && overdue > 0 && (
                  <Badge className="bg-red-500/90 text-white text-[10px] h-5 gap-1 px-1.5">
                    <AlertTriangle className="h-3 w-3" />{overdue}
                  </Badge>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-800/80 space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 px-2">Integração</p>
          <NavLink
            to="/"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-300 hover:bg-slate-800/70 hover:text-white transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="flex-1">Sistema Principal</span>
            <ExternalLink className="h-3 w-3 opacity-60" />
          </NavLink>
          <p className="text-[10px] text-slate-500 px-2 leading-snug">
            ERP conectado em tempo real ao AlchemyRotas — clientes, sanitários e frota são compartilhados.
          </p>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-slate-900 text-white border-b border-slate-800">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="h-8 w-8 rounded-md bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <h1 className="text-sm font-bold leading-none">ERP Suite</h1>
            <p className="text-[10px] text-indigo-300/80">Locação & Gestão</p>
          </div>
          <NavLink to="/" className="text-xs text-slate-300 flex items-center gap-1">
            <ArrowLeft className="h-3.5 w-3.5" /> App
          </NavLink>
        </div>
        <nav className="flex overflow-x-auto px-2 pb-2 gap-1 no-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs whitespace-nowrap ${
                    isActive ? 'bg-indigo-600 text-white' : 'bg-slate-800/60 text-slate-300'
                  }`
                }
              >
                <Icon className="h-3.5 w-3.5" /> {item.label}
                {item.badge === 'overdue' && overdue > 0 && (
                  <span className="ml-1 bg-red-500 text-white text-[10px] rounded px-1">{overdue}</span>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Content */}
      <main key={location.pathname} className="flex-1 min-w-0 pt-[88px] md:pt-0">
        <Outlet />
      </main>
    </div>
  );
};

export default ErpLayout;
