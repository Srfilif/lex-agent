import { API } from './api';
import { AuthHttpError, authJson } from './auth';

// Cliente tipado de la superficie SaaS (Cuenta/Facturación/Admin/TOTP).
// Sin `any`: cada forma se confirmó contra los controladores y casos de uso.

export interface Me {
  id: string;
  email: string;
  display_name: string | null;
  email_verified: boolean;
  role: string;
  created_at: string;
  terms_version: string | null;
  terms_accepted_at: string | null;
  privacy_version: string | null;
  privacy_accepted_at: string | null;
}

export interface ConsentState {
  terms_version: string | null;
  terms_accepted_at: string | null;
  privacy_version: string | null;
  privacy_accepted_at: string | null;
  complete: boolean;
  current_terms_version: string;
  current_privacy_version: string;
}

export interface Sesion {
  id: string;
  current: boolean;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
  device_label: string | null;
}

export type TotpEstado = 'disabled' | 'pending' | 'active';

export interface TotpStatus {
  status: TotpEstado;
  recovery_codes_left: number;
}

export interface Preferencias {
  theme: 'light' | 'dark' | 'system';
  language: string;
  timezone: string;
  notifications: { emailSecurity: boolean };
  ai: { model: string | null; detail: 'breve' | 'normal' | 'detallado'; responseFormat: 'texto' | 'markdown'; crossMemory: boolean };
}

export interface Recuerdo {
  id: string;
  fact: string;
  created_at: string;
}

export interface Plan {
  code: string;
  name: string;
  description: string;
  version: number;
  price_minor: number | null;
  currency: string;
  limites: { investigaciones_mes: number; tokens_mes: number; max_pasos: number; modelos: string[] };
}

export interface Suscripcion {
  plan: string;
  plan_name: string;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

export interface Uso {
  plan: string;
  period: string;
  reset_at: string;
  investigaciones: { used: number; limit: number; remaining: number };
  tokens: { used: number; limit: number; remaining: number };
}

export interface Entitlements {
  plan: string;
  puede_investigar: boolean;
  max_pasos: number;
  modelos: string[];
  investigaciones_restantes: number;
  tokens_restantes: number;
}

export interface Pago {
  id: string;
  plan: string;
  amount_minor: number;
  currency: string;
  status: string;
  provider: string;
  created_at: string;
}

export interface EventoSuscripcion {
  type: string;
  from: string;
  to: string;
  meta: Record<string, unknown>;
  created_at: string;
}

export interface Checkout {
  checkout_id: string;
  checkout_url: string;
  plan: string;
  amount_minor: number;
  currency: string;
}

export interface SimuladorDecision {
  webhook_url: string;
  signature_header: string;
  signature: string;
  payload: Record<string, unknown>;
}

export interface AdminUsuario {
  id: string;
  email: string;
  display_name: string | null;
  email_verified: boolean;
  role: string;
  created_at: string;
  status: string;
}

function esRegistro(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function texto(v: unknown, defecto = ''): string {
  return typeof v === 'string' ? v : defecto;
}

function numero(v: unknown, defecto = 0): number {
  return typeof v === 'number' ? v : defecto;
}

function booleano(v: unknown, defecto = false): boolean {
  return typeof v === 'boolean' ? v : defecto;
}

function textoONulo(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

function comoMe(v: unknown): Me {
  const b = esRegistro(v) ? v : {};
  const display = b['display_name'];
  return {
    id: texto(b['id']),
    email: texto(b['email']),
    display_name: typeof display === 'string' ? display : null,
    email_verified: booleano(b['email_verified']),
    role: texto(b['role'], 'user'),
    created_at: texto(b['created_at']),
    terms_version: textoONulo(b['terms_version']),
    terms_accepted_at: textoONulo(b['terms_accepted_at']),
    privacy_version: textoONulo(b['privacy_version']),
    privacy_accepted_at: textoONulo(b['privacy_accepted_at']),
  };
}

function comoConsentimientos(v: unknown): ConsentState {
  const b = esRegistro(v) ? v : {};
  return {
    terms_version: textoONulo(b['terms_version']),
    terms_accepted_at: textoONulo(b['terms_accepted_at']),
    privacy_version: textoONulo(b['privacy_version']),
    privacy_accepted_at: textoONulo(b['privacy_accepted_at']),
    complete: booleano(b['complete']),
    current_terms_version: texto(b['current_terms_version']),
    current_privacy_version: texto(b['current_privacy_version']),
  };
}

export async function fetchConsentimientos(): Promise<ConsentState> {
  return comoConsentimientos(await authJson<unknown>('/account/consents'));
}

export async function aceptarConsentimientos(
  termsAccepted: boolean,
  privacyAccepted: boolean,
): Promise<ConsentState> {
  return comoConsentimientos(
    await authJson<unknown>('/account/consents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ terms_accepted: termsAccepted, privacy_accepted: privacyAccepted }),
    }),
  );
}

export async function fetchMe(): Promise<Me> {
  return comoMe(await authJson<unknown>('/account/me'));
}

export async function patchPerfil(displayName: string): Promise<Me> {
  return comoMe(
    await authJson<unknown>('/account/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: displayName }),
    }),
  );
}

export async function solicitarCambioEmail(password: string, nuevo: string): Promise<string> {
  const b = await authJson<{ message: string }>('/account/email/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password, new_email: nuevo }),
  });
  return b.message;
}

