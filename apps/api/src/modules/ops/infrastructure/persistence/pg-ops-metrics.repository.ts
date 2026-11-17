import { Injectable } from '@nestjs/common';
import { Db } from '../../../../db';
import { cutoffDays } from '../../../../shared/db/dialect';
import { Metricas, OpsMetricsRepository, UsoKind } from '../../domain/metrics';

@Injectable()
export class PgOpsMetricsRepository implements OpsMetricsRepository {
  constructor(private readonly db: Db) {}

  async summary(): Promise<Metricas> {
    const one = async (sql: string, params: unknown[] = []): Promise<number> => {
      const r = await this.db.raw.query(sql, params);
      return Number((r.rows[0] as { n: number }).n ?? 0);
    };
    const d7 = cutoffDays(7);
    const d30 = cutoffDays(30);
    const ahora = cutoffDays(0);
    const [usuarios_total, usuarios_7d, sesiones_activas, conversaciones_total, mensajes_7d] =
      await Promise.all([
        one('SELECT CAST(count(*) AS INTEGER) AS n FROM users'),
        one('SELECT CAST(count(*) AS INTEGER) AS n FROM users WHERE created_at > $1', [d7]),
        one(
          'SELECT CAST(count(*) AS INTEGER) AS n FROM auth_sessions WHERE revoked_at IS NULL AND expires_at > $1',
          [ahora],
        ),
        one('SELECT CAST(count(*) AS INTEGER) AS n FROM conversations'),
        one('SELECT CAST(count(*) AS INTEGER) AS n FROM messages WHERE created_at > $1', [d7]),
      ]);
    const u = await this.db.raw.query(
      `SELECT kind, CAST(count(*) AS INTEGER) AS eventos,
              CAST(COALESCE(sum(tokens_in + tokens_out), 0) AS INTEGER) AS tokens,
              CAST(COALESCE(sum(cost_usd), 0) AS REAL) AS costo_usd
       FROM usage_events WHERE created_at > $1
       GROUP BY kind ORDER BY kind`,
      [d30],
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
