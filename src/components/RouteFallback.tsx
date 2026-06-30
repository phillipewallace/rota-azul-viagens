import { Loader2 } from "lucide-react";

/**
 * Fallback exibido durante o carregamento lazy de rotas.
 * Visual minimalista, tokens semânticos (funciona em dark mode automaticamente).
 */
export default function RouteFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="min-h-[60vh] w-full flex flex-col items-center justify-center gap-4 px-6 animate-in fade-in duration-200"
    >
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-primary/10 blur-xl" aria-hidden />
        <Loader2 className="relative h-8 w-8 text-primary animate-spin" strokeWidth={2.25} />
      </div>
      <p className="text-sm font-medium text-muted-foreground tracking-tight">
        Carregando…
      </p>
      <span className="sr-only">Carregando conteúdo da página</span>
    </div>
  );
}