export async function confirmarCambioEmail(token: string): Promise<string> {
  const b = await authJson<{ message: string; email?: string }>('/account/email/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  return typeof b.email === 'string' ? `correo actualizado a ${b.email}` : b.message;
}

export async function fetchPreferencias(): Promise<Preferencias> {
  const b = await authJson<Record<string, unknown>>('/account/preferences');
  const notif = esRegistro(b['notifications']) ? b['notifications'] : {};
  const ai = esRegistro(b['ai']) ? b['ai'] : {};
  const model = ai['model'];
  const theme = b['theme'];
  return {
    theme: theme === 'light' || theme === 'dark' || theme === 'system' ? theme : 'system',
    language: texto(b['language'], 'es'),
    timezone: texto(b['timezone'], 'America/Bogota'),
    notifications: { emailSecurity: typeof notif['emailSecurity'] === 'boolean' ? notif['emailSecurity'] : true },
    ai: {
      model: typeof model === 'string' && model.length > 0 ? model : null,
      detail: ai['detail'] === 'breve' || ai['detail'] === 'detallado' ? ai['detail'] : 'normal',
      responseFormat: ai['responseFormat'] === 'texto' ? 'texto' : 'markdown',
      crossMemory: ai['crossMemory'] === true,
    },
  };
}

/** B8: recuerdos de memoria cruzada (opt-in en preferencias IA). */
export async function listRecuerdos(): Promise<{ memories: Recuerdo[]; max: number }> {
  const b = await authJson<{ memories: Recuerdo[]; max: number }>('/account/memories');
  return { memories: b.memories ?? [], max: b.max ?? 50 };
}

export async function addRecuerdo(fact: string): Promise<Recuerdo> {
  const b = await authJson<{ memory: Recuerdo }>('/account/memories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fact }),
  });
  return b.memory;
}

export async function deleteRecuerdo(id: string): Promise<void> {
  await authJson(`/account/memories/${id}`, { method: 'DELETE' });
}

export async function patchPreferencias(parche: Record<string, unknown>): Promise<Preferencias> {
  await authJson<unknown>('/account/preferences', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(parche),
  });
  return fetchPreferencias();
}

export async function exportarCuenta(): Promise<{ nombre: string; contenido: string }> {
  const b = await authJson<Record<string, unknown>>('/account/export');
  const fecha = new Date().toISOString().slice(0, 10);
  return { nombre: `kelsyx-datos-${fecha}.json`, contenido: JSON.stringify(b, null, 2) };
}

export async function solicitarBorrado(): Promise<string> {
  const b = await authJson<{ message: string }>('/account/delete-request', { method: 'POST' });
  return b.message;
}

export async function confirmarBorrado(password: string, token: string): Promise<string> {
  const b = await authJson<{ message: string }>('/account/delete-confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password, token }),
  });
  return b.message;
}

// ——— Sesiones ———

export async function listarSesiones(): Promise<Sesion[]> {
  const b = await authJson<{ sessions: unknown }>('/auth/sessions');
  if (!Array.isArray(b.sessions)) return [];
  return b.sessions
    .filter(esRegistro)
    .map((s) => ({
      id: texto(s['id']),
      current: booleano(s['current']),
      created_at: texto(s['created_at']),
      last_seen_at: texto(s['last_seen_at']),
      expires_at: texto(s['expires_at']),
      device_label: typeof s['device_label'] === 'string' ? s['device_label'] : null,
    }))
    .filter((s) => s.id.length > 0);
}

export async function revocarSesion(id: string): Promise<string> {
  const b = await authJson<{ message: string }>(`/auth/sessions/${id}`, { method: 'DELETE' });
  return b.message;
}

