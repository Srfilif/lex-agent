// Preferencias de cuenta: valores validados + defaults. parse() es total
// (lo inválido cae al default); los DTOs ya filtran en el borde HTTP.

export type Theme = 'light' | 'dark' | 'system';
export type DetailLevel = 'breve' | 'normal' | 'detallado';
export type ResponseFormat = 'texto' | 'markdown';

export interface AiPreferences {
  /** null = modelo por defecto del servidor. Validado contra el plan al guardar. */
  model: string | null;
  detail: DetailLevel;
  responseFormat: ResponseFormat;
  /** B8: memoria cruzada (hechos entre hilos). Opt-in, default false. */
  crossMemory: boolean;
}

export interface NotificationPreferences {
  emailSecurity: boolean;
}

export interface Preferences {
  theme: Theme;
  language: string;
  timezone: string;
  notifications: NotificationPreferences;
  ai: AiPreferences;
}

export const DEFAULT_PREFERENCES: Preferences = {
  theme: 'system',
  language: 'es',
  timezone: 'America/Bogota',
  notifications: { emailSecurity: true },
  ai: { model: null, detail: 'normal', responseFormat: 'markdown', crossMemory: false },
};

const THEMES: Theme[] = ['light', 'dark', 'system'];
const LANGUAGES = ['es', 'en'];
const DETAILS: DetailLevel[] = ['breve', 'normal', 'detallado'];
const FORMATS: ResponseFormat[] = ['texto', 'markdown'];
const TIMEZONE_RE = /^[A-Za-z_]{1,32}\/[A-Za-z0-9_+\-]{1,32}$/;

function pick<T extends string>(v: unknown, allowed: T[], def: T): T {
  return typeof v === 'string' && (allowed as string[]).includes(v) ? (v as T) : def;
}

/** Fusión validada: actual + parche parcial → preferencias completas. */
export function parsePreferences(current: unknown, patch: unknown): Preferences {
  const c = (current ?? {}) as Record<string, unknown>;
  const p = (patch ?? {}) as Record<string, unknown>;
  const get = (k: string): unknown => (p[k] !== undefined ? p[k] : c[k]);
  // Fusión a un nivel en objetos anidados: un parche parcial de `ai` no
  // debe borrar las claves hermanas (p. ej. guardar detail no borra model).
  // Se ignoran claves `undefined`: los DTOs de class-transformer llegan como
  // instancias con campos opcionales propios en undefined, y sin este filtro
  // el spread borraría el valor guardado. `null` explícito sí limpia.
  const clean = (o: unknown): Record<string, unknown> => {
    if (typeof o !== 'object' || o === null) return {};
    return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
  };
  const sub = (k: string): Record<string, unknown> => ({ ...clean(c[k]), ...clean(p[k]) });
  const cNotif = sub('notifications');
  const cAi = sub('ai');
  const tz = get('timezone');
  const model = cAi['model'];
  return {
    theme: pick(get('theme'), THEMES, DEFAULT_PREFERENCES.theme),
    language: pick(get('language'), LANGUAGES, DEFAULT_PREFERENCES.language),
    timezone:
      typeof tz === 'string' && TIMEZONE_RE.test(tz) ? tz : DEFAULT_PREFERENCES.timezone,
    notifications: {
      emailSecurity:
        typeof cNotif['emailSecurity'] === 'boolean'
          ? cNotif['emailSecurity']
          : DEFAULT_PREFERENCES.notifications.emailSecurity,
    },
    ai: {
      model:
        model === null || model === undefined
          ? null
          : typeof model === 'string' && model.length > 0 && model.length <= 80
            ? model
            : null,
      detail: pick(cAi['detail'], DETAILS, DEFAULT_PREFERENCES.ai.detail),
      responseFormat: pick(cAi['responseFormat'], FORMATS, DEFAULT_PREFERENCES.ai.responseFormat),
      crossMemory:
        typeof cAi['crossMemory'] === 'boolean'
          ? cAi['crossMemory']
          : DEFAULT_PREFERENCES.ai.crossMemory,
    },
  };
}
