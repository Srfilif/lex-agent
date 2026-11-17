// Ayudas puras para el dialecto dual postgres/sqlite (sin dependencias).
// Nada aquí toca red ni DB: todo es unit-testeable.
import { randomUUID } from 'crypto';

/**
 * $1,$2... → ?,?,... con params reordenados (node:sqlite usa ? posicionales).
 * Soporta $n repetidos y desordenados (misma semántica que pg).
 * Los $n dentro de strings SQL no se tocan. Falla alto si falta un parámetro
 * (sqlite los pondría NULL en silencio) y si hay ? crudos fuera de strings
 * (todo el SQL del repo usa $n; los ? romperían el mapeo).
 */
export function toPositional(sql: string, params: unknown[]): { text: string; params: unknown[] } {
  let text = '';
  const out: unknown[] = [];
  let quote: string | null = null;
  let i = 0;
  let sawDollar = false;
  while (i < sql.length) {
    const c = sql[i];
    if (quote) {
      text += c;
      if (c === quote) {
        // '' escapado dentro de string: consume el par sin cerrar
        if (sql[i + 1] === quote) {
          text += sql[i + 1];
          i += 2;
          continue;
        }
        quote = null;
      }
      i++;
      continue;
    }
    if (c === "'" || c === '"') {
      quote = c;
      text += c;
      i++;
      continue;
    }
    if (c === '$') {
      const m = /^\$(\d+)/.exec(sql.slice(i));
      if (m) {
        const n = Number(m[1]);
        if (!Number.isInteger(n) || n < 1 || n > params.length) {
          throw new Error(`placeholder $${m[1]} sin parámetro (recibidos: ${params.length})`);
        }
        text += '?';
        out.push(params[n - 1]);
        i += m[0].length;
        sawDollar = true;
        continue;
      }
    }
    if (c === '?' && (sawDollar || params.length > 0)) {
      throw new Error('? crudo en SQL con parámetros: usa $n posicionales');
    }
    text += c;
    i++;
  }
  return { text, params: out };
}

/** Normaliza un valor timestamptz leído de la DB (pg: Date, sqlite: string ISO). */
export function asDate(v: unknown): Date {
  if (v instanceof Date) return v;
  return new Date(v as string);
}

/** Variante nulable (revoked_at, deleted_at, ...). */
export function asDateOrNull(v: unknown): Date | null {
  if (v === null || v === undefined) return null;
  return asDate(v);
}

/** Normaliza un JSONB leído de la DB (pg: objeto, sqlite: string). */
export function asJson<T>(v: unknown, fallback: T): T {
  if (v === null || v === undefined) return fallback;
  if (typeof v !== 'string') return v as T;
  try {
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
}

/** Normaliza un booleano leído de la DB (pg: boolean, sqlite: 0/1). */
export function asBool(v: unknown): boolean {
  return v === true || v === 1 || v === '1' || v === 'true' || v === 't';
}

/** Normaliza un TEXT[] leído de la DB (pg: array, sqlite: JSON string). */
export function asStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string');
  return asJson<string[]>(v, []).filter((x): x is string => typeof x === 'string');
}

/** Similitud coseno (fallback vectorial en sqlite, sin pgvector). */
export function cosine(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

const STOPWORDS = new Set([
  'de', 'la', 'el', 'en', 'y', 'del', 'al', 'los', 'las', 'un', 'una',
  'por', 'para', 'con', 'que', 'se', 'no', 'su', 'sus', 'como', 'más',
]);

/** Términos de búsqueda para el fallback LIKE (minúsculas, sin stops/1 letra, máx 10). */
export function termsForLike(query: string): string[] {
  const terms = query
    .toLowerCase()
    .split(/[^a-záéíóúñü0-9]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
  return [...new Set(terms)].slice(0, 10);
}

/** Corte UTC 'YYYY-MM-DD HH:MM:SS' de hace N días (reemplaza now() - interval). */
export function cutoffDays(days: number, nowMs: number = Date.now()): string {
  return new Date(nowMs - days * 86400 * 1000).toISOString().slice(0, 19).replace('T', ' ');
}

/** Corte UTC 'YYYY-MM-DD HH:MM:SS' de hace N años (purga). */
export function cutoffYears(years: number, nowMs: number = Date.now()): string {
  const d = new Date(nowMs);
  d.setUTCFullYear(d.getUTCFullYear() - years);
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

/** UUID v4 para INSERTs que lo necesiten explícito (seed, sqlite). */
export function newUuid(): string {
  return randomUUID();
}

/** Diagnóstico accionable de un error DB, sin filtrar secretos (nunca URLs). */
export function describeDbError(e: unknown): string {
  const err = e as { message?: string; code?: string; errors?: unknown[] };
  const partes = [err?.message ?? String(e)];
  const codes: string[] = [];
  if (err?.code) codes.push(err.code);
  if (Array.isArray(err?.errors)) {
    for (const x of err.errors) {
      const m = (x as { message?: string })?.message;
      const c = (x as { code?: string })?.code;
      if (m) partes.push(m);
      if (c) codes.push(c);
    }
  }
  const msg = partes.filter(Boolean).join(' | ') || 'error desconocido';
  const pistas: Record<string, string> = {
    ECONNREFUSED: 'DB no alcanzable: levántala (docker compose up -d db) o revisa DATABASE_URL en el .env',
    ENOTFOUND: 'host de la DB no existe: revisa DATABASE_URL en el .env',
    '28P01': 'clave rechazada: revisa DB_PASSWORD / DATABASE_URL en el .env',
    '3D000': 'la base de datos no existe: créala (CREATE DATABASE lexdb) y aplica el baseline',
    '42P01': 'falta una tabla del baseline: aplica db/init.sql + migrations/002-004 antes del runner',
  };
  for (const c of codes) {
    if (pistas[c]) return `${msg} → ${pistas[c]}`;
  }
  if (msg.includes('extension "vector"')) {
    return `${msg} → tu Postgres no tiene pgvector instalado: instálalo o usa docker compose up -d db`;
  }
  return msg;
}
