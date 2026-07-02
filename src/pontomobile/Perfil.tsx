import { useNavigate } from 'react-router-dom';
import { LogOut, User as UserIcon, ShieldCheck, HelpCircle, ChevronRight } from 'lucide-react';
import { currentUser, logout } from './api';

export default function PontoMobilePerfil() {
  const navigate = useNavigate();
  const user = currentUser();

  const items = [
    { icon: ShieldCheck, label: 'Segurança da conta', hint: 'Alterar senha (via RH)' },
    { icon: HelpCircle, label: 'Ajuda e suporte', hint: 'Fale com seu gestor' },
  ];

  return (
    <div className="pm-safe-top space-y-6 px-5 pb-6">
      <header className="pt-2">
        <p className="text-xs font-medium text-muted-foreground">Conta</p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Meu perfil</h1>
      </header>

      <section
        className="flex items-center gap-4 rounded-3xl p-5 text-primary-foreground"
        style={{ background: 'var(--pm-gradient)', boxShadow: 'var(--pm-shadow-md)' }}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-foreground/15">
          <UserIcon className="h-7 w-7" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold">{user?.name ?? 'Funcionário'}</p>
          <p className="truncate text-xs text-primary-foreground/80">CPF {user?.username}</p>
        </div>
      </section>

      <ul className="overflow-hidden rounded-2xl bg-card shadow-sm">
        {items.map(({ icon: Icon, label, hint }) => (
          <li key={label} className="flex items-center gap-3 border-b border-border px-4 py-3.5 last:border-b-0">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl text-primary"
              style={{ background: 'hsl(var(--primary-soft))' }}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">{label}</p>
              <p className="text-xs text-muted-foreground">{hint}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </li>
        ))}
      </ul>

      <button
        onClick={() => { logout(); navigate('/pontomobile/login', { replace: true }); }}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 text-base font-semibold text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
      >
        <LogOut className="h-5 w-5" />
        Sair
      </button>
    </div>
  );
}
