// Cookie de refresh + parseo manual (sin cookie-parser; D1 cero deps).
// Interfaz estructural mínima: no requiere @types/express.
import { AuthConfig } from '../../../../shared/config';

export const REFRESH_COOKIE = 'lex_refresh';

export interface CookieWriter {
  cookie(name: string, value: string, opts: Record<string, unknown>): void;
  clearCookie(name: string, opts: Record<string, unknown>): void;
}

function baseOpts(cfg: AuthConfig): Record<string, unknown> {
  return {
    httpOnly: true,
    secure: cfg.secureCookies,
    sameSite: 'lax',
    path: '/auth',
  };
}

export function setRefreshCookie(res: CookieWriter, token: string, cfg: AuthConfig): void {
  res.cookie(REFRESH_COOKIE, token, {
    ...baseOpts(cfg),
    maxAge: cfg.refreshTtlDays * 86400 * 1000,
  });
}

export function clearRefreshCookie(res: CookieWriter, cfg: AuthConfig): void {
  res.clearCookie(REFRESH_COOKIE, baseOpts(cfg));
}

/** Parseo mínimo de Cookie: "a=1; b=2" → {a:'1',b:'2'}. */
export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    const k = part.slice(0, eq).trim();
    const v = part.slice(eq + 1).trim();
    if (k && !(k in out)) out[k] = decodeURIComponent(v);
  }
  return out;
}
