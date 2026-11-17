// Puerto de lectura del corpus (necesidades del dominio, sin pg).

export interface CorpusFiltros {
  tipo?: string;
  emisor?: string;
  numero?: string;
  jurisdiccion?: string;
  tema?: string;
}

export interface DocumentoCobertura {
  titulo: string;
  numero: string | null;
  tipo: string;
  emisor: string;
  jurisdiccion: string | null;
  vigencia: string;
  chunks: number;
  fecha_consulta: string | Date | null;
}

export interface ChunkRow {
  chunk_id: string;
  ruta: string;
  texto: string;
  texto_contexto: string;
  titulo: string;
  numero: string;
  tipo: string;
  url_original: string;
  /** D2: vigencia/autoridad/fecha tal cual están registradas. */
  vigencia: string;
  autoridad: string;
  fecha_consulta: string | Date | null;
}

export interface ChunkRef {
  chunk_id: string;
  ruta: string;
  texto: string;
}

export const CORPUS_REPOSITORY = Symbol('CORPUS_REPOSITORY');

export interface NuevoDocumento {
  titulo: string;
  emisor: string;
  tipo: string;
  fecha: string | null;
  numero: string;
  tema: string;
  autoridad: string;
  url_original: string;
  hash: string;
  /**
   * D2: vigencia declarada en el manifiesto (p. ej. 'vigente' con fuente
   * oficial). Si se omite, queda 'vigencia_desconocida' (honesto).
   */
  vigencia?: string;
}

export interface NuevoChunk {
  ruta: string;
  offset_inicio: number;
  offset_fin: number;
  texto: string;
  texto_contexto: string;
  /** null = ingesta degradada (solo FTS, sin vector). */
  embedding: number[] | null;
}

export interface CorpusRepository {
  structuredByArticle(
    articulo: string,
    numeroRef: string | undefined,
    f: CorpusFiltros,
  ): Promise<ChunkRow[]>;
  ftsRanked(query: string, f: CorpusFiltros, limit: number): Promise<string[]>;
  vectorRanked(embedding: number[], f: CorpusFiltros, limit: number): Promise<string[]>;
  chunksByIds(ids: string[]): Promise<ChunkRow[]>;
  /** Fragmento o null (id inexistente o inválido). Camino HTTP 404. */
  chunkById(id: string): Promise<ChunkRow | null>;
  /** D1: cobertura honesta del corpus (documentos + conteo de fragmentos). */
  documentStats(): Promise<DocumentoCobertura[]>;
  /** Referencia o null si no existe; propaga errores (p. ej. UUID inválido). Camino verificar_cita. */
  chunkRef(id: string): Promise<ChunkRef | null>;
  /** Documento por hash de contenido (idempotencia de ingesta). */
  findDocumentByHash(hash: string): Promise<{ id: string; titulo: string } | null>;
  /** Inserta documento + chunks en una transacción. Devuelve id y nº de chunks. */
  saveDocumentWithChunks(doc: NuevoDocumento, chunks: NuevoChunk[]): Promise<{ docId: string; chunks: number }>;
}
