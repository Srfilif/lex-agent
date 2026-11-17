// Configuración centralizada y validada (único lector de process.env).
// Falla rápido al arrancar ante formatos inválidos. Sin nuevas dependencias.
import { dirname, isAbsolute, join, resolve } from 'path';
import { existsSync } from 'fs';
import { loadDotenv } from './dotenv';

export interface AuthConfig {
  jwtSecret: string;
  accessTtlMin: number;
  refreshTtlDays: number;
  inactivityDays: number;
  maxSessions: number;
  secureCookies: boolean;
  appBaseUrl: string;
  /** I2: admin exige sesión con MFA. Default: true solo en producción. */
  adminMfaRequired: boolean;
  /** false → secretos de desarrollo (solo local); warn al arrancar. */
  secretsConfigured: boolean;
}

export interface TotpConfig {
  /** Clave AES-256 externa a la DB, 64 hex chars (32 bytes). */
  encryptionKeyHex: string;
  windowSteps: number;
  stepSec: number;
  mfaTtlMin: number;
  secretsConfigured: boolean;
}

export interface BillingConfig {
  /** Fase F: solo 'sandbox'. Otro valor = fallo rápido. */
  provider: string;
  webhookSecret: string;
  secretsConfigured: boolean;
}

export interface AppConfig {
  /** I1: development | test | production. Producción endurece secretos/CORS. */
  nodeEnv: string;
  /** I2: orígenes CORS permitidos (csv). Vacío = solo mismo origen en prod. */
  corsOrigins: string[];
  /** I2: /agent/investigate anónimo (legado). Default: false en producción. */
  allowAnonInvestigate: boolean;
  /** I1: rate-limit distribuido. Vacío = memoria (una réplica). */
  redisUrl: string;
  /** I1: SMTP (nodemailer). Vacío = LogEmailSender (dev). Prod lo exige. */
  smtpUrl: string;
  smtpFrom: string;
  port: number;
  databaseUrl: string;
  /** Motor de DB: postgres (prod/docker) o sqlite (dev local sin Postgres). */
  databaseProvider: 'postgres' | 'sqlite';
  /** Ruta del fichero sqlite (solo si databaseProvider=sqlite). */
  sqlitePath: string;
  metaBaseUrl: string;
  metaModel: string;
  /** B7: catálogo de modelos de chat verificados (`CHAT_MODELS`, csv). */
  chatModels: string[];
  /** B10: tope estimado de tokens del prompt por mensaje (`CHAT_MAX_PROMPT_TOKENS`). */
  chatMaxPromptTokens: number;
  /** B10: timeout por llamada al Model API en ms (`META_TIMEOUT_MS`). */
  metaTimeoutMs: number;
  /** B10: timeout por lote de embeddings en ms (`OLLAMA_TIMEOUT_MS`). */
  ollamaTimeoutMs: number;
  metaApiKey: string;
  ollamaHost: string;
  ollamaModel: string;
  /** Proveedor de embeddings: meta, ollama local o gemini (key propia). */
  embedProvider: 'meta' | 'ollama' | 'gemini';
  /** Modelo de embeddings Meta (`META_EMBED_MODEL`); vacío = META_MODEL. */
  metaEmbedModel: string;
  /** Base del proveedor dedicado de embeddings (`EMBED_BASE_URL`, gemini). */
  embedBaseUrl: string;
  /** Modelo del proveedor dedicado (`EMBED_MODEL`, default gemini-embedding-001). */
  embedModel: string;
  /** Key del proveedor dedicado (`EMBED_API_KEY`, solo embeddings). */
  embedApiKey: string;
  secopAppToken: string;
  /** Directorio de originales de archivos de proyecto (B6). Se crea si falta. */
  projectFilesDir: string;
  auth: AuthConfig;
  totp: TotpConfig;
  billing: BillingConfig;
}

export const CONFIG = Symbol('APP_CONFIG');

function str(v: string | undefined, def: string): string {
  const t = (v ?? def).trim();
  return t;
}

function url(v: string | undefined, def: string, name: string): string {
  const s = str(v, def).replace(/\/$/, '');
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error();
    return s;
  } catch {
    throw new Error(`Config inválida: ${name} no es una URL http(s): ${s || '(vacía)'}`);
  }
}

function port(v: string | undefined): number {
  const n = Number(v ?? 3000);
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    throw new Error(`Config inválida: PORT debe ser 1-65535, recibido: ${v}`);
  }
  return n;
}

// SQLITE_PATH relativo se ancla al dir del .env: migrate/seed/dev abren el
// mismo fichero se corran desde la raíz o desde apps/api.
function resolveSqlite(p: string, envDir: string | null): string {
  if (!envDir || isAbsolute(p)) return p;
  return join(envDir, p);
}

function dbProvider(v: string | undefined): 'postgres' | 'sqlite' {
  const p = str(v, 'postgres').toLowerCase();
  if (p !== 'postgres' && p !== 'sqlite') {
    throw new Error(`Config inválida: DATABASE_PROVIDER debe ser postgres|sqlite, recibido: ${v}`);
  }
  return p;
}

