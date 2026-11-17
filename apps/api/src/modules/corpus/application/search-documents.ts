import { Inject, Injectable } from '@nestjs/common';
import {
  CORPUS_REPOSITORY,
  CorpusRepository,
  ChunkRow,
} from '../domain/repositories';
import {
  SearchFiltros,
  SearchHit,
  detectarRef,
  fuseRrf,
  rerank,
} from '../domain/retrieval';
import { EMBEDDING_PORT, EmbeddingPort } from './ports';

/** pg DATE llega como Date; la API expone YYYY-MM-DD (o null). */
function fechaCorta(v: string | Date | null): string | null {
  if (!v) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : v;
}

// Caso de uso: recuperación híbrida (estructurado primero, FTS+vectorial+RRF).
// Orquesta puertos; sin SQL, sin HTTP, sin implementaciones concretas.
@Injectable()
export class SearchDocuments {
  constructor(
    @Inject(CORPUS_REPOSITORY) private readonly repo: CorpusRepository,
    @Inject(EMBEDDING_PORT) private readonly embeddings: EmbeddingPort,
  ) {}

  async execute(q: string, f: SearchFiltros = {}): Promise<{ hits: SearchHit[]; ms: number }> {
    const t0 = Date.now();
    const topK = Math.min(Math.max(f.topK ?? 8, 1), 20);
    const filtros = {
      tipo: f.tipo,
      emisor: f.emisor,
      numero: f.numero,
      jurisdiccion: f.jurisdiccion,
      tema: f.tema,
    };
    const hits: SearchHit[] = [];

    const ref = detectarRef(q);
    if (ref.articulo) {
      const rows = await this.repo.structuredByArticle(ref.articulo, ref.numero, filtros);
      for (const row of rows) hits.push(this.map(row, 1.0, 'estructurado'));
    }

    if (hits.length < topK) {
      const need = topK - hits.length + 5; // margen para dedup
      // Embeddings caídos (API 404, Ollama apagado) → solo FTS, sin tumbar el chat.
      const ftsP = this.repo.ftsRanked(q, filtros, 20);
      const vecP = this.embeddings
        .embed([q])
        .then(([v]) => this.repo.vectorRanked(v, filtros, 20))
        .catch((e: Error): string[] => {
          // eslint-disable-next-line no-console
          console.warn(`[corpus] embeddings no disponibles, solo FTS: ${e.message}`);
          return [];
        });
      const [ftsIds, vecIds] = await Promise.all([ftsP, vecP]);
      const ranked = fuseRrf(ftsIds, vecIds, new Set(hits.map((h) => h.chunk_id)), need);
      if (ranked.length) {
        const rows = await this.repo.chunksByIds(ranked.map((r) => r.id));
        const byId = new Map(rows.map((row) => [row.chunk_id, row]));
        const hibridos: SearchHit[] = [];
        for (const { id, score } of ranked) {
          const row = byId.get(id);
          if (row) hibridos.push(this.map(row, score, 'hibrido'));
        }
        hits.push(...rerank(q, hibridos)); // D3: rerank determinista solo híbridos
      }
    }
    return { hits: hits.slice(0, topK), ms: Date.now() - t0 };
  }

  /** D1: cobertura honesta del corpus (conteos + documentos con vigencia). */
  async coverage(): Promise<{
    documentos: number;
    fragmentos: number;
    docs: Array<{
      titulo: string;
      numero: string | null;
      tipo: string;
      emisor: string;
      jurisdiccion: string | null;
      vigencia: string;
      fragmentos: number;
      fecha_consulta: string | null;
    }>;
  }> {
    const stats = await this.repo.documentStats();
    const docs = stats.map((d) => ({
      titulo: d.titulo,
      numero: d.numero,
      tipo: d.tipo,
      emisor: d.emisor,
      jurisdiccion: d.jurisdiccion,
      vigencia: d.vigencia,
      fragmentos: d.chunks,
      fecha_consulta: fechaCorta(d.fecha_consulta),
    }));
    return {
      documentos: docs.length,
      fragmentos: docs.reduce((a, d) => a + d.fragmentos, 0),
      docs,
    };
  }

  async chunk(id: string): Promise<Record<string, unknown> | null> {
    const row = await this.repo.chunkById(id);
    if (!row) return null;
    return {
      chunk_id: row.chunk_id,
      ruta: row.ruta,
      texto: row.texto,
      texto_contexto: row.texto_contexto,
      doc: {
        titulo: row.titulo,
        numero: row.numero,
        tipo: row.tipo,
        url_original: row.url_original,
        vigencia: row.vigencia,
        autoridad: row.autoridad,
        fecha_consulta: fechaCorta(row.fecha_consulta),
      },
    };
  }

  private map(row: ChunkRow, score: number, metodo: 'estructurado' | 'hibrido'): SearchHit {
    return {
      chunk_id: row.chunk_id,
      ruta: row.ruta,
      texto: row.texto,
      texto_contexto: row.texto_contexto,
      score: Math.round(score * 10000) / 10000,
      metodo,
      doc: {
        titulo: row.titulo,
        numero: row.numero,
        tipo: row.tipo,
        url: row.url_original,
        vigencia: row.vigencia,
        autoridad: row.autoridad,
        fecha_consulta: fechaCorta(row.fecha_consulta),
      },
    };
  }
}
