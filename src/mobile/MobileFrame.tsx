import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Home,
  Route as RouteIcon,
  Truck,
  Briefcase,
  Menu as MenuIcon,
  ChevronLeft,
  Bell,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import MobileBottomNav from './MobileBottomNav';

/**
 * MobileFrame
 * ------------------------------------------------------------------
 * Casca mobile-first "cheia": header sticky compacto + bottom nav +
 * área de conteúdo com respiro para safe-area. Usada nas telas
 * mobile-nativas (Home, Menu). Páginas existentes usam MobileWrap.
 */

const NAV_ITEMS = [
  { to: '/', label: 'Início', icon: Home, match: (p: string) => p === '/' },
  { to: '/routes', label: 'Rotas', icon: RouteIcon, match: (p: string) => p.startsWith('/routes') || p.startsWith('/rotas') },
  { to: '/trucks', label: 'Frota', icon: Truck, match: (p: string) => p.startsWith('/trucks') || p.startsWith('/drivers') || p.startsWith('/carretinhas') },
  { to: '/erp', label: 'ERP', icon: Briefcase, match: (p: string) => p.startsWith('/erp') },
  { to: '/menu', label: 'Menu', icon: MenuIcon, match: (p: string) => p.startsWith('/menu') || p.startsWith('/settings') },
];

const TITLES: Record<string, string> = {
  '/': 'Início',
  '/routes': 'Rotas',
  '/trucks': 'Caminhões',
  '/drivers': 'Motoristas',
  '/customers': 'Clientes',
  '/sanitarios': 'Sanitários',
  '/carretinhas': 'Carretinhas',
  '/maintenance': 'Manutenção',
  '/rotas-concluidas': 'Rotas concluídas',
  '/checklists': 'Checklists',
  '/gestao-interna': 'Gestão interna',
  '/settings': 'Configurações',
  '/menu': 'Menu',
  '/erp': 'ERP',
  '/erp/financeiro': 'Financeiro',
  '/erp/contratos': 'Contratos',
  '/erp/orcamentos': 'Orçamentos',
  '/erp/ordens-servico': 'Ordens de serviço',
  '/erp/clientes': 'Clientes',
  '/erp/empresas': 'Empresas',
  '/erp/estoque': 'Estoque',
};

interface MobileFrameProps {
  children: ReactNode;
  /** Título opcional para sobrescrever o inferido pela rota. */
  title?: string;
  /** Mostra botão voltar em vez do título grande. Útil em telas de detalhe. */
  showBack?: boolean;
  /** Ação opcional no canto direito do header. */
  headerAction?: ReactNode;
}

const MobileFrame = ({ children, title, showBack, headerAction }: MobileFrameProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const inferredTitle = TITLES[location.pathname] ?? 'AlchemyRotas';
  const currentTitle = title ?? inferredTitle;

  const isRoot = NAV_ITEMS.some((i) => i.to === location.pathname);

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
      {/* Header */}
      <header
        className={cn(
          'sticky top-0 z-40 bg-background/80 backdrop-blur-xl',
          'border-b border-border/60 safe-area-top',
        )}
      >
        <div className="h-14 px-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {showBack && !isRoot ? (
              <button
                onClick={() => navigate(-1)}
                aria-label="Voltar"
                className={cn(
                  'h-10 w-10 -ml-2 grid place-items-center rounded-full',
                  'text-foreground/80 hover:text-foreground hover:bg-muted',
                  'active:scale-95 transition-all duration-200',
                  'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
                )}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            ) : (
              <div
                aria-hidden
                className="h-8 w-8 rounded-lg shadow-sm bg-gradient-to-br from-[hsl(var(--brand))] via-[hsl(var(--brand-2))] to-[hsl(var(--brand-3))] grid place-items-center"
              >
                <span className="text-[13px] font-display font-bold text-brand-foreground">A</span>
              </div>
            )}
            <h1 className="font-display text-[17px] font-semibold tracking-tight truncate">
              {currentTitle}
            </h1>
          </div>
          <div className="flex items-center gap-1">
            {headerAction ?? (
              <button
                aria-label="Notificações"
                className={cn(
                  'h-10 w-10 grid place-items-center rounded-full',
                  'text-muted-foreground hover:text-foreground hover:bg-muted',
                  'active:scale-95 transition-all duration-200',
                )}
              >
                <Bell className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Conteúdo */}
      <main className="flex-1 min-h-0 pb-24">{children}</main>

      {/* Bottom nav */}
      <nav
        aria-label="Navegação principal"
        className={cn(
          'fixed bottom-0 left-0 right-0 z-40',
          'bg-background/85 backdrop-blur-xl',
          'border-t border-border/60 safe-area-bottom',
        )}
      >
        <ul className="grid grid-cols-5 h-16">
          {NAV_ITEMS.map((item) => {
            const active = item.match(location.pathname);
            const Icon = item.icon;
            return (
              <li key={item.to} className="flex">
                <Link
                  to={item.to}
                  aria-current={active ? 'page' : undefined}
                  aria-label={item.label}
                  className={cn(
                    'flex-1 flex flex-col items-center justify-center gap-0.5 relative',
                    'transition-colors duration-200 active:scale-95',
                    active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                  )}
                >
                  {active && (
                    <span
                      aria-hidden
                      className="absolute top-0 left-1/2 -translate-x-1/2 h-[3px] w-8 rounded-full bg-primary"
                    />
                  )}
                  <Icon
                    className={cn(
                      'h-[22px] w-[22px] transition-transform duration-200',
                      active && 'scale-110',
                    )}
                    strokeWidth={active ? 2.4 : 2}
                  />
                  <span
                    className={cn(
                      'text-[10.5px] leading-none tracking-tight',
                      active ? 'font-semibold' : 'font-medium',
                    )}
                  >
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
};

export default MobileFrame;
