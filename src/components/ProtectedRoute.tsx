import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, loading, checkAuthStatus } = useAuth();

  useEffect(() => {
    const interval = setInterval(() => {
      checkAuthStatus();
    }, 60000);
    return () => clearInterval(interval);
  }, [checkAuthStatus]);

  if (loading) {
    return (
      <div
        className="fixed inset-0 flex flex-col items-center justify-center gap-3"
        style={{ background: 'var(--gradient-brand)' }}
        role="status"
        aria-live="polite"
      >
        <Loader2 className="h-8 w-8 animate-spin text-brand-foreground" aria-hidden />
        <p className="text-sm font-medium text-brand-foreground/90">Carregando…</p>
      </div>
    );
  }

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
