// Purga de retención (I1.7). Uso: npm run purge (cron semanal sugerido).
// Borra sesiones muertas >90d y security_events >1año. Imprime conteos.
// Solo DELETEs acotados por fecha; sale 1 si falla.
import { Pool } from 'pg';
import { loadAppConfig } from '../shared/config';

async function main(): Promise<void> {
  const cfg = loadAppConfig(__dirname);
  const pool = new Pool({ connectionString: cfg.databaseUrl });
  try {
    const ses = await pool.query(
      `DELETE FROM auth_sessions
       WHERE (revoked_at IS NOT NULL OR expires_at < now() - interval '90 days')
         AND last_seen_at < now() - interval '90 days'`,
    );
    const evt = await pool.query(
      `DELETE FROM security_events WHERE created_at < now() - interval '1 year'`,
    );
    console.log(`purga ok: sesiones=${ses.rowCount} eventos=${evt.rowCount}`);
  } finally {
    await pool.end();
  }
}

main().catch((e: Error) => {
  console.error(`FAIL purga: ${e.message}`);
  process.exit(1);
});