function embedProvider(v: string | undefined): 'meta' | 'ollama' | 'gemini' {
  const p = str(v, 'ollama').toLowerCase();
  if (p !== 'meta' && p !== 'ollama' && p !== 'gemini') {
    throw new Error(`Config inválida: EMBED_PROVIDER debe ser meta|ollama|gemini, recibido: ${v}`);
  }
  return p;
}

/** B7: csv → lista única no vacía; el modelo por defecto siempre va primero. */
function chatModels(metaModel: string, v: string | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of [metaModel, ...(v ?? '').split(',')]) {
    const t = m.trim();
    if (t && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  if (!out.length) throw new Error('Config inválida: CHAT_MODELS vacío y META_MODEL vacío');
  return out;
}

function intRange(v: string | undefined, def: number, name: string, min: number, max: number): number {
  const n = Number(v ?? def);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new Error(`Config inválida: ${name} debe ser ${min}-${max}, recibido: ${v}`);
  }
  return n;
}

function billing(e: NodeJS.ProcessEnv, nodeEnv: string): BillingConfig {
  const provider = str(e.BILLING_PROVIDER, 'sandbox').toLowerCase();
  if (provider !== 'sandbox') {
    throw new Error(
      `Config inválida: BILLING_PROVIDER='${provider}' sin adaptador (Fase F: solo 'sandbox')`,
    );
  }
  const fromEnv = str(e.BILLING_WEBHOOK_SECRET, '');
  if (nodeEnv === 'production' && !fromEnv) {
    throw new Error('Config inválida: producción exige BILLING_WEBHOOK_SECRET (sin default dev)');
  }
  if (!fromEnv) {
    // eslint-disable-next-line no-console
    console.warn('[billing] BILLING_WEBHOOK_SECRET ausente: usando secreto de desarrollo (solo local)');
  }
  return {
    provider,
    webhookSecret: fromEnv || 'dev-webhook-sandbox-solo-local-0123456789',
    secretsConfigured: fromEnv.length > 0,
  };
}

const DEV_JWT_SECRET = 'dev-solo-local-inseguro-cambieme-0123456789abcdef';
// 32 bytes fijos SOLO para desarrollo local (nunca producción).
const DEV_TOTP_KEY = '0123456789abcdef'.repeat(4);

