import { API } from './api';

const ACCESS_KEY = 'lex_access_token';
const REFRESH_KEY = 'lex_refresh_token';
const EMAIL_KEY = 'lex_user_email';

export function getAccess(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefresh(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

export function getEmail(): string | null {
  return localStorage.getItem(EMAIL_KEY);
}

export function saveSession(access: string, refresh: string, email: string): void {
  localStorage.setItem(ACCESS_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
  localStorage.setItem(EMAIL_KEY, email);
}

export function clearSession(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(EMAIL_KEY);
}

export function isLoggedIn(): boolean {
  return getAccess() !== null;
}

interface LoginOk {
  access_token: string;
  refresh_token: string;
}

function pickTokens(body: Record<string, unknown>): LoginOk | null {
  const a = body['access_token'];
  const r = body['refresh_token'];
  if (typeof a === 'string' && typeof r === 'string') return { access_token: a, refresh_token: r };
  return null;
}

async function readError(r: Response): Promise<{ status: number; message: string }> {
  const t = await r.text().catch(() => '');
  let message = t.slice(0, 300) || r.statusText;
  try {
    const b = JSON.parse(t) as Record<string, unknown>;
    if (typeof b['message'] === 'string') message = b['message'] as string;
  } catch {
    // cuerpo no JSON: se usa el texto tal cual
  }
  return { status: r.status, message };
}

export async function login(email: string, password: string): Promise<void> {
  const r = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, device_label: 'web' }),
  });
  if (!r.ok) {
    const e = await readError(r);
    throw new AuthHttpError(e.status, e.message);
  }
  const body = (await r.json()) as Record<string, unknown>;
  const t = pickTokens(body);
  if (!t) throw new Error('Respuesta de login sin tokens.');
  saveSession(t.access_token, t.refresh_token, email);
}

export interface AccessModeState {
  mode: 'public' | 'maintenance' | 'closed' | 'whitelist' | 'code';
  code_required: boolean;
  whitelist_required: boolean;
}

const ACCESS_ABIERTO: AccessModeState = {
  mode: 'public',
  code_required: false,
  whitelist_required: false,
};

const MODOS: AccessModeState['mode'][] = ['public', 'maintenance', 'closed', 'whitelist', 'code'];

/**
 * Modo de acceso público. Si falla (API caída), asume abierto: el servidor
 * es la fuente de verdad y rechazará lo que no cumpla.
 */
export async function fetchAccessMode(): Promise<AccessModeState> {
  try {
    const r = await fetch(`${API}/auth/access-mode`);
    if (!r.ok) return ACCESS_ABIERTO;
    const b = (await r.json()) as Record<string, unknown>;
    const raw = b['mode'] === 'open' ? 'public' : b['mode'];
    if (!MODOS.includes(raw as AccessModeState['mode'])) return ACCESS_ABIERTO;
    return {
      mode: raw as AccessModeState['mode'],
      code_required: b['code_required'] === true,
      whitelist_required: b['whitelist_required'] === true,
    };
  } catch {
    return ACCESS_ABIERTO;
  }
}

export async function register(
  email: string,
  password: string,
  consent: { termsAccepted: boolean; privacyAccepted: boolean },
  accessCode?: string,
): Promise<string> {
  const r = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      terms_accepted: consent.termsAccepted,
      privacy_accepted: consent.privacyAccepted,
      ...(accessCode?.trim() ? { access_code: accessCode.trim() } : {}),
    }),
  });
  if (!r.ok) {
    const e = await readError(r);
    throw new AuthHttpError(e.status, e.message);
  }
  const body = (await r.json()) as { message: string };
  return body.message;
}

export type LoginResultado =
  | { mfa: false }
  | { mfa: true; mfaToken: string; expiraEn: number };

