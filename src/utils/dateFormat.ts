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
