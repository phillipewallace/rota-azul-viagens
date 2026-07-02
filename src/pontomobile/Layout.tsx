import { Outlet, NavLink, useLocation, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Home, Clock, FileText, User } from 'lucide-react';
import { currentUser } from './api';
import './theme.css';

const tabs = [
  { to: '/pontomobile', label: 'Home', icon: Home, end: true },
  { to: '/pontomobile/espelho', label: 'Espelho', icon: Clock },
  { to: '/pontomobile/justificar', label: 'Justificar', icon: FileText },
  { to: '/pontomobile/perfil', label: 'Perfil', icon: User },
];

export default function PontoMobileLayout() {
  const location = useLocation();
  const user = currentUser();
  const isLogin = location.pathname === '/pontomobile/login';

  // Meta theme-color pro status bar mobile
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    const prev = meta?.getAttribute('content');
    meta?.setAttribute('content', '#059669');
    return () => { if (prev) meta?.setAttribute('content', prev); };
  }, []);

  if (!user && !isLogin) return <Navigate to="/pontomobile/login" replace />;

  return (
    <div data-pm-theme className="fixed inset-0 flex flex-col bg-background text-foreground">
      <main className="flex-1 overflow-y-auto overscroll-contain">
        <Outlet />
      </main>

      {!isLogin && (
        <nav
          aria-label="Navegação principal"
          className="pm-safe-bottom border-t border-border bg-card/95 backdrop-blur-md"
        >
          <ul className="grid grid-cols-4 gap-1 px-2 pt-2">
            {tabs.map(({ to, label, icon: Icon, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    [
                      'flex flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-medium',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                      isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                    ].join(' ')
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon className="h-5 w-5" strokeWidth={isActive ? 2.4 : 1.8} />
                      <span>{label}</span>
                      <span
                        aria-hidden
                        className={[
                          'h-0.5 w-6 rounded-full transition-all',
                          isActive ? 'bg-primary opacity-100' : 'bg-transparent opacity-0',
                        ].join(' ')}
                      />
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