export async function cerrarTodasSesiones(): Promise<string> {
  const b = await authJson<{ message: string }>('/auth/logout-all', { method: 'POST' });
  return b.message;
}

// ——— TOTP ———

export async function totpEstado(): Promise<TotpStatus> {
  const b = await authJson<Record<string, unknown>>('/account/security/totp/status');
  const st = texto(b['status'], 'disabled');
  return {
    status: st === 'active' || st === 'pending' ? st : 'disabled',
    recovery_codes_left: numero(b['recovery_codes_left']),
  };
}

export async function totpSetup(): Promise<{ otpauth_url: string; message: string }> {
  const b = await authJson<Record<string, unknown>>('/account/security/totp/setup', { method: 'POST' });
  return { otpauth_url: texto(b['otpauth_url']), message: texto(b['message']) };
}

export function secretoDeOtpauth(url: string): string {
  const i = url.indexOf('?');
  if (i < 0) return '';
  for (const par of url.slice(i + 1).split('&')) {
    const [k, v] = par.split('=');
    if (k === 'secret' && v) return decodeURIComponent(v);
  }
  return '';
}

export async function totpConfirmar(code: string): Promise<{ message: string; recovery_codes: string[] }> {
  const b = await authJson<Record<string, unknown>>('/account/security/totp/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  const cr = b['recovery_codes'];
  return {
    message: texto(b['message']),
    recovery_codes: Array.isArray(cr) ? cr.filter((c): c is string => typeof c === 'string') : [],
  };
}

export async function totpDesactivar(password: string, code: string): Promise<string> {
  const b = await authJson<{ message: string }>('/account/security/totp/disable', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password, code }),
  });
  return b.message;
}

export async function totpRegenerar(password: string, code: string): Promise<{ message: string; recovery_codes: string[] }> {
  const b = await authJson<Record<string, unknown>>('/account/security/totp/recovery-codes/regenerate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password, code }),
  });
  const cr = b['recovery_codes'];
  return {
    message: texto(b['message']),
    recovery_codes: Array.isArray(cr) ? cr.filter((c): c is string => typeof c === 'string') : [],
  };
}

// ——— Facturación ———

export async function fetchPlanes(): Promise<Plan[]> {
  const b = await authJson<{ plans: unknown }>('/billing/plans');
  if (!Array.isArray(b.plans)) return [];
  return b.plans.filter(esRegistro).map((p) => {
    const lim = esRegistro(p['limites']) ? p['limites'] : {};
    const mods = lim['modelos'];
    const precio = p['price_minor'];
    return {
      code: texto(p['code']),
      name: texto(p['name']),
      description: texto(p['description']),
      version: numero(p['version'], 1),
      price_minor: typeof precio === 'number' ? precio : null,
      currency: texto(p['currency'], 'COP'),
      limites: {
        investigaciones_mes: numero(lim['investigaciones_mes']),
        tokens_mes: numero(lim['tokens_mes']),
        max_pasos: numero(lim['max_pasos'], 6),
        modelos: Array.isArray(mods) ? mods.filter((m): m is string => typeof m === 'string') : [],
      },
    };
  });
}

export async function fetchSuscripcion(): Promise<Suscripcion> {
  const b = await authJson<Record<string, unknown>>('/billing/subscription');
  return {
    plan: texto(b['plan'], 'free'),
    plan_name: texto(b['plan_name'], 'Gratuito'),
    status: texto(b['status'], 'free'),
    current_period_end: typeof b['current_period_end'] === 'string' ? b['current_period_end'] : null,
    cancel_at_period_end: booleano(b['cancel_at_period_end']),
  };
}

export async function fetchUso(): Promise<Uso> {
  const b = await authJson<Record<string, unknown>>('/billing/usage');
  const inv = esRegistro(b['investigaciones']) ? b['investigaciones'] : {};
  const tok = esRegistro(b['tokens']) ? b['tokens'] : {};
  return {
    plan: texto(b['plan'], 'free'),
    period: texto(b['period']),
    reset_at: texto(b['reset_at']),
    investigaciones: { used: numero(inv['used']), limit: numero(inv['limit']), remaining: numero(inv['remaining']) },
    tokens: { used: numero(tok['used']), limit: numero(tok['limit']), remaining: numero(tok['remaining']) },
  };
}

