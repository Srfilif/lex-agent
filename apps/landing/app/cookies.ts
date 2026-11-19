// Elección de cookies/almacenamiento de la landing (mecanismo real).
// La landing solo guarda lex_theme (opcional) y lex_cookie_choice.
export type CookieChoice = 'aceptadas' | 'solo-necesarias';

const CHOICE_KEY = 'lex_cookie_choice';
const THEME_KEY = 'lex_theme';
const THEME_OPTOUT = 'lex_theme_optout';

export function leerEleccionCookies(): CookieChoice | null {
  try {
    const v = localStorage.getItem(CHOICE_KEY);
    return v === 'aceptadas' || v === 'solo-necesarias' ? v : null;
  } catch {
    return 'solo-necesarias';
  }
}

export function guardarEleccionCookies(choice: CookieChoice): void {
  try {
    localStorage.setItem(CHOICE_KEY, choice);
    if (choice === 'solo-necesarias') {
      localStorage.removeItem(THEME_KEY);
      localStorage.setItem(THEME_OPTOUT, '1');
    } else {
      localStorage.removeItem(THEME_OPTOUT);
    }
  } catch {
    // Sin almacenamiento: equivale a "solo necesarias" para esta sesión.
  }
}

export function puedeGuardarTema(): boolean {
  try {
    return localStorage.getItem(THEME_OPTOUT) !== '1';
  } catch {
    return false;
  }
}

export function reabrirAvisoCookies(): void {
  try {
    localStorage.removeItem(CHOICE_KEY);
  } catch {
    // Sin almacenamiento no hay nada que reabrir.
  }
  window.dispatchEvent(new CustomEvent('lex:cookies-reabrir'));
}
