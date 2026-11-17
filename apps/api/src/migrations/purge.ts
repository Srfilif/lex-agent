// Purga de retención (I1.7). Uso: npm run purge (cron semanal sugerido).
// Borra sesiones muertas >90d y security_events >1año. Imprime conteos.
// Solo DELETEs acotados por fecha; sale 1 si falla. Funciona en ambos motores.
import { loadAppConfig } from '../shared/config';
import { cutoffDays, cutoffYears } from '../shared/db/dialect';
import { createDriver } from '../shared/db/provider';

async function main(): Promise<void> {
  const cfg = loadAppConfig(__dirname);
  const db = createDriver(cfg);
  await db.init();
  try {
    const d90 = cutoffDays(90);
    const ses = await db.query(
      `DELETE FROM auth_sessions
       WHERE (revoked_at IS NOT NULL OR expires_at < $1) AND last_seen_at < $1`,
      [d90],
    );
    const y1 = cutoffYears(1);
    const evt = await db.query(`DELETE FROM security_events WHERE created_at < $1`, [y1]);
    console.log(`purga ok: sesiones=${ses.rowCount} eventos=${evt.rowCount}`);
  } finally {
    await db.end();
  }
}

main().catch((e: Error) => {
  console.error(`FAIL purga: ${e.message}`);
  process.exit(1);
});