export async function fetchEntitlements(): Promise<Entitlements> {
  const b = await authJson<Record<string, unknown>>('/billing/entitlements');
  const mods = b['modelos'];
  return {
    plan: texto(b['plan'], 'free'),
    puede_investigar: booleano(b['puede_investigar']),
    max_pasos: numero(b['max_pasos'], 6),
    modelos: Array.isArray(mods) ? mods.filter((m): m is string => typeof m === 'string') : [],
    investigaciones_restantes: numero(b['investigaciones_restantes']),
    tokens_restantes: numero(b['tokens_restantes']),
  };
}

export async function iniciarCheckout(plan: string): Promise<Checkout> {
  const b = await authJson<Record<string, unknown>>('/billing/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan }),
  });
  const monto = b['amount_minor'];
  return {
    checkout_id: texto(b['checkout_id']),
    checkout_url: texto(b['checkout_url']),
    plan: texto(b['plan'], plan),
    amount_minor: typeof monto === 'number' ? monto : 0,
    currency: texto(b['currency'], 'COP'),
  };
}

export async function simularDecision(checkoutId: string, aprobar: boolean): Promise<SimuladorDecision> {
  const b = await authJson<Record<string, unknown>>(
    `/billing/sandbox/checkouts/${encodeURIComponent(checkoutId)}/${aprobar ? 'approve' : 'decline'}`,
    { method: 'POST' },
  );
  const payload = b['payload'];
  return {
    webhook_url: texto(b['webhook_url'], '/billing/webhooks/sandbox'),
    signature_header: texto(b['signature_header'], 'x-sandbox-signature'),
    signature: texto(b['signature']),
    payload: esRegistro(payload) ? payload : {},
  };
}

/**
 * Relevamiento del webhook desde la UI: envía el cuerpo crudo exacto
 * (JSON.stringify del payload) con la firma del simulador. Sin auth de
 * usuario: la firma es la credencial. Se usa fetch directo (no authFetch)
 * para que un 401 de firma no cierre la sesión local.
 */
export async function entregarWebhook(dec: SimuladorDecision): Promise<Record<string, unknown>> {
  const crudo = JSON.stringify(dec.payload);
  const r = await fetch(`${API}${dec.webhook_url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', [dec.signature_header]: dec.signature },
    body: crudo,
  });
  const txt = await r.text().catch(() => '');
  let cuerpo: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(txt);
    if (esRegistro(parsed)) cuerpo = parsed;
  } catch {
    cuerpo = { respuesta: txt.slice(0, 300) };
  }
  if (!r.ok) {
    const msg = typeof cuerpo['message'] === 'string' ? (cuerpo['message'] as string) : txt.slice(0, 300) || r.statusText;
    throw new AuthHttpError(r.status, msg);
  }
  return cuerpo;
}

export async function cancelarSuscripcion(): Promise<Record<string, unknown>> {
  return authJson<Record<string, unknown>>('/billing/subscription/cancel', { method: 'POST' });
}

export async function reanudarSuscripcion(): Promise<Record<string, unknown>> {
  return authJson<Record<string, unknown>>('/billing/subscription/resume', { method: 'POST' });
}

export async function cambiarPlan(plan: string): Promise<Record<string, unknown>> {
  return authJson<Record<string, unknown>>('/billing/subscription/change-plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan }),
  });
}

export async function fetchPagos(): Promise<Pago[]> {
  const b = await authJson<{ payments: unknown }>('/billing/payments');
  if (!Array.isArray(b.payments)) return [];
  return b.payments
    .filter(esRegistro)
    .map((p) => ({
      id: texto(p['id']),
      plan: texto(p['plan']),
      amount_minor: numero(p['amount_minor']),
      currency: texto(p['currency'], 'COP'),
      status: texto(p['status']),
      provider: texto(p['provider']),
      created_at: texto(p['created_at']),
    }))
    .filter((p) => p.id.length > 0);
}

export async function fetchHistorial(): Promise<{ plan: string; eventos: EventoSuscripcion[] }> {
  const b = await authJson<Record<string, unknown>>('/billing/subscription/history');
  const ev = b['events'];
  return {
    plan: texto(b['plan']),
    eventos: Array.isArray(ev)
      ? ev.filter(esRegistro).map((e) => ({
          type: texto(e['type']),
          from: texto(e['from']),
          to: texto(e['to']),
          meta: esRegistro(e['meta']) ? e['meta'] : {},
          created_at: texto(e['created_at']),
        }))
      : [],
  };
}

// ——— Admin ———

export async function adminListarUsuarios(busqueda: string): Promise<{ total: number; usuarios: AdminUsuario[] }> {
  const q = new URLSearchParams({ limit: '20', offset: '0' });
  if (busqueda.trim()) q.set('search', busqueda.trim());
  const b = await authJson<Record<string, unknown>>(`/admin/users?${q.toString()}`);
  const lista = b['users'];
  return {
    total: numero(b['total']),
    usuarios: Array.isArray(lista)
      ? lista.filter(esRegistro).map((u) => ({ ...comoMe(u), status: texto(u['status'], 'active') }))
      : [],
  };
}

export async function adminCambiarEstado(id: string, estado: 'active' | 'disabled'): Promise<void> {
  await authJson<unknown>(`/admin/users/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: estado }),
  });
}

