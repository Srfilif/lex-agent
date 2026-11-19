// Fuente legal del frontend: versiones vigentes + URLs canónicas (landing).
// Sincronizar con: TERMS_OF_SERVICE.md, PRIVACY_POLICY.md,
// apps/api/src/modules/identity/domain/consent-versions.ts.
export const TERMS_VERSION = '2026-11-18-v1';
export const PRIVACY_VERSION = '2026-11-18-v1';

export const LEGAL_BASE: string =
  (import.meta.env.VITE_LEGAL_URL as string | undefined) ?? 'http://localhost:3001';

export const URL_TERMINOS = `${LEGAL_BASE}/terminos`;
export const URL_PRIVACIDAD = `${LEGAL_BASE}/privacidad`;
export const URL_COOKIES = `${LEGAL_BASE}/cookies`;
export const URL_AVISO = `${LEGAL_BASE}/aviso-legal`;
export const URL_LICENCIA = `${LEGAL_BASE}/licencia`;

// --- Elección de cookies/almacenamiento (mecanismo real) ---
const CHOICE_KEY = 'lex_cookie_choice';
const THEME_KEY = 'lex_theme';
const THEME_OPTOUT = 'lex_theme_optout';

export type CookieChoice = 'aceptadas' | 'solo-necesarias';

export function leerEleccionCookies(): CookieChoice | null {
  const v = localStorage.getItem(CHOICE_KEY);
  return v === 'aceptadas' || v === 'solo-necesarias' ? v : null;
}

/**
 * Guarda la elección. "solo-necesarias" borra la preferencia de tema y activa
 * el opt-out para que no se vuelva a guardar; "aceptadas" la permite.
 */
export function guardarEleccionCookies(choice: CookieChoice): void {
  localStorage.setItem(CHOICE_KEY, choice);
  if (choice === 'solo-necesarias') {
    localStorage.removeItem(THEME_KEY);
    localStorage.setItem(THEME_OPTOUT, '1');
  } else {
    localStorage.removeItem(THEME_OPTOUT);
  }
}

/** ¿Puede persistirse la preferencia de tema? Falso tras rechazar lo opcional. */
export function puedeGuardarTema(): boolean {
  return localStorage.getItem(THEME_OPTOUT) !== '1';
}

/** Reabre el aviso (para "Configurar cookies" en Cuenta/Preferencias). */
export function reabrirAvisoCookies(): void {
  localStorage.removeItem(CHOICE_KEY);
  window.dispatchEvent(new CustomEvent('lex:cookies-reabrir'));
}
