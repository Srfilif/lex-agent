// Puertos de aplicación del módulo chat.
// I1: FileStorage abstrae el guardado de originales (hoy disco local;
// un adaptador S3 futuro implementa este mismo puerto sin tocar casos de uso).
export const FILE_STORAGE = Symbol('FILE_STORAGE');

export interface FileStorage {
  /** Guarda el buffer en `relPath` (relativo a la raíz configurada). */
  write(relPath: string, data: Buffer): Promise<void>;
  /** Lee el original; lanza si falta. */
  read(relPath: string): Promise<Buffer>;
  /** Borra best-effort; no lanza si falta. */
  remove(relPath: string): Promise<void>;
}