function totp(e: NodeJS.ProcessEnv, nodeEnv: string): TotpConfig {
  const fromEnv = str(e.TOTP_ENCRYPTION_KEY, '');
  const secretsConfigured = fromEnv.length > 0;
  if (nodeEnv === 'production' && !secretsConfigured) {
    throw new Error('Config inválida: producción exige TOTP_ENCRYPTION_KEY (sin default dev)');
  }
  const key = secretsConfigured ? fromEnv : DEV_TOTP_KEY;
  if (!/^[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error('Config inválida: TOTP_ENCRYPTION_KEY debe ser 64 hex chars (32 bytes)');
  }
  if (!secretsConfigured) {
    // eslint-disable-next-line no-console
    console.warn('[auth] TOTP_ENCRYPTION_KEY ausente: usando clave de desarrollo (solo local)');
  }
  return {
    encryptionKeyHex: key.toLowerCase(),
    windowSteps: intRange(e.TOTP_WINDOW, 1, 'TOTP_WINDOW', 0, 2),
    stepSec: intRange(e.TOTP_STEP_SEC, 30, 'TOTP_STEP_SEC', 30, 60),
    mfaTtlMin: intRange(e.MFA_TOKEN_TTL_MIN, 5, 'MFA_TOKEN_TTL_MIN', 1, 15),
    secretsConfigured,
  };
}

function boolEnv(v: string | undefined, def: boolean): boolean {
  if (v === undefined) return def;
  return v.toLowerCase() === 'true';
}

function auth(e: NodeJS.ProcessEnv, nodeEnv: string): AuthConfig {
  const fromEnv = str(e.AUTH_JWT_SECRET, '');
  const secretsConfigured = fromEnv.length > 0;
  if (nodeEnv === 'production' && !secretsConfigured) {
    throw new Error('Config inválida: producción exige AUTH_JWT_SECRET (sin default dev)');
  }
  const jwtSecret = secretsConfigured ? fromEnv : DEV_JWT_SECRET;
  if (jwtSecret.length < 32) {
    throw new Error('Config inválida: AUTH_JWT_SECRET debe tener ≥32 caracteres');
  }
  if (!secretsConfigured) {
    // eslint-disable-next-line no-console
    console.warn('[auth] AUTH_JWT_SECRET ausente: usando secreto de desarrollo (solo local)');
  }
  const secureCookies = boolEnv(e.AUTH_SECURE_COOKIES, false);
  if (nodeEnv === 'production' && !secureCookies) {
    throw new Error('Config inválida: producción exige AUTH_SECURE_COOKIES=true');
  }
  return {
    jwtSecret,
    accessTtlMin: intRange(e.AUTH_ACCESS_TTL_MIN, 15, 'AUTH_ACCESS_TTL_MIN', 1, 120),
    refreshTtlDays: intRange(e.AUTH_REFRESH_TTL_DAYS, 30, 'AUTH_REFRESH_TTL_DAYS', 1, 90),
    inactivityDays: intRange(e.AUTH_INACTIVITY_DAYS, 7, 'AUTH_INACTIVITY_DAYS', 1, 30),
    maxSessions: intRange(e.AUTH_MAX_SESSIONS, 10, 'AUTH_MAX_SESSIONS', 1, 50),
    secureCookies,
    appBaseUrl: url(e.APP_BASE_URL, 'http://localhost:4173', 'APP_BASE_URL'),
    adminMfaRequired: boolEnv(e.ADMIN_MFA_REQUIRED, nodeEnv === 'production'),
    secretsConfigured,
  };
}

function findEnvDir(fromDir: string): string | null {
  let dir = resolve(fromDir);
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, '.env'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

export function loadAppConfig(fromDir: string = __dirname): AppConfig {
  const root = findEnvDir(fromDir);
  if (root) loadDotenv(root);
  const e = process.env;
  const nodeEnv = str(e.NODE_ENV, 'development').toLowerCase();
  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    throw new Error(`Config inválida: NODE_ENV debe ser development|test|production, recibido: ${e.NODE_ENV}`);
  }
  const corsOrigins = (e.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);
  if (nodeEnv === 'production') {
    for (const o of corsOrigins) {
      try {
        const u = new URL(o);
        if (u.protocol !== 'https:') throw new Error();
      } catch {
        throw new Error(`Config inválida: CORS_ORIGINS en producción exige https: ${o}`);
      }
    }
  }
  const smtpUrl = str(e.SMTP_URL, '');
  if (nodeEnv === 'production' && !smtpUrl) {
    throw new Error('Config inválida: producción exige SMTP_URL (verificación/recuperación)');
  }
  if (nodeEnv === 'production' && !str(e.REDIS_URL, '')) {
    // eslint-disable-next-line no-console
    console.warn('[auth] REDIS_URL ausente: rate-limit en memoria (válido solo con 1 réplica)');
  }
  return {
    nodeEnv,
    corsOrigins,
    allowAnonInvestigate: boolEnv(e.ALLOW_ANON_INVESTIGATE, nodeEnv !== 'production'),
    redisUrl: str(e.REDIS_URL, ''),
    smtpUrl,
    smtpFrom: str(e.SMTP_FROM, 'LexAgent <no-reply@lex.local>'),
    port: port(e.PORT),
    databaseUrl: str(e.DATABASE_URL, 'postgres://lex:lexdev@localhost:5433/lexdb'),
    databaseProvider: dbProvider(e.DATABASE_PROVIDER),
    sqlitePath: resolveSqlite(str(e.SQLITE_PATH, 'data/lexdb.sqlite'), root),
    metaBaseUrl: url(e.META_BASE_URL, 'https://api.meta.ai/v1', 'META_BASE_URL'),
    metaModel: str(e.META_MODEL, 'muse-spark-1.3'),
    // B7: verificados con chat real 2026-10-27 (wonder-1.0, spark-1.2/1.3).
    chatModels: chatModels(
      str(e.META_MODEL, 'muse-spark-1.3'),
      e.CHAT_MODELS ?? 'muse-spark-1.3,muse-wonder-1.0,muse-spark-1.2',
    ),
    chatMaxPromptTokens: intRange(e.CHAT_MAX_PROMPT_TOKENS, 12000, 'CHAT_MAX_PROMPT_TOKENS', 1000, 200000),
    metaTimeoutMs: intRange(e.META_TIMEOUT_MS, 120000, 'META_TIMEOUT_MS', 5000, 600000),
    ollamaTimeoutMs: intRange(e.OLLAMA_TIMEOUT_MS, 60000, 'OLLAMA_TIMEOUT_MS', 5000, 600000),
    metaApiKey: str(e.META_API_KEY, ''),
    ollamaHost: url(e.OLLAMA_HOST, 'http://localhost:11434', 'OLLAMA_HOST'),
    ollamaModel: str(e.OLLAMA_MODEL, 'bge-m3'),
    embedProvider: embedProvider(e.EMBED_PROVIDER),
    metaEmbedModel: str(e.META_EMBED_MODEL, '') || str(e.META_MODEL, 'muse-spark-1.3'),
    embedBaseUrl: url(
      e.EMBED_BASE_URL,
      'https://generativelanguage.googleapis.com/v1beta',
      'EMBED_BASE_URL',
    ),
    embedModel: str(e.EMBED_MODEL, 'gemini-embedding-001'),
    embedApiKey: str(e.EMBED_API_KEY, ''),
    secopAppToken: str(e.SECOP_APP_TOKEN, ''),
    projectFilesDir: str(e.PROJECT_FILES_DIR, 'data/project-files'),
    auth: auth(e, nodeEnv),
    totp: totp(e, nodeEnv),
    billing: billing(e, nodeEnv),
  };
}
