import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, User as UserIcon, Lock, Loader2, LogIn } from 'lucide-react';
import { toast } from 'sonner';
import { login, currentUser } from './api';

function maskCpf(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
}

export default function PontoMobileLogin() {
  const [cpf, setCpf] = useState('');
  const [senha, setSenha] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (currentUser()) navigate('/pontomobile', { replace: true });
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (cpf.replace(/\D/g, '').length !== 11) {
      toast.error('CPF inválido');
      return;
    }
    if (senha.length < 3) {
      toast.error('Senha muito curta');
      return;
    }
    setLoading(true);
    try {
      await login(cpf, senha);
      navigate('/pontomobile', { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao entrar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="pm-safe-top flex min-h-full flex-col">
      {/* Topo com ilustração */}
      <div className="relative flex flex-col items-center px-6 pt-8 pb-14">
        <div className="mb-3 flex items-center gap-2">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl text-primary-foreground shadow-md"
            style={{ background: 'var(--pm-gradient)' }}
          >
            <Lock className="h-4 w-4" />
          </div>
          <span className="text-base font-semibold tracking-tight text-foreground">Ponto Digital</span>
        </div>

        <div
          aria-hidden
          className="mt-6 flex h-40 w-40 items-center justify-center rounded-full"
          style={{ background: 'var(--pm-gradient-soft)', boxShadow: 'var(--pm-shadow-md)' }}
        >
          <div
            className="flex h-28 w-28 items-center justify-center rounded-full text-primary-foreground"
            style={{ background: 'var(--pm-gradient)' }}
          >
            <svg viewBox="0 0 48 48" className="h-14 w-14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <circle cx="24" cy="24" r="18" />
              <path d="M24 14v10l7 4" />
            </svg>
          </div>
        </div>

        <h1 className="mt-8 text-3xl font-bold tracking-tight text-foreground">Bem-vindo</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Faça login para bater seu ponto</p>
      </div>

      {/* Card curvo com formulário */}
      <div
        className="pm-safe-bottom relative flex-1 rounded-t-[2rem] px-6 pt-8"
        style={{ background: 'var(--pm-gradient)' }}
      >
        <form onSubmit={onSubmit} className="space-y-5" noValidate>
          <div className="space-y-1.5">
            <label htmlFor="cpf" className="text-sm font-medium text-primary-foreground/90">
              CPF
            </label>
            <div className="relative">
              <UserIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-primary" />
              <input
                id="cpf"
                inputMode="numeric"
                autoComplete="username"
                placeholder="000.000.000-00"
                value={cpf}
                onChange={(e) => setCpf(maskCpf(e.target.value))}
                className="h-14 w-full rounded-2xl border-0 bg-card pl-12 pr-4 text-base text-foreground shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary-foreground/40"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="senha" className="text-sm font-medium text-primary-foreground/90">
              Senha
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-primary" />
              <input
                id="senha"
                type={show ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Digite sua senha"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="h-14 w-full rounded-2xl border-0 bg-card pl-12 pr-12 text-base text-foreground shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary-foreground/40"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
                className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
              >
                {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-card text-base font-semibold text-primary shadow-lg hover:bg-card/95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/60 disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Entrando...
              </>
            ) : (
              <>
                <LogIn className="h-5 w-5" />
                Entrar
              </>
            )}
          </button>

          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={() => toast.info('Fale com o RH para recuperar sua senha.')}
              className="text-sm font-medium text-primary-foreground/90 underline-offset-4 hover:underline"
            >
              Esqueci senha
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
