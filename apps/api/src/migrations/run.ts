// Runner de migraciones SQL (uso: npm run migrate).
// Aplica db/migrations/00[5-9]*.sql en orden, una vez cada uno (schema_migrations).
// Baseline: 002-004 se aplicaron a mano antes del runner y no se tocan.
// Cada archivo corre en transacción propia; el registro es parte de ella.
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';
import { loadAppConfig } from '../shared/config';

const MIGRATIONS_DIR = join(__dirname, '..', '..', '..', '..', 'db', 'migrations');

async function main(): Promise<void> {
  const cfg = loadAppConfig(__dirname);
  const pool = new Pool({ connectionString: cfg.databaseUrl });
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
    const done = await pool.query('SELECT name FROM schema_migrations');
    const applied = new Set((done.rows as Array<{ name: string }>).map((r) => r.name));
    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => /^0(?:0[5-9]|1\d).*\.sql$/.test(f))
      .sort();
    for (const f of files) {
      if (applied.has(f)) {
        console.log(`skip ${f} (aplicada)`);
        continue;
      }
      const sql = readFileSync(join(MIGRATIONS_DIR, f), 'utf8');
      const client = await pool.connect();
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
    console.log('migraciones al día');
  } finally {
    await pool.end();
  }
}

main().catch((e: Error) => {
  console.error(`migrate falló: ${e.message}`);
  process.exit(1);
});
