// Modos de acceso a la plataforma (núcleo compartido, sin dependencias).
// public: registro libre. maintenance: solo admins (bloqueo total).
// closed: sin registros nuevos (los existentes entran).
// whitelist: registro y sesiones solo para correos/patrones autorizados.
// code: registro solo con código de acceso válido.
export type AccessMode = 'public' | 'maintenance' | 'closed' | 'whitelist' | 'code';

export const ACCESS_MODES: AccessMode[] = ['public', 'maintenance', 'closed', 'whitelist', 'code'];

/**
 * Resuelve el valor de ACCESS_MODE. Acepta `open` como alias histórico de
 * `public`. Default `public`. Lanza Error (falla rápido al arrancar).
 */
export function resolveAccessMode(v: string | undefined): AccessMode {
  const t = (v ?? 'public').trim().toLowerCase();
  if (t === 'open') return 'public';
  if ((ACCESS_MODES as string[]).includes(t)) return t as AccessMode;
  throw new Error(`Config inválida: ACCESS_MODE debe ser ${ACCESS_MODES.join('|')}`);
}
