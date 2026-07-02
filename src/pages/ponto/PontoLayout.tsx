/**
 * Shell do módulo Ponto Eletrônico.
 * Sidebar "Clean white + emerald": superfície clara, CTA "Bater ponto" em destaque,
 * navegação agrupada (Operacional / Administração), estado ativo com pill emerald,
 * rodapé de compliance REP-P.
 */
import React, { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Clock, FileCheck2, Scale, BarChart3, Settings2, Timer,
  ShieldCheck, Menu, X, Fingerprint, Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NotificationsBell } from '@/components/ponto/NotificationsBell';

type NavItem = { to: string; label: string; icon: React.ComponentType<{ className?: string }>; end?: boolean };

const operationalItems: NavItem[] = [
  { to: '/ponto', label: 'Painel', icon: LayoutDashboard, end: true },
  { to: '/ponto/registros', label: 'Registros', icon: Clock },
  { to: '/ponto/espelho', label: 'Espelho de Ponto', icon: FileCheck2 },
  { to: '/ponto/justificativas', label: 'Justificativas', icon: Scale },
  { to: '/ponto/banco-horas', label: 'Banco de Horas', icon: Timer },
];

const adminItems: NavItem[] = [
  { to: '/ponto/funcionarios', label: 'Funcionários', icon: Users },
  { to: '/ponto/fechamento', label: 'Fechamento', icon: Lock },
  { to: '/ponto/relatorios', label: 'Relatórios', icon: BarChart3 },
  { to: '/ponto/configuracoes', label: 'Configurações', icon: Settings2 },
];

const SidebarBody: React.FC<{ onNavigate?: () => void }> = ({ onNavigate }) => {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    [
      'group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium',
      'transition-colors duration-150 outline-none',
      'focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-offset-1 focus-visible:ring-offset-background',
      isActive
        ? 'bg-emerald-50 text-emerald-700 font-semibold dark:bg-emerald-500/10 dark:text-emerald-300'
        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-100',
    ].join(' ');

  return (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="p-5 flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center flex-shrink-0 shadow-sm shadow-emerald-600/20">
          <Timer className="w-5 h-5 text-white" strokeWidth={2.4} />
        </div>
        <div className="min-w-0">
          <h1 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight tracking-tight">Ponto Digital</h1>
          <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-[0.14em] mt-0.5">
            Portaria 671 · REP-P
          </p>
        </div>
      </div>

      {/* Primary CTA */}
      <div className="px-5 pb-5">
        <NavLink to="/ponto" end onClick={onNavigate}>
          <Button
            type="button"
            className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-md shadow-emerald-600/20 transition-all duration-200 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-emerald-500/50"
          >
            <Fingerprint className="w-4 h-4 mr-2" strokeWidth={2.2} />
            Bater ponto
          </Button>
        </NavLink>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 space-y-6">
        <div>
          <p className="px-3 mb-2 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.14em]">
            Operacional
          </p>
          <ul className="space-y-1">
            {operationalItems.map(({ to, label, icon: Icon, end }) => (
              <li key={to}>
                <NavLink to={to} end={end} onClick={onNavigate} className={linkClass}>
                  {({ isActive }) => (
                    <>
                      <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? '' : 'opacity-70'}`} />
                      <span className="flex-1 truncate">{label}</span>
                      {isActive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="px-3 mb-2 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.14em]">
            Administração
          </p>
          <ul className="space-y-1">
            {adminItems.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <NavLink to={to} onClick={onNavigate} className={linkClass}>
                  {({ isActive }) => (
                    <>
                      <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? '' : 'opacity-70'}`} />
                      <span className="flex-1 truncate">{label}</span>
                      {isActive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* Compliance Footer */}
      <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40">
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" strokeWidth={2.2} />
          <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-tight">
            Em conformidade
          </span>
        </div>
        <p className="text-[10px] text-slate-500 dark:text-slate-500 leading-relaxed">
          Sistema adequado à <strong className="font-semibold text-slate-600 dark:text-slate-400">Portaria 671 · MTP</strong>,
          assinatura SHA-256 e exportação AFD/AEJ.
        </p>
      </div>
    </div>
  );
};

const PontoLayout: React.FC = () => {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-slate-100 dark:bg-slate-950">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-64 sticky top-0 h-screen bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-900/5">
        <SidebarBody />
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-40 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3 px-4 h-14">
          <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center">
            <Timer className="w-4 h-4 text-white" strokeWidth={2.4} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-none">Ponto Digital</h1>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-[0.12em] mt-0.5">
              Portaria 671 · REP-P
            </p>
          </div>
          <button
            type="button"
            aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'}
            onClick={() => setMobileOpen((v) => !v)}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-white dark:bg-slate-900 shadow-2xl animate-in slide-in-from-left duration-200">
            <SidebarBody onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Content */}
      <main key={location.pathname} className="flex-1 min-w-0 pt-14 md:pt-0">
        <Outlet />
      </main>
    </div>
  );
};

export default PontoLayout;
