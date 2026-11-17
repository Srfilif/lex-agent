import { Injectable } from '@nestjs/common';
import { Db } from '../../../../db';
import { asJson } from '../../../../shared/db/dialect';
import {
  ChunkSource,
  Investigation,
  InvestigationAnswer,
  InvestigationRepository,
  NewInvestigation,
  SecopSource,
  TokenUsage,
} from '../../domain/investigation';

const USAGE_CERO: TokenUsage = { prompt: 0, completion: 0, total: 0 };

@Injectable()
export class PgInvestigationRepository implements InvestigationRepository {
  constructor(private readonly db: Db) {}

  async save(input: NewInvestigation): Promise<{ id: string; createdAt: Date }> {
    const r = await this.db.raw.query(
      `INSERT INTO investigaciones (pregunta, traza, respuesta, usage, costo_usd, user_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, created_at`,
      [
        input.question,
        JSON.stringify(input.trace),
        JSON.stringify(input.answer),
        JSON.stringify(input.usage),
        input.costUsd,
        input.userId,
      ],
    );
    const row = r.rows[0] as { id: string; created_at: Date | string };
    return { id: row.id, createdAt: new Date(row.created_at) };
  }

  async findById(id: string): Promise<Investigation | null> {
    const r = await this.db.raw.query(
      `SELECT id, pregunta, traza, respuesta, usage, costo_usd, user_id, created_at
       FROM investigaciones WHERE id = $1`,
      [id],
    );
    if (!r.rowCount) return null;
    const row = r.rows[0] as {
      id: string;
      pregunta: string;
      traza: unknown;
      respuesta: unknown;
      usage: unknown;
      costo_usd: string | number | null;
      user_id: string | null;
      created_at: Date | string;
    };
    return {
      id: row.id,
      question: row.pregunta,
      trace: asJson(row.traza, []),
      answer: asJson<InvestigationAnswer>(row.respuesta, {}),
      usage: asJson<TokenUsage>(row.usage, USAGE_CERO),
      costUsd: Number(row.costo_usd ?? 0),
      userId: row.user_id,
      createdAt: new Date(row.created_at),
    };
  }

  async findChunkSources(ids: string[]): Promise<ChunkSource[]> {
    if (!ids.length) return [];
    const sql = this.db.isSqlite
      ? `SELECT c.chunk_id, c.ruta, c.texto, d.titulo, d.url_original
         FROM chunks c JOIN documents d ON d.id = c.doc_id
         WHERE c.chunk_id IN (${ids.map((_, i) => `$${i + 1}`).join(',')})`
      : `SELECT c.chunk_id, c.ruta, c.texto, d.titulo, d.url_original
         FROM chunks c JOIN documents d ON d.id = c.doc_id
         WHERE c.chunk_id = ANY($1)`;
    const r = await this.db.raw.query(sql, this.db.isSqlite ? ids : [ids]);
    return r.rows as ChunkSource[];
  }

  async findSecopSources(ids: string[]): Promise<SecopSource[]> {
    if (!ids.length) return [];
    const sql = this.db.isSqlite
      ? `SELECT id_contrato, nombre_entidad, proveedor_adjudicado, valor_del_contrato, urlproceso
         FROM secop_contratos
         WHERE id_contrato IN (${ids.map((_, i) => `$${i + 1}`).join(',')})`
      : `SELECT id_contrato, nombre_entidad, proveedor_adjudicado, valor_del_contrato, urlproceso
         FROM secop_contratos
         WHERE id_contrato = ANY($1)`;
    const r = await this.db.raw.query(sql, this.db.isSqlite ? ids : [ids]);
    return (r.rows as Array<Record<string, unknown>>).map((c) => ({
      id_contrato: String(c.id_contrato),
      nombre_entidad: String(c.nombre_entidad ?? ''),
      proveedor_adjudicado: String(c.proveedor_adjudicado ?? ''),
      valor_del_contrato:
        c.valor_del_contrato !== null && c.valor_del_contrato !== undefined
          ? Number(c.valor_del_contrato)
          : null,
      urlproceso: typeof c.urlproceso === 'string' ? c.urlproceso : null,
    }));
  }
}
