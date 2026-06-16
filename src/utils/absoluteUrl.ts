import { API_BASE_URL } from '@/services/config';

/** Converte URL relativa (ex: /uploads/x.png) para absoluta usando o host do backend. */
export function toAbsoluteUrl(u?: string | null): string {
  if (!u) return '';
  if (/^(https?:|data:|blob:)/i.test(u)) return u;
  const base = API_BASE_URL.replace(/\/api\/?$/, '');
  return `${base}${u.startsWith('/') ? '' : '/'}${u}`;
}
