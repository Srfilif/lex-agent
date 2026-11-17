import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { AppConfig, CONFIG } from './shared/config';
import { DbDriver, createDriver } from './shared/db/provider';

@Injectable()
export class Db implements OnModuleInit, OnModuleDestroy {
  private driver!: DbDriver;

  constructor(@Inject(CONFIG) private readonly cfg: AppConfig) {}

  /** Dialecto activo (las ramas SQL lo consultan). */
  get isSqlite(): boolean {
    return this.cfg.databaseProvider === 'sqlite';
  }

  async onModuleInit(): Promise<void> {
    this.driver = createDriver(this.cfg);
    await this.driver.init();
  }

  async onModuleDestroy(): Promise<void> {
    await this.driver?.end();
  }

  async ping(): Promise<string> {
    const r = await this.driver.query(
      this.isSqlite ? 'SELECT CURRENT_TIMESTAMP AS now' : 'SELECT now()::text AS now',
    );
    return r.rows[0].now as string;
  }

  get raw(): DbDriver {
    return this.driver;
  }
}
