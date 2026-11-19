// Control de acceso: whitelist y códigos. Puro (sin Nest/SQL/HTTP).
import { patronInvalido } from './errors';
import { parseEmail } from './value-objects';

const DOMAIN_RE = /^[^\s@]{1,253}\.[^\s@]{2,}$/;

/**
 * Normaliza (trim + minúsculas) y valida un patrón de whitelist:
 * correo exacto o comodín de dominio `*@dominio.tld`. Lanza DomainError.
 */
export function parseWhitelistPattern(v: unknown): string {
  if (typeof v !== 'string') throw patronInvalido();
  const p = v.trim().toLowerCase();
  if (!p || p.length > 254) throw patronInvalido();
  if (p.startsWith('*@')) {
    if (!DOMAIN_RE.test(p.slice(2))) throw patronInvalido();
    return p;
  }
  if (p.includes('*')) throw patronInvalido();
  try {
    return parseEmail(p);
  } catch {
    throw patronInvalido();
  }
}

/** ¿El correo (normalizado) coincide con algún patrón (se normalizan aquí)? */
export function matchWhitelist(email: string, patterns: string[]): boolean {
  const e = email.trim().toLowerCase();
  for (const raw of patterns) {
    const p = raw.trim().toLowerCase();
    if (!p) continue;
    if (p.startsWith('*@')) {
      if (e.endsWith(p.slice(1)) && e.length > p.length - 1) return true;
    } else if (e === p) {
      return true;
    }
  }
  return false;
}

/** Normaliza un código de acceso para comparar (trim + mayúsculas). */
export function normalizeAccessCode(v: unknown): string {
  if (typeof v !== 'string') return '';
  return v.trim().toUpperCase().replace(/\s+/g, '');
}

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // sin 0/O/1/I/L

/** Formato XXXX-XXXX-XXXX desde bytes aleatorios (12 caracteres). */
export function formatAccessCode(bytes: Uint8Array): string {
  if (bytes.length < 12) throw new Error('se requieren ≥12 bytes aleatorios');
  let s = '';
  for (let i = 0; i < 12; i++) s += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
}
