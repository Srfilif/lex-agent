// Runner de migraciones SQL (uso: npm run migrate).
// postgres: aplica db/migrations/005-02x en orden, una vez cada uno (schema_migrations).
// sqlite: aplica db/sqlite/schema.sql una vez (tracking 'sqlite_schema').
// Baseline pg: 002-004 se aplicaron a mano antes del runner y no se tocan.
// Cada archivo pg corre en transacción propia; el registro es parte de ella.
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { loadAppConfig } from '../shared/config';
import { describeDbError } from '../shared/db/dialect';
import { DbDriver, createDriver } from '../shared/db/provider';

const MIGRATIONS_DIR = join(__dirname, '..', '..', '..', '..', 'db', 'migrations');
const SQLITE_SCHEMA = join(__dirname, '..', '..', '..', '..', 'db', 'sqlite', 'schema.sql');

let actual = 'conexión inicial';

async function migrateSqlite(db: DbDriver): Promise<void> {
  await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))`);
  const done = await db.query('SELECT name FROM schema_migrations WHERE name = $1', [
    'sqlite_schema',
  ]);
  if (done.rowCount) {
    console.log('skip sqlite_schema (aplicado)');
    return;
  }
  actual = 'sqlite_schema';
  await db.exec(readFileSync(SQLITE_SCHEMA, 'utf8'));
  await db.query('INSERT INTO schema_migrations (name) VALUES ($1)', ['sqlite_schema']);
  console.log('ok sqlite_schema');
}

async function migratePg(db: DbDriver): Promise<void> {
  await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  const done = await db.query('SELECT name FROM schema_migrations');
  const applied = new Set((done.rows as Array<{ name: string }>).map((r) => r.name));
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^0(?:0[5-9]|[12]\d).*\.sql$/.test(f))
    .sort();
  for (const f of files) {
    actual = f;
    if (applied.has(f)) {
      console.log(`skip ${f} (aplicada)`);
      continue;
    }
    const sql = readFileSync(join(MIGRATIONS_DIR, f), 'utf8');
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [f]);
      await client.query('COMMIT');
      console.log(`ok ${f}`);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
}

async function main(): Promise<void> {
  const cfg = loadAppConfig(__dirname);
  const db = createDriver(cfg);
  await db.init();
  try {
    if (cfg.databaseProvider === 'sqlite') {
      await migrateSqlite(db);
    } else {
      await migratePg(db);
    }
    console.log('migraciones al día');
  } finally {
    await db.end();
  }
}

main().catch((e: Error) => {
  console.error(`migrate falló en ${actual}: ${describeDbError(e)}`);
  process.exit(1);
});
