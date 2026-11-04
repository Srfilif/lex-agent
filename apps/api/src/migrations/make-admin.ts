// Promueve una cuenta a admin (uso: npm run make:admin -- correo@x.co).
// Requiere que la cuenta exista (registrada vía POST /auth/register).
import { Pool } from 'pg';
import { loadAppConfig } from '../shared/config';

async function main(): Promise<void> {
  const email = (process.argv[2] ?? '').trim().toLowerCase();
  if (!email.includes('@')) {
    console.error('uso: npm run make:admin -- correo@ejemplo.co');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: loadAppConfig(__dirname).databaseUrl });
  try {
    const r = await pool.query(
      `UPDATE users SET role = 'admin', status = 'active',
        email_verified_at = COALESCE(email_verified_at, now()), updated_at = now()
       WHERE email = $1 RETURNING id, email, role`,
      [email],
    );
    if (!r.rowCount) {
      console.error('cuenta no encontrada (regístrela primero)');
      process.exit(1);
    }
    console.log(`admin: ${r.rows[0].email} (${r.rows[0].id})`);
  } finally {
    await pool.end();
  }
}

main().catch((e: Error) => {
  console.error(`make:admin falló: ${e.message}`);
  process.exit(1);
});
