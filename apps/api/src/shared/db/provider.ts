// Proveedor de DB dual: postgres (pg.Pool) o sqlite (node:sqlite, stdlib).
// node:sqlite se carga perezosamente para no exigirlo en postgres/CI.
import { mkdirSync } from 'fs';
import { dirname, isAbsolute, resolve } from 'path';
import { Pool } from 'pg';
import { AppConfig } from '../config';
import { toPositional } from './dialect';

export type DatabaseProvider = 'postgres' | 'sqlite';

export interface DbRows {
  // any[] como pg: los repositorios castean a sus *Row.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rows: any[];
  rowCount: number | null;
}

export interface DbClient {
  query(text: string, params?: unknown[]): Promise<DbRows>;
  release(): void;
}

/** Subconjunto de pg.Pool que usa el repo (+exec para migraciones). */
export interface DbDriver {
  init(): Promise<void>;
  query(text: string, params?: unknown[]): Promise<DbRows>;
  exec(script: string): Promise<void>;
  connect(): Promise<DbClient>;
  end(): Promise<void>;
}

function serializeParam(v: unknown): unknown {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v !== null && typeof v === 'object' && !Buffer.isBuffer(v)) return JSON.stringify(v);
  return v;
}

const RETURNS_ROWS = /^\s*(SELECT|WITH|VALUES|EXPLAIN|PRAGMA)\b/i;

interface SqliteDb {
  prepare(sql: string): {
    all(...params: unknown[]): Record<string, unknown>[];
    run(...params: unknown[]): { changes: number | bigint };
  };
  exec(script: string): void;
  close(): void;
}

export class SqliteDriver implements DbDriver {
  private db: SqliteDb | null = null;

  constructor(private readonly filePath: string) {}

  /** Abre (crea dir/archivo si faltan) y endurece pragmas. Falla alto si no puede. */
  async init(): Promise<void> {
    const p = isAbsolute(this.filePath) ? this.filePath : resolve(process.cwd(), this.filePath);
    mkdirSync(dirname(p), { recursive: true });
    const { DatabaseSync } = require('node:sqlite') as {
      DatabaseSync: new (path: string) => SqliteDb;
    };
    this.db = new DatabaseSync(p);
    this.db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  }

  private conn(): SqliteDb {
    if (!this.db) throw new Error('sqlite no abierto (DATABASE_PROVIDER=sqlite sin init)');
    return this.db;
  }

  async query(text: string, params: unknown[] = []): Promise<DbRows> {
    const pos = toPositional(text, params);
    const sql = pos.text;
    const args = pos.params.map(serializeParam);
    const stmt = this.conn().prepare(sql);
    if (RETURNS_ROWS.test(sql) || /\bRETURNING\b/i.test(sql)) {
      const rows = stmt.all(...args);
      return { rows, rowCount: rows.length };
    }
    const r = stmt.run(...args);
    return { rows: [], rowCount: Number(r.changes) };
  }

  async exec(script: string): Promise<void> {
    this.conn().exec(script);
  }

  async connect(): Promise<DbClient> {
    const query = (text: string, params?: unknown[]): Promise<DbRows> => this.query(text, params);
    return { query, release: (): void => undefined };
  }

  async end(): Promise<void> {
    this.db?.close();
    this.db = null;
  }
}

export class PgDriver implements DbDriver {
  constructor(
    private readonly pool: Pool,
    private readonly databaseUrl: string,
  ) {}

  async init(): Promise<void> {
    try {
      await this.query('SELECT 1');
    } catch {
      let where = '';
      try {
        where = ` (${new URL(this.databaseUrl).host})`;
      } catch {
        // sin detalle de destino
      }
      // eslint-disable-next-line no-console
      console.warn(`[db] sin conexión inicial${where}: modo degradado`);
    }
  }

  async query(text: string, params: unknown[] = []): Promise<DbRows> {
    const r = await this.pool.query(text, params as unknown[]);
    return { rows: r.rows as Record<string, unknown>[], rowCount: r.rowCount };
  }

  async exec(script: string): Promise<void> {
    await this.pool.query(script);
  }

  async connect(): Promise<DbClient> {
    const client = await this.pool.connect();
    return {
      query: async (text: string, params: unknown[] = []): Promise<DbRows> => {
        const r = await client.query(text, params as unknown[]);
        return { rows: r.rows as Record<string, unknown>[], rowCount: r.rowCount };
      },
      release: (): void => client.release(),
    };
  }

  async end(): Promise<void> {
    await this.pool.end();
  }
}

export function createDriver(cfg: AppConfig): DbDriver {
  if (cfg.databaseProvider === 'sqlite') return new SqliteDriver(cfg.sqlitePath);
  const pool = new Pool({ connectionString: cfg.databaseUrl, max: 10 });
  pool.on('error', (e: Error) => {
    // eslint-disable-next-line no-console
    console.warn(`[db] error de pool (degradado): ${e.message}`);
  });
  return new PgDriver(pool, cfg.databaseUrl);
}
