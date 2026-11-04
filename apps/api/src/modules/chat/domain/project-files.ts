// Dominio B6: archivos de usuario por proyecto. Puro (sin Nest/SQL/HTTP).
// B10-mínimo: cuotas y validaciones como datos, no condicionales dispersos.

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_FILES_PER_PROJECT = 20;
export const MAX_BYTES_PER_PROJECT = 50 * 1024 * 1024;
export const MAX_TEXT_CHARS = 500_000;
export const MAX_CHUNKS_PER_FILE = 2000;
// txt/md hoy: PDF/DOCX requieren librería de parseo (pendiente, ver ROADMAP B6 en docs/producto/ROADMAP.md).
export const ALLOWED_EXTENSIONS = ['.txt', '.md'] as const;

export type ProjectFileStatus = 'ready' | 'failed';

export interface ProjectFileProps {
  id: string;
  projectId: string;
  userId: string;
  filename: string;
  mime: string;
  sizeBytes: number;
  sha256: string;
  storagePath: string;
  status: ProjectFileStatus;
  error: string | null;
  chunkCount: number;
  createdAt: Date;
  /** B10: el texto contenía marcadores de inyección (aviso, no bloqueo). */
  sospechoso: boolean;
}

export class ProjectFile {
  private constructor(private p: ProjectFileProps) {}

  static rehydrate(p: ProjectFileProps): ProjectFile {
    return new ProjectFile({ ...p });
  }

  get snapshot(): ProjectFileProps {
    return { ...this.p };
  }

  get id(): string {
    return this.p.id;
  }

  get userId(): string {
    return this.p.userId;
  }

  markFailed(reason: string): void {
    this.p.status = 'failed';
    this.p.error = reason.slice(0, 300);
  }
}

export interface ProjectChunkProps {
  chunkId: string;
  fileId: string;
  projectId: string;
  n: number;
  ruta: string;
  texto: string;
  textoContexto: string;
}

const QUERY_STOPWORDS = new Set([
  'el', 'la', 'los', 'las', 'de', 'del', 'en', 'y', 'o', 'a', 'ante', 'con',
  'por', 'para', 'segun', 'según', 'mi', 'mis', 'tu', 'tus', 'su', 'sus',
  'que', 'qué', 'cual', 'cuál', 'cuales', 'cómo', 'como', 'donde', 'cuando',
  'es', 'son', 'sea', 'sean', 'está', 'esta', 'este', 'esto', 'estos', 'estas',
  'ese', 'eso', 'hay', 'muy', 'más', 'mas', 'pero', 'sin', 'sobre', 'entre',
  'uno', 'una', 'al', 'lo', 'the', 'of', 'mi', 'segun',
  // Muletillas que rompen el AND del FTS de proyecto:
  'mis', 'archivos', 'archivo', 'documentos', 'documento', 'adjunto', 'subido',
  'indica', 'dice', 'indican', 'dicen', 'explica', 'menciona', 'respecto',
]);

/**
 * Acorta la consulta para el FTS de proyecto: el plainto_tsquery hace AND
 * con todas las palabras y muletillas como "según mis archivos" anulan el
 * match. Conserva hasta 10 términos significativos (>=3 letras, no stopword).
 */
export function shortenProjectQuery(q: string, maxTerms = 10): string {
  const terms = q
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !QUERY_STOPWORDS.has(t))
    .filter((t, i, arr) => arr.indexOf(t) === i)
    .slice(0, maxTerms);
  return terms.length ? terms.join(' ') : q.trim().slice(0, 100);
}

/** Sanea nombre de archivo: basename, sin rutas ni nulos, tope 120. */
export function cleanFilename(raw: string): string {
  const base = raw
    .replace(/\\/g, '/')
    .split('/')
    .pop()
    ?.replace(/\0/g, '')
    .trim();
  if (!base || base === '.' || base === '..') throw new Error('nombre vacío');
  return base.slice(0, 120);
}

export function extensionOf(filename: string): string {
  const i = filename.lastIndexOf('.');
  return i < 0 ? '' : filename.slice(i).toLowerCase();
}

export function isAllowedFile(filename: string): boolean {
  return (ALLOWED_EXTENSIONS as readonly string[]).includes(extensionOf(filename));
}

/** Extrae texto UTF-8; rechaza binarios (nulos) y vacíos. Puro. */
export function extractText(buffer: Buffer, maxChars: number = MAX_TEXT_CHARS): string {
  if (buffer.includes(0)) throw new Error('no es texto plano');
  const text = buffer.toString('utf8').replace(/\r\n?/g, '\n');
  if (!text.trim()) throw new Error('archivo vacío');
  if (text.length > maxChars) throw new Error('texto demasiado largo');
  return text;
}

export function quotaError(kind: 'count' | 'bytes'): string {
  return kind === 'count'
    ? `máximo ${MAX_FILES_PER_PROJECT} archivos por proyecto`
    : `máximo ${Math.round(MAX_BYTES_PER_PROJECT / 1024 / 1024)} MB por proyecto`;
}
