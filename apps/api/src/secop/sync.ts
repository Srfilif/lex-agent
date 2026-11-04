// Sync host-side SECOP II → Postgres (el contenedor API no alcanza datos.gov.co).
// Uso: npm run sync:secop -- [N]   (default 5000 contratos más recientes)
// Idempotente por :id (upsert).
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { Db } from '../db';
import { loadAppConfig } from '../shared/config';

const DATASET = 'jbjy-vk9h';
const BASE = `https://www.datos.gov.co/resource/${DATASET}.json`;
const PAGE = 1000;

const COLS = [
  ':id', 'nombre_entidad', 'nit_entidad', 'departamento', 'ciudad',
  'proceso_de_compra', 'id_contrato', 'referencia_del_contrato', 'estado_contrato',
  'descripcion_del_proceso', 'objeto_del_contrato', 'tipo_de_contrato',
  'modalidad_de_contratacion', 'fecha_de_firma', 'fecha_de_inicio_del_contrato',
  'fecha_de_fin_del_contrato', 'proveedor_adjudicado', 'documento_proveedor',
  'valor_del_contrato', 'valor_facturado', 'valor_pagado', 'dias_adicionados',
  'urlproceso', 'ultima_actualizacion',
];

async function main(): Promise<void> {
  const cfg = loadAppConfig(__dirname);
  const total = Math.max(Number(process.argv[2] ?? 5000) || 5000, 1);
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (cfg.secopAppToken) headers['X-App-Token'] = cfg.secopAppToken;
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const pool = app.get(Db).raw;
  try {
    let done = 0;
    for (let offset = 0; offset < total; offset += PAGE) {
      const params = new URLSearchParams({
        $select: COLS.join(','),
        $order: 'fecha_de_firma DESC',
        $limit: String(Math.min(PAGE, total - offset)),
        $offset: String(offset),
        $$exclude_system_fields: 'true',
      });
      // :id se excluye con $$exclude... → pedirlo exige quitar el flag
      params.delete('$$exclude_system_fields');
      const res = await fetch(`${BASE}?${params}`, {
        headers,
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) throw new Error(`SECOP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const rows = (await res.json()) as Array<Record<string, string>>;
      if (!rows.length) break;
      for (const r of rows) {
        const vals = COLS.map((c) => {
          const v = r[c];
          return v === undefined || v === '' ? null : v;
        });
        const cols = COLS.map((c) => (c === ':id' ? 'id' : c));
        const ph = cols.map((_, i) => `$${i + 1}`).join(',');
        const upd = cols.slice(1).map((c) => `${c} = EXCLUDED.${c}`).join(',');
        await pool.query(
          `INSERT INTO secop_contratos (${cols.join(',')}, synced_at)
           VALUES (${ph}, now())
           ON CONFLICT (id) DO UPDATE SET ${upd}, synced_at = now()`,
          [r[':id'], ...vals.slice(1)],
        );
      }
      done += rows.length;
      console.log(`sync ${done}/${total}`);
      if (rows.length < PAGE) break;
    }
    const c = await pool.query('SELECT count(*) AS n, max(synced_at) AS s FROM secop_contratos');
    console.log(`OK total=${c.rows[0].n} synced_at=${c.rows[0].s}`);
  } finally {
    await app.close();
  }
}

void main();
