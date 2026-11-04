// Métricas operativas solo-lectura (observabilidad mínima I1).
// Excepción documentada al aislamiento de módulos: agrega conteos
// transversales (usuarios, chat, uso) sin escribir nada.
import { Injectable } from '@nestjs/common';
import { Db } from '../../../db';

export interface UsoKind {
  kind: string;
  eventos: number;
  tokens: number;
  costo_usd: number;
}

export interface Metricas {
  usuarios_total: number;
  usuarios_7d: number;
  sesiones_activas: number;
  conversaciones_total: number;
  mensajes_7d: number;
  uso_30d: UsoKind[];
  abstenciones_30d: number;
  tasa_abstencion_30d: number | null;
}

@Injectable()
export class OpsMetricas {
  constructor(private readonly db: Db) {}

  async resumen(): Promise<Metricas> {
    const one = async (sql: string): Promise<number> => {
      const r = await this.db.raw.query(sql);
      return Number((r.rows[0] as { n: number }).n ?? 0);
    };
    const [usuarios_total, usuarios_7d, sesiones_activas, conversaciones_total, mensajes_7d] =
      await Promise.all([
        one('SELECT count(*)::int AS n FROM users'),
        one(`SELECT count(*)::int AS n FROM users WHERE created_at > now() - interval '7 days'`),
        one('SELECT count(*)::int AS n FROM auth_sessions WHERE revoked_at IS NULL AND expires_at > now()'),
        one('SELECT count(*)::int AS n FROM conversations'),
        one(`SELECT count(*)::int AS n FROM messages WHERE created_at > now() - interval '7 days'`),
      ]);
    const u = await this.db.raw.query(
      `SELECT kind, count(*)::int AS eventos,
              COALESCE(sum(tokens_in + tokens_out), 0)::int AS tokens,
              COALESCE(sum(cost_usd), 0)::float AS costo_usd
       FROM usage_events WHERE created_at > now() - interval '30 days'
       GROUP BY kind ORDER BY kind`,
    );
    const uso_30d = (u.rows as UsoKind[]).map((r) => ({
      kind: r.kind,
      eventos: Number(r.eventos),
      tokens: Number(r.tokens),
      costo_usd: Math.round(Number(r.costo_usd) * 1000000) / 1000000,
    }));
    const abstenciones_30d = uso_30d.find((k) => k.kind === 'abstencion')?.eventos ?? 0;
    const chats_30d = uso_30d.find((k) => k.kind === 'chat')?.eventos ?? 0;
    return {
      usuarios_total,
      usuarios_7d,
      sesiones_activas,
      conversaciones_total,
      mensajes_7d,
      uso_30d,
      abstenciones_30d,
      tasa_abstencion_30d: chats_30d ? Math.round((abstenciones_30d / chats_30d) * 10000) / 10000 : null,
    };
  }
}
