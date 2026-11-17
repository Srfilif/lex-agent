// Repositorio pg de archivos y chunks de proyecto (B6). Espejo del patrón corpus.
import { Injectable } from '@nestjs/common';
import { Db } from '../../../../db';
import { asBool, asDate, asJson, cosine, termsForLike } from '../../../../shared/db/dialect';
import { ProjectFileProps } from '../../domain/project-files';
import {
  NuevoProjectChunk,
  ProjectChunkHit,
  ProjectFileRepository,
} from '../../domain/repositories';

interface FileRow {
  id: string;
  project_id: string;
  user_id: string;
  filename: string;
  mime: string;
  size_bytes: number;
  sha256: string;
  storage_path: string;
  status: 'ready' | 'failed';
  error: string | null;
  chunk_count: number;
  created_at: Date;
  sospechoso: boolean;
}

function toProps(r: FileRow): ProjectFileProps {
  return {
    id: r.id,
    projectId: r.project_id,
    userId: r.user_id,
    filename: r.filename,
    mime: r.mime,
    sizeBytes: Number(r.size_bytes),
    sha256: r.sha256,
    storagePath: r.storage_path,
    status: r.status,
    error: r.error,
    chunkCount: Number(r.chunk_count),
    createdAt: asDate(r.created_at),
    sospechoso: asBool(r.sospechoso ?? false),
  };
}

interface ChunkRow {
  chunk_id: string;
  file_id: string;
  project_id: string;
  user_id: string;
  n: number;
  ruta: string;
  texto: string;
  texto_contexto: string;
  filename: string;
}

function toHit(r: ChunkRow, score: number): ProjectChunkHit {
  return {
    chunkId: r.chunk_id,
    fileId: r.file_id,
    projectId: r.project_id,
    n: Number(r.n),
    ruta: r.ruta,
    texto: r.texto,
    textoContexto: r.texto_contexto,
    filename: r.filename,
    score,
    metodo: 'hibrido',
  };
}

const CHUNK_SELECT = `c.chunk_id, c.file_id, c.project_id, f.user_id, c.n, c.ruta,
  c.texto, c.texto_contexto, f.filename
  FROM project_chunks c JOIN project_files f ON f.id = c.file_id`;

@Injectable()
export class PgProjectFileRepository implements ProjectFileRepository {
  constructor(private readonly db: Db) {}

