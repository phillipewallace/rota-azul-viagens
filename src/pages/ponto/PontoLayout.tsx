/**
 * Shell do módulo Ponto Eletrônico.
 * Identidade própria (teal/emerald) para diferenciar do sistema principal (azul)
 * e do ERP (indigo/purple). Segue tokens semânticos do design system.
 */
import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Clock, FileCheck2, Scale, BarChart3, Settings2, Timer,
} from 'lucide-react';

const navItems = [
  { to: '/ponto', label: 'Painel', icon: LayoutDashboard, end: true },
  { to: '/ponto/registros', label: 'Registros', icon: Clock },
  { to: '/ponto/espelho', label: 'Espelho de Ponto', icon: FileCheck2 },
  { to: '/ponto/justificativas', label: 'Justificativas', icon: Scale },
  { to: '/ponto/banco-horas', label: 'Banco de Horas', icon: Timer },
  { to: '/ponto/funcionarios', label: 'Funcionários', icon: Users },
  { to: '/ponto/relatorios', label: 'Relatórios', icon: BarChart3 },
  { to: '/ponto/configuracoes', label: 'Configurações', icon: Settings2 },
];

const PontoLayout: React.FC = () => {
  const location = useLocation();

  return (
    <div className="min-h-screen flex bg-muted/30">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex flex-col w-64 sticky top-0 h-screen border-r border-border bg-[hsl(var(--sidebar-background,220_25%_9%))] text-slate-100">
        <div className="px-5 py-5 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-teal-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-900/40">
              <Timer className="h-5 w-5 text-white" strokeWidth={2.4} />
            </div>
            <div>
              <h1 className="font-display text-base font-bold tracking-tight">Ponto Digital</h1>
              <p className="text-[10px] uppercase tracking-[0.14em] text-emerald-300/80">Portaria 671 · REP-P</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 border ${
                  isActive
                    ? 'bg-gradient-to-r from-emerald-500/25 to-teal-500/5 text-white border-emerald-400/40 shadow-sm shadow-emerald-900/30'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white border-transparent'
                }`
              }
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span className="flex-1 truncate">{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-white/5">
          <p className="text-[10px] text-slate-500 px-2 leading-snug">
            REP-P homologável · assinatura SHA-256 nos registros · exporta AFD / AEJ conforme Portaria MTP 671/2021.
          </p>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-[hsl(var(--sidebar-background,220_25%_9%))] text-white border-b border-white/5">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="h-8 w-8 rounded-md bg-gradient-to-br from-teal-400 to-emerald-600 flex items-center justify-center">
            <Timer className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <h1 className="text-sm font-bold leading-none">Ponto Digital</h1>
            <p className="text-[10px] text-emerald-300/80">Portaria 671 · REP-P</p>
          </div>
        </div>
        <nav className="flex overflow-x-auto px-2 pb-2 gap-1 no-scrollbar">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs whitespace-nowrap transition-colors ${
                  isActive ? 'bg-emerald-500 text-white' : 'bg-white/5 text-slate-300'
                }`
              }
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Content */}
      <main key={location.pathname} className="flex-1 min-w-0 pt-[88px] md:pt-0">
        <Outlet />
      </main>
    </div>
  );
};

export default PontoLayout;
