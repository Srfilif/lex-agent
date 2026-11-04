import { Injectable } from '@nestjs/common';
import { Db } from '../db';
import { ConsultarContratos } from '../agent/secop.port';
import { escapeLike } from '../shared/sql';
import { evaluarSenales } from './senales';

// Lectura SECOP desde caché local sincronizado (tabla secop_contratos).
// El contenedor no alcanza datos.gov.co; el sync corre host-side
// (npm run sync:secop). Cada respuesta declara modo + fecha de sync.

const DATASET = 'jbjy-vk9h';
const MAX_LIMIT = 50;

export interface FiltrosSecop {
  entidad?: string;
  proveedor?: string;
  objeto?: string;
  valorMin?: number;
  valorMax?: number;
  modalidad?: string;
  estado?: string;
  anio?: number;
  limit?: number;
}

export interface Contrato {
  [k: string]: unknown;
  modalidad_de_contratacion?: unknown;
  dias_adicionados?: unknown;
  valor_del_contrato?: unknown;
  valor_facturado?: unknown;
  enlace_origen: string;
  senales: Array<{ regla: string; detalle: string }>;
}

@Injectable()
export class SecopService implements ConsultarContratos {
  constructor(private readonly db: Db) {}

  async contratos(f: FiltrosSecop): Promise<{
    contratos: Contrato[];
    fecha_consulta: string;
    modo: string;
    dataset: string;
  }> {
    const limit = Math.min(Math.max(f.limit ?? 20, 1), MAX_LIMIT);
    const conds: string[] = [];
    const params: unknown[] = [];
    const push = (cond: string, v: unknown) => {
      params.push(v);
      conds.push(cond.replace('?', `$${params.length}`));
    };
    if (f.entidad) push(`nombre_entidad ILIKE '%' || ? || '%'`, escapeLike(f.entidad));
    if (f.proveedor) push(`proveedor_adjudicado ILIKE '%' || ? || '%'`, escapeLike(f.proveedor));
    if (f.objeto) {
      params.push(escapeLike(f.objeto));
      const p = params.length;
      conds.push(`(objeto_del_contrato ILIKE '%' || $${p} || '%' OR descripcion_del_proceso ILIKE '%' || $${p} || '%')`);
    }
    if (Number.isFinite(f.valorMin)) push('valor_del_contrato >= ?', f.valorMin);
    if (Number.isFinite(f.valorMax)) push('valor_del_contrato <= ?', f.valorMax);
    if (f.modalidad) push(`modalidad_de_contratacion ILIKE '%' || ? || '%'`, escapeLike(f.modalidad));
    if (f.estado) push(`estado_contrato ILIKE '%' || ? || '%'`, escapeLike(f.estado));
    if (f.anio) push('EXTRACT(YEAR FROM fecha_de_firma) = ?', Math.trunc(f.anio));
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    params.push(limit);
    const r = await this.db.raw.query(
      `SELECT *, (SELECT max(synced_at) FROM secop_contratos) AS _sync
       FROM secop_contratos ${where}
       ORDER BY fecha_de_firma DESC NULLS LAST LIMIT $${params.length}`,
      params,
    );
    return {
      contratos: r.rows.map((row) => this.map(row)),
      fecha_consulta: (r.rows[0]?._sync as Date)?.toISOString?.() ?? new Date().toISOString(),
      modo: 'sincronizado (contratos más recientes; re-sync con npm run sync:secop)',
      dataset: DATASET,
    };
  }

  private map(r: Record<string, unknown>): Contrato {
    const c = { ...r } as unknown as Contrato;
    delete c._sync;
    for (const k of ['valor_del_contrato', 'valor_facturado', 'valor_pagado', 'dias_adicionados']) {
      if (typeof c[k] === 'string' && c[k] !== '') c[k] = Number(c[k]);
    }
    c.enlace_origen =
      (typeof r.urlproceso === 'string' && r.urlproceso) ||
      `https://www.datos.gov.co/d/${DATASET}`;
    c.senales = evaluarSenales(c);
    return c;
  }
}
