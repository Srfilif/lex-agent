import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfig, CONFIG } from './shared/config';

@Injectable()
export class Db implements OnModuleInit, OnModuleDestroy {
  private pool!: Pool;

  constructor(@Inject(CONFIG) private readonly cfg: AppConfig) {}

  async onModuleInit(): Promise<void> {
    this.pool = new Pool({
      connectionString: this.cfg.databaseUrl,
      max: 10,
    });
    await this.pool.query('SELECT 1');
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
  }

  async ping(): Promise<string> {
    const r = await this.pool.query('SELECT now()::text AS now');
    return r.rows[0].now as string;
  }

  get raw(): Pool {
    return this.pool;
  }
}
