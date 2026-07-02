import { Link, useLocation } from 'react-router-dom';
import { Home, Route as RouteIcon, Truck, Briefcase, Menu as MenuIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * MobileBottomNav
 * ------------------------------------------------------------------
 * Bottom nav global do app mobile. Usado tanto pelo shell "cheio"
 * (MobileFrame) quanto pelo wrapper leve (MobileWrap) que apenas
 * complementa páginas com header próprio.
 */

const ITEMS = [
  { to: '/', label: 'Início', icon: Home, match: (p: string) => p === '/' },
  {
    to: '/routes',
    label: 'Rotas',
    icon: RouteIcon,
    match: (p: string) => p.startsWith('/routes') || p.startsWith('/rotas'),
  },
  {
    to: '/trucks',
    label: 'Frota',
    icon: Truck,
    match: (p: string) =>
      p.startsWith('/trucks') || p.startsWith('/drivers') || p.startsWith('/carretinhas'),
  },
  { to: '/erp', label: 'ERP', icon: Briefcase, match: (p: string) => p.startsWith('/erp') },
  {
    to: '/menu',
    label: 'Menu',
    icon: MenuIcon,
    match: (p: string) => p.startsWith('/menu') || p.startsWith('/settings'),
  },
];

const HIDDEN_PREFIXES = ['/login', '/mobile', '/checklist', '/operator'];

const MobileBottomNav = () => {
  const location = useLocation();
  if (HIDDEN_PREFIXES.some((p) => location.pathname === p || location.pathname.startsWith(p + '/'))) {
    return null;
  }
    <nav
      aria-label="Navegação principal"
      className={cn(
        'fixed bottom-0 left-0 right-0 z-40',
        'bg-background/85 backdrop-blur-xl',
        'border-t border-border/60 safe-area-bottom',
      )}
    >
      <ul className="grid grid-cols-5 h-16">
        {ITEMS.map((item) => {
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
  );
};

export default MobileBottomNav;
