import { Injectable } from '@nestjs/common';
import { Db } from '../../../../db';
import { escapeLike } from '../../../../shared/sql';
import { ContratoResumido, FiltrosContratos } from '../../domain/contract';
import { evaluarSenales } from '../../domain/signals';
import { SecopRepository, SecopSearchResult } from '../../application/ports';

// Adaptador dual pg/sqlite del puerto SECOP. Todo el SQL vive aquí.
@Injectable()
export class PgSecopRepository implements SecopRepository {
  constructor(private readonly db: Db) {}

  async search(f: FiltrosContratos): Promise<SecopSearchResult> {
    const conds: string[] = [];
    const params: unknown[] = [];
    const sqlite = this.db.isSqlite;
    const push = (cond: string, v: unknown): void => {
      params.push(v);
      conds.push(cond.replace('?', `$${params.length}`));
    };
    // sqlite: LIKE es ASCII; LOWER en ambos lados aproxima el ILIKE.
    const col = (c: string): string => (sqlite ? `LOWER(${c})` : c);
    const like = sqlite ? 'LIKE' : 'ILIKE';
    const pat = (v: string): string => {
      const e = escapeLike(v);
      return sqlite ? e.toLowerCase() : e;
    };
    if (f.entidad) push(`${col('nombre_entidad')} ${like} '%' || ? || '%'`, pat(f.entidad));
    if (f.proveedor) push(`${col('proveedor_adjudicado')} ${like} '%' || ? || '%'`, pat(f.proveedor));
    if (f.objeto) {
      params.push(pat(f.objeto));
      const p = params.length;
      conds.push(
        `(${col('objeto_del_contrato')} ${like} '%' || $${p} || '%' OR ${col('descripcion_del_proceso')} ${like} '%' || $${p} || '%')`,
      );
    }
    if (Number.isFinite(f.valorMin)) push('valor_del_contrato >= ?', f.valorMin);
    if (Number.isFinite(f.valorMax)) push('valor_del_contrato <= ?', f.valorMax);
    if (f.modalidad) {
      push(`${col('modalidad_de_contratacion')} ${like} '%' || ? || '%'`, pat(f.modalidad));
    }
    if (f.estado) push(`${col('estado_contrato')} ${like} '%' || ? || '%'`, pat(f.estado));
    if (f.anio) {
      push(
        sqlite
          ? "CAST(strftime('%Y', fecha_de_firma) AS INTEGER) = ?"
          : 'EXTRACT(YEAR FROM fecha_de_firma) = ?',
        Math.trunc(f.anio),
      );
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    params.push(f.limit);
    // sqlite DESC ya deja NULLs al final: NULLS LAST sobra (y no existe).
    const nullsLast = sqlite ? '' : ' NULLS LAST';
    const r = await this.db.raw.query(
      `SELECT *, (SELECT max(synced_at) FROM secop_contratos) AS _sync
       FROM secop_contratos ${where}
       ORDER BY fecha_de_firma DESC${nullsLast} LIMIT $${params.length}`,
      params,
    );
    return {
      contratos: r.rows.map((row) => this.map(row)),
      syncedAt: r.rows[0]?._sync,
    };
  }

  private map(r: Record<string, unknown>): ContratoResumido {
    const c = { ...r } as unknown as ContratoResumido;
    delete c._sync;
    for (const k of ['valor_del_contrato', 'valor_facturado', 'valor_pagado', 'dias_adicionados']) {
      if (typeof c[k] === 'string' && c[k] !== '') c[k] = Number(c[k]);
    }
    c.enlace_origen =
      (typeof r.urlproceso === 'string' && r.urlproceso) ||
      'https://www.datos.gov.co/d/jbjy-vk9h';
    c.senales = evaluarSenales(c);
    return c;
  }
}
