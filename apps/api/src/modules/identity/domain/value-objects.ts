// Objetos de valor de identidad: normalización + validación pura.
import { emailInvalido, nombreInvalido, passwordDebil } from './errors';

// RFC 5322 completo es excesivo; esta forma rechaza lo claramente inválido
// (sin @, espacios, sin dominio) y acepta direcciones reales incl. +tag.
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,253}\.[^\s@]{2,}$/;

/** Normaliza (trim + minúsculas) y valida. Lanza DomainError. */
export function parseEmail(v: unknown): string {
  if (typeof v !== 'string') throw emailInvalido();
  const e = v.trim().toLowerCase();
  if (e.length === 0 || e.length > 254 || !EMAIL_RE.test(e)) throw emailInvalido();
  return e;
}

/** Política NIST-lite: longitud 8–256, sin complejidad teatral. */
export function parsePassword(v: unknown): string {
  if (typeof v !== 'string') throw passwordDebil();
  if (v.length < 8 || v.length > 256) throw passwordDebil();
  return v;
}

export function parseDisplayName(v: unknown): string {
  if (v === undefined || v === null || v === '') return '';
  if (typeof v !== 'string') throw nombreInvalido();
  const t = v.trim().replace(/\s+/g, ' ');
  if (t.length > 80) throw nombreInvalido();
  return t;
}