  async create(f: {
    projectId: string;
    userId: string;
    filename: string;
    mime: string;
    sizeBytes: number;
    sha256: string;
    storagePath: string;
    chunkCount: number;
    sospechoso: boolean;
  }): Promise<ProjectFileProps> {
    const r = await this.db.raw.query(
      `INSERT INTO project_files
       (project_id, user_id, filename, mime, size_bytes, sha256, storage_path, chunk_count, sospechoso)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [f.projectId, f.userId, f.filename, f.mime, f.sizeBytes, f.sha256, f.storagePath, f.chunkCount, f.sospechoso],
    );
    return toProps(r.rows[0] as FileRow);
  }

  async findById(id: string): Promise<ProjectFileProps | null> {
    const r = await this.db.raw.query('SELECT * FROM project_files WHERE id = $1', [id]);
    if (!r.rowCount) return null;
    return toProps(r.rows[0] as FileRow);
  }

  async findByProjectAndHash(projectId: string, sha256: string): Promise<ProjectFileProps | null> {
    const r = await this.db.raw.query(
      'SELECT * FROM project_files WHERE project_id = $1 AND sha256 = $2',
      [projectId, sha256],
    );
    if (!r.rowCount) return null;
    return toProps(r.rows[0] as FileRow);
  }

  async listByProject(projectId: string): Promise<ProjectFileProps[]> {
    const r = await this.db.raw.query(
      'SELECT * FROM project_files WHERE project_id = $1 ORDER BY created_at DESC',
      [projectId],
    );
    return (r.rows as FileRow[]).map(toProps);
  }

  async listByUser(userId: string): Promise<Array<ProjectFileProps & { projectName: string }>> {
    const r = await this.db.raw.query(
      `SELECT f.*, p.name AS project_name FROM project_files f
       JOIN projects p ON p.id = f.project_id
       WHERE f.user_id = $1 ORDER BY f.created_at DESC`,
      [userId],
    );
    return (r.rows as Array<FileRow & { project_name: string }>).map((row) => ({
      ...toProps(row),
      projectName: row.project_name,
    }));
  }

  async usageByProject(projectId: string): Promise<{ count: number; bytes: number }> {
    const r = await this.db.raw.query(
      `SELECT CAST(count(*) AS INTEGER) AS n, CAST(coalesce(sum(size_bytes), 0) AS INTEGER) AS b
       FROM project_files WHERE project_id = $1`,
      [projectId],
    );
    const row = r.rows[0] as { n: number; b: number };
    return { count: row.n, bytes: row.b };
  }

  async saveChunks(fileId: string, projectId: string, chunks: NuevoProjectChunk[]): Promise<void> {
    const client = await this.db.raw.connect();
    try {
      await client.query('BEGIN');
      const vec7 = this.db.isSqlite ? '$7' : '$7::vector';
      for (const c of chunks) {
        await client.query(
          `INSERT INTO project_chunks
           (file_id, project_id, n, ruta, texto, texto_contexto, embedding)
           VALUES ($1, $2, $3, $4, $5, $6, ${vec7})`,
          [fileId, projectId, c.n, c.ruta, c.texto, c.textoContexto, `[${c.embedding.join(',')}]`],
        );
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async delete(id: string): Promise<void> {
    await this.db.raw.query('DELETE FROM project_files WHERE id = $1', [id]);
  }

  async ftsRanked(projectId: string, q: string, limit: number): Promise<string[]> {
    const lim = Math.min(Math.max(Math.trunc(limit) || 20, 1), 50);
    if (this.db.isSqlite) {
      const terms = termsForLike(q);
      if (!terms.length) return [];
      const sp: unknown[] = [projectId];
      const per: string[] = [];
      for (const t of terms) {
        sp.push(`%${t}%`, `%${t}%`);
        const a = sp.length - 1;
        const b = sp.length;
        per.push(
          `(CASE WHEN LOWER(c.texto) LIKE $${a} OR LOWER(c.texto_contexto) LIKE $${b} THEN 1 ELSE 0 END)`,
        );
      }
      const score = per.join(' + ');
      const r = await this.db.raw.query(
        `SELECT c.chunk_id, (${score}) AS s
         FROM project_chunks c
         WHERE c.project_id = $1 AND (${score}) > 0
         ORDER BY s DESC LIMIT ${lim}`,
        sp,
      );
      return (r.rows as Array<{ chunk_id: string }>).map((row) => row.chunk_id);
    }
    const r = await this.db.raw.query(
      `SELECT c.chunk_id, ts_rank(c.fts, plainto_tsquery('lex_spanish', $2)) AS s
       FROM project_chunks c
       WHERE c.project_id = $1 AND c.fts @@ plainto_tsquery('lex_spanish', $2)
       ORDER BY s DESC LIMIT ${lim}`,
      [projectId, q],
    );
    return (r.rows as Array<{ chunk_id: string }>).map((row) => row.chunk_id);
  }

  async vectorRanked(projectId: string, embedding: number[], limit: number): Promise<string[]> {
    const lim = Math.min(Math.max(Math.trunc(limit) || 20, 1), 50);
    if (this.db.isSqlite) {
      const r = await this.db.raw.query(
        `SELECT c.chunk_id, c.embedding FROM project_chunks c
         WHERE c.project_id = $1 AND c.embedding IS NOT NULL`,
        [projectId],
      );
      return r.rows
        .map((row) => ({
          id: row.chunk_id as string,
          s: cosine(embedding, asJson<number[]>(row.embedding, [])),
        }))
        .sort((a, b) => b.s - a.s)
        .slice(0, lim)
        .map((x) => x.id);
    }
    const r = await this.db.raw.query(
      `SELECT c.chunk_id, 1 - (c.embedding <=> $2::vector) AS s
       FROM project_chunks c
       WHERE c.project_id = $1 AND c.embedding IS NOT NULL
       ORDER BY c.embedding <=> $2::vector LIMIT ${lim}`,
      [projectId, `[${embedding.join(',')}]`],
    );
    return (r.rows as Array<{ chunk_id: string }>).map((row) => row.chunk_id);
  }

  async chunksByIds(ids: string[]): Promise<ProjectChunkHit[]> {
    if (!ids.length) return [];
    if (this.db.isSqlite) {
      const r = await this.db.raw.query(
        `SELECT ${CHUNK_SELECT} WHERE c.chunk_id IN (${ids.map((_, i) => `$${i + 1}`).join(',')})`,
        ids,
      );
      return (r.rows as ChunkRow[]).map((row) => toHit(row, 0));
    }
    const r = await this.db.raw.query(`SELECT ${CHUNK_SELECT} WHERE c.chunk_id = ANY($1)`, [ids]);
    return (r.rows as ChunkRow[]).map((row) => toHit(row, 0));
  }

  async chunkById(chunkId: string): Promise<(ProjectChunkHit & { userId: string }) | null> {
    const r = await this.db.raw.query(`SELECT ${CHUNK_SELECT} WHERE c.chunk_id = $1`, [chunkId]);
    if (!r.rowCount) return null;
    const row = r.rows[0] as ChunkRow;
    return { ...toHit(row, 0), userId: row.user_id };
  }
}