/** Login que distingue segundo factor: devuelve mfa:true con pre-token (no es sesión). */
export async function loginConMfa(email: string, password: string): Promise<LoginResultado> {
  const r = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, device_label: 'web' }),
  });
  if (!r.ok) {
    const e = await readError(r);
    throw new AuthHttpError(e.status, e.message);
  }
  const body = (await r.json()) as Record<string, unknown>;
  if (body['mfa_required'] === true && typeof body['mfa_token'] === 'string') {
    const exp = body['expires_in'];
    return { mfa: true, mfaToken: body['mfa_token'] as string, expiraEn: typeof exp === 'number' ? exp : 0 };
  }
  const t = pickTokens(body);
  if (!t) throw new Error('Respuesta de login sin tokens.');
  saveSession(t.access_token, t.refresh_token, email);
  return { mfa: false };
}

/** Segunda fase del login: TOTP de 6-8 dígitos o código de recuperación. */
export async function verificarMfa(mfaToken: string, code: string, email: string): Promise<void> {
  const r = await fetch(`${API}/auth/mfa/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mfa_token: mfaToken, code, device_label: 'web' }),
  });
  if (!r.ok) {
    const e = await readError(r);
    throw new AuthHttpError(e.status, e.message);
  }
  const body = (await r.json()) as Record<string, unknown>;
  const t = pickTokens(body);
  if (!t) throw new Error('Respuesta MFA sin tokens.');
  saveSession(t.access_token, t.refresh_token, email);
}

export async function solicitarReset(email: string): Promise<string> {
  const r = await fetch(`${API}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!r.ok) {
    const e = await readError(r);
    throw new AuthHttpError(e.status, e.message);
  }
  const body = (await r.json()) as { message: string };
  return body.message;
}

export async function confirmarReset(token: string, password: string): Promise<string> {
  const r = await fetch(`${API}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password }),
  });
  if (!r.ok) {
    const e = await readError(r);
    throw new AuthHttpError(e.status, e.message);
  }
  const body = (await r.json()) as { message: string };
  return body.message;
}

export async function cambiarPassword(actual: string, nueva: string): Promise<string> {
  const b = await authJson<{ message: string }>('/auth/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ current: actual, next: nueva }),
  });
  return b.message;
}

export async function logout(): Promise<void> {
  const refresh = getRefresh();
  try {
    await fetch(`${API}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(refresh ? { refresh_token: refresh } : {}),
    });
  } catch {
    // salir local aunque falle la red
  }
  clearSession();
}

async function doRefresh(): Promise<boolean> {
  const refresh = getRefresh();
  if (!refresh) return false;
  try {
    const r = await fetch(`${API}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh }),
    });
    if (!r.ok) return false;
    const body = (await r.json()) as Record<string, unknown>;
    const t = pickTokens(body);
    if (!t) return false;
    localStorage.setItem(ACCESS_KEY, t.access_token);
    localStorage.setItem(REFRESH_KEY, t.refresh_token);
    return true;
  } catch {
    return false;
  }
}

export class AuthHttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** fetch con Bearer + un reintento silencioso de refresh ante 401. */
export async function authFetch(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  const access = getAccess();
  if (access) headers['Authorization'] = `Bearer ${access}`;
  const r = await fetch(`${API}${path}`, { ...init, headers });
  if (r.status === 401 && retry) {
    const ok = await doRefresh();
    if (ok) return authFetch(path, init, false);
    clearSession();
    window.dispatchEvent(new CustomEvent('lex:session-expired'));
  }
  return r;
}

export async function authJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const r = await authFetch(path, init);
  if (!r.ok) {
    const e = await readError(r);
    throw new AuthHttpError(e.status, e.message);
  }
  return (await r.json()) as T;
}

/** Mensaje honesto según estado HTTP, sin inventar contenido. */
export function mensajeError(status: number, fallback: string): string {
  if (status === 401) return 'Sesión expirada. Inicia sesión de nuevo.';
  if (status === 429) return 'Límite de uso alcanzado (cuota). Espera un momento e inténtalo de nuevo.';
  if (status >= 500) return 'El servidor falló al procesar la solicitud. Inténtalo de nuevo.';
  return fallback;
}