export async function adminCambiarRol(id: string, rol: 'user' | 'admin'): Promise<void> {
  await authJson<unknown>(`/admin/users/${id}/role`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: rol }),
  });
}

export async function adminResetTotp(id: string): Promise<string> {
  const b = await authJson<{ message: string }>(`/admin/users/${id}/totp/reset`, { method: 'POST' });
  return b.message;
}

export async function adminOtorgarPlan(userId: string, plan: string, dias: number): Promise<Record<string, unknown>> {
  return authJson<Record<string, unknown>>('/admin/billing/grant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, plan, days: dias }),
  });
}

export interface AccessModeAdmin {
  mode: string;
  static_code_configured: boolean;
  env_whitelist_count: number;
  db_whitelist_count: number;
  db_codes_active: number;
}

export interface WhitelistEntry {
  id: string;
  pattern: string;
  label: string | null;
  created_at: string;
}

export interface AccessCodeRow {
  id: string;
  label: string | null;
  max_uses: number;
  used_count: number;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface AccessCodeCreated extends AccessCodeRow {
  code: string;
}

export async function adminAccessMode(): Promise<AccessModeAdmin> {
  const b = await authJson<unknown>('/admin/access/mode');
  const r = esRegistro(b) ? b : {};
  return {
    mode: texto(r['mode'], 'public'),
    static_code_configured: booleano(r['static_code_configured']),
    env_whitelist_count: numero(r['env_whitelist_count']),
    db_whitelist_count: numero(r['db_whitelist_count']),
    db_codes_active: numero(r['db_codes_active']),
  };
}

function comoWhitelist(v: unknown): WhitelistEntry {
  const b = esRegistro(v) ? v : {};
  return {
    id: texto(b['id']),
    pattern: texto(b['pattern']),
    label: typeof b['label'] === 'string' ? b['label'] : null,
    created_at: texto(b['created_at']),
  };
}

export async function adminWhitelistList(): Promise<WhitelistEntry[]> {
  const b = await authJson<Record<string, unknown>>('/admin/access/whitelist');
  const lista = b['entries'];
  return Array.isArray(lista) ? lista.map(comoWhitelist) : [];
}

export async function adminWhitelistAdd(pattern: string, label: string): Promise<WhitelistEntry> {
  const b = await authJson<unknown>('/admin/access/whitelist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pattern, label: label || undefined }),
  });
  return comoWhitelist(b);
}

export async function adminWhitelistRemove(id: string): Promise<void> {
  await authJson<unknown>(`/admin/access/whitelist/${id}`, { method: 'DELETE' });
}

function comoCode(v: unknown): AccessCodeRow {
  const b = esRegistro(v) ? v : {};
  return {
    id: texto(b['id']),
    label: typeof b['label'] === 'string' ? b['label'] : null,
    max_uses: numero(b['max_uses']),
    used_count: numero(b['used_count']),
    expires_at: typeof b['expires_at'] === 'string' ? b['expires_at'] : null,
    revoked_at: typeof b['revoked_at'] === 'string' ? b['revoked_at'] : null,
    created_at: texto(b['created_at']),
  };
}

export async function adminCodesList(): Promise<AccessCodeRow[]> {
  const b = await authJson<Record<string, unknown>>('/admin/access/codes');
  const lista = b['codes'];
  return Array.isArray(lista) ? lista.map(comoCode) : [];
}

export async function adminCodeCreate(
  label: string,
  maxUses: number,
  expiresInDays: number | null,
): Promise<AccessCodeCreated> {
  const b = await authJson<unknown>('/admin/access/codes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      label: label || undefined,
      max_uses: maxUses,
      expires_in_days: expiresInDays ?? undefined,
    }),
  });
  const r = esRegistro(b) ? b : {};
  return { ...comoCode(b), code: texto(r['code']) };
}

export async function adminCodeRevoke(id: string): Promise<void> {
  await authJson<unknown>(`/admin/access/codes/${id}/revoke`, { method: 'POST' });
}
