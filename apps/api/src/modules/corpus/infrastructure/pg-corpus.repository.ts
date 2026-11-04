import { Injectable } from '@nestjs/common';
import { Db } from '../../../db';
import { escapeLike } from '../../../shared/sql';
import {
  ChunkRef,
  ChunkRow,
  CorpusFiltros,
  CorpusRepository,
  DocumentoCobertura,
  NuevoChunk,
  NuevoDocumento,
} from '../domain/repositories';

// Implementación pg del puerto del corpus. SQL idéntico al anterior servicio.
@Injectable()
export class PgCorpusRepository implements CorpusRepository {
  constructor(private readonly db: Db) {}

  private filters(f: CorpusFiltros): { clause: string; params: unknown[] } {
    const where: string[] = [];
    const params: unknown[] = [];
    const push = (cond: string, v: unknown) => {
      params.push(v);
      where.push(cond.replace('?', `$${params.length}`));
    };
    if (f.tipo) push('d.tipo = ?', f.tipo);
    if (f.emisor) push('d.emisor ILIKE ?', `%${escapeLike(f.emisor)}%`);
    if (f.numero) push('d.numero LIKE ?', f.numero);
    if (f.jurisdiccion) push('d.jurisdiccion = ?', f.jurisdiccion);
    if (f.tema) push('d.tema ILIKE ?', `%${escapeLike(f.tema)}%`);
    return { clause: where.length ? `AND ${where.join(' AND ')}` : '', params };
  }

  async structuredByArticle(
    articulo: string,
    numeroRef: string | undefined,
    f: CorpusFiltros,
  ): Promise<ChunkRow[]> {
    const { clause, params } = this.filters(f);
    const sp = [...params, `%Art. ${articulo}%`];
    let sq = `SELECT c.chunk_id, c.ruta, c.texto, c.texto_contexto,
                     d.titulo, d.numero, d.tipo, d.url_original, d.vigencia, d.autoridad, d.fecha_consulta
              FROM chunks c JOIN documents d ON d.id = c.doc_id
              WHERE c.ruta LIKE $${sp.length} ${clause}`;
    if (numeroRef) {
      sp.push(numeroRef);
      sq += ` AND d.numero LIKE $${sp.length}`;
    }
    sq += ' LIMIT 5';
    const r = await this.db.raw.query(sq, sp);
    return r.rows;
  }

  private safeLimit(limit: number): number {
    const lim = Math.trunc(limit);
    if (!Number.isFinite(lim) || lim < 1 || lim > 100) throw new Error('limit fuera de rango');
    return lim;
  }

  async ftsRanked(query: string, f: CorpusFiltros, limit: number): Promise<string[]> {
    limit = this.safeLimit(limit);
    const { clause, params } = this.filters(f);
    const fp = [...params, query];
    const r = await this.db.raw.query(
      `SELECT c.chunk_id, ts_rank(c.fts, plainto_tsquery('lex_spanish', $${fp.length})) AS s
       FROM chunks c JOIN documents d ON d.id = c.doc_id
       WHERE c.fts @@ plainto_tsquery('lex_spanish', $${fp.length}) ${clause}
       ORDER BY s DESC LIMIT ${limit}`,
      fp,
    );
    return r.rows.map((row) => row.chunk_id as string);
  }

  async vectorRanked(embedding: number[], f: CorpusFiltros, limit: number): Promise<string[]> {
    limit = this.safeLimit(limit);
    const { clause, params } = this.filters(f);
    const lit = `[${embedding.join(',')}]`;
    const vp = [...params, lit];
    const r = await this.db.raw.query(
      `SELECT c.chunk_id, 1 - (c.embedding <=> $${vp.length}::vector) AS s
       FROM chunks c JOIN documents d ON d.id = c.doc_id
       WHERE c.embedding IS NOT NULL ${clause}
       ORDER BY c.embedding <=> $${vp.length}::vector LIMIT ${limit}`,
      vp,
    );
    return r.rows.map((row) => row.chunk_id as string);
  }

  async chunksByIds(ids: string[]): Promise<ChunkRow[]> {
    if (!ids.length) return [];
    const r = await this.db.raw.query(
      `SELECT c.chunk_id, c.ruta, c.texto, c.texto_contexto,
              d.titulo, d.numero, d.tipo, d.url_original, d.vigencia, d.autoridad, d.fecha_consulta
       FROM chunks c JOIN documents d ON d.id = c.doc_id
       WHERE c.chunk_id = ANY($1)`,
      [ids],
    );
    return r.rows;
  }

  async chunkById(id: string): Promise<ChunkRow | null> {
    try {
      const r = await this.db.raw.query(
        `SELECT c.chunk_id, c.ruta, c.texto, c.texto_contexto,
                d.titulo, d.numero, d.tipo, d.url_original, d.vigencia, d.autoridad, d.fecha_consulta
         FROM chunks c JOIN documents d ON d.id = c.doc_id
         WHERE c.chunk_id = $1`,
        [id],
      );
      if (!r.rowCount) return null;
      return r.rows[0];
    } catch {
      return null;
    }
  }

  async documentStats(): Promise<DocumentoCobertura[]> {
    const r = await this.db.raw.query(
      `SELECT d.titulo, d.numero, d.tipo, d.emisor, d.jurisdiccion, d.vigencia,
              d.fecha_consulta, COUNT(c.chunk_id)::int AS chunks
       FROM documents d LEFT JOIN chunks c ON c.doc_id = d.id
       GROUP BY d.id ORDER BY d.titulo`,
    );
    return r.rows;
  }

  async chunkRef(id: string): Promise<ChunkRef | null> {
    // Sin try/catch a propósito: UUID inválido debe propagar el error de pg
    // (mismo comportamiento que verificar_cita tenía con SQL directo).
    const r = await this.db.raw.query(
      'SELECT chunk_id, ruta, texto FROM chunks WHERE chunk_id = $1',
      [id],
    );
    if (!r.rowCount) return null;
    return r.rows[0];
  }

  async findDocumentByHash(hash: string): Promise<{ id: string; titulo: string } | null> {
    const r = await this.db.raw.query(
      'SELECT id, titulo FROM documents WHERE hash_contenido = $1',
      [hash],
    );
    if (!r.rowCount) return null;
    return r.rows[0];
  }

  async saveDocumentWithChunks(
    doc: NuevoDocumento,
    chunks: NuevoChunk[],
  ): Promise<{ docId: string; chunks: number }> {
    const client = await this.db.raw.connect();
    try {
      await client.query('BEGIN');
      const saved = await client.query(
        `INSERT INTO documents
          (titulo, emisor, tipo, fecha, numero, tema, autoridad,
           url_original, fecha_consulta, version, hash_contenido, estado_procesamiento, vigencia)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,CURRENT_DATE,'texto_original',$9,'procesado',
                 COALESCE($10,'vigencia_desconocida'))
         RETURNING id`,
        [
          doc.titulo,
          doc.emisor,
          doc.tipo,
          doc.fecha,
          doc.numero,
          doc.tema,
          doc.autoridad,
          doc.url_original,
          doc.hash,
          doc.vigencia ?? null,
        ],
      );
      const docId = saved.rows[0].id as string;
      for (const c of chunks) {
        await client.query(
          `INSERT INTO chunks
            (doc_id, ruta, offset_inicio, offset_fin, texto, texto_contexto, embedding)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [
            docId,
            c.ruta,
            c.offset_inicio,
            c.offset_fin,
            c.texto,
            c.texto_contexto,
            `[${c.embedding.join(',')}]`,
          ],
        );
      }
      await client.query('COMMIT');
      return { docId, chunks: chunks.length };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
}
