// Format date strings safely without UTC timezone shifts.
// Backend returns ISO ("YYYY-MM-DD" or "YYYY-MM-DDTHH:mm:ssZ").
// For pure dates (no time), parse as LOCAL to avoid -1 day shifts in BR timezone.
export function formatDateBR(value?: string | Date | null): string {
  if (!value) return '—';
  if (value instanceof Date) return value.toLocaleDateString('pt-BR');
  const s = String(value);
  // Pure date: YYYY-MM-DD
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const [, y, mo, d] = m;
    return `${d}/${mo}/${y}`;
  }
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('pt-BR');
}

// Formata período do recibo: "DD/MM/YYYY - DD/MM/YYYY" quando informado,
// senão devolve o fallback (ex.: competência mensal "Jan/2026").
export function formatPeriodo(
  inicio?: string | null,
  fim?: string | null,
  fallback = '—',
): string {
  if (!inicio && !fim) return fallback;
  const a = inicio ? formatDateBR(inicio) : '—';
  const b = fim ? formatDateBR(fim) : '—';
  return `${a} - ${b}`;
}
