import { FileText, Clock } from 'lucide-react';

export default function PontoMobileJustificar() {
  return (
    <div className="pm-safe-top flex min-h-full flex-col items-center justify-center px-6 pb-10 text-center">
      <div
        className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl text-primary"
        style={{ background: 'hsl(var(--primary-soft))' }}
      >
        <FileText className="h-10 w-10" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Justificar ausência</h1>
      <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
        Em breve você poderá enviar justificativas e atestados direto pelo app.
      </p>
      <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-card px-4 py-2 text-xs font-medium text-muted-foreground shadow-sm">
        <Clock className="h-3.5 w-3.5 text-primary" />
        Enquanto isso, fale com seu gestor
      </div>
    </div>
  );
}
