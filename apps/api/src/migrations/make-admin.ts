// Promueve una cuenta a admin (uso: npm run make:admin -- correo@x.co).
// Requiere que la cuenta exista (registrada vía POST /auth/register o seed).
import { loadAppConfig } from '../shared/config';
import { createDriver } from '../shared/db/provider';

async function main(): Promise<void> {
  const email = (process.argv[2] ?? '').trim().toLowerCase();
  if (!email.includes('@')) {
    console.error('uso: npm run make:admin -- correo@ejemplo.co');
    process.exit(1);
  }
  const cfg = loadAppConfig(__dirname);
  const db = createDriver(cfg);
  await db.init();
  try {
    const r = await db.query(
      `UPDATE users SET role = 'admin', status = 'active',
        email_verified_at = COALESCE(email_verified_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP
       WHERE email = $1 RETURNING id, email, role`,
      [email],
    );
    if (!r.rowCount) {
      console.error('cuenta no encontrada (regístrela primero o corra npm run seed)');
      process.exit(1);
    }
    console.log(`admin: ${r.rows[0].email} (${r.rows[0].id})`);
  } finally {
    await db.end();
  }
}

main().catch((e: Error) => {
  console.error(`make:admin falló: ${e.message}`);
  process.exit(1);
});
