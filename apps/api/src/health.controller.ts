import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Db } from './db';
import { ModelGateway } from './gateway/model-gateway';

@Controller()
export class HealthController {
  constructor(
    private readonly db: Db,
    private readonly gateway: ModelGateway,
  ) {}

  @Get('health')
  async health(): Promise<Record<string, unknown>> {
    let db: string;
    try {
      db = await this.db.ping();
    } catch (e) {
      return {
        status: 'degraded',
        db: `down: ${(e as Error).message}`,
        time: new Date().toISOString(),
      };
    }
    return {
      status: 'ok',
      db: `up (${db})`,
      modelGateway: this.gateway.status(),
      time: new Date().toISOString(),
    };
  }

  /** I1: readiness para orquestadores (200 listo / 503 no listo). */
  @Get('ready')
  async ready(): Promise<Record<string, unknown>> {
    try {
      const when = await this.db.ping();
      const r = await this.db.raw.query(
        'SELECT count(*)::int AS n FROM schema_migrations',
      );
      const n = (r.rows[0] as { n: number }).n;
      if (n < 1) throw new Error('sin migraciones aplicadas');
      return { status: 'ready', db: `up (${when})`, migrations: n, time: new Date().toISOString() };
    } catch (e) {
      throw new ServiceUnavailableException({
        status: 'not_ready',
        reason: (e as Error).message,
      });
    }
  }
}
