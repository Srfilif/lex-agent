// Seed de desarrollo: crea usuario + admin de prueba (idempotente).
// Uso: npm run seed   (respeta DATABASE_PROVIDER/DATABASE_URL/SQLITE_PATH del .env)
// REHUSADO en producción (NODE_ENV=production). Credenciales solo-dev, ver README.
// Imports dinámicos: el guardia de producción corre antes de cargar config
// (el barrel shared/config valida al importar).

const CUENTAS = [
  { email: 'usuario@lex.local', password: 'lex12345', displayName: 'Usuario Prueba', role: 'user' },
  { email: 'admin@lex.local', password: 'admin12345', displayName: 'Admin Prueba', role: 'admin' },
];

async function main(): Promise<void> {
  if ((process.env.NODE_ENV ?? '').toLowerCase() === 'production') {
    console.error('seed rehusado en producción');
    process.exit(1);
  }
  const { loadAppConfig } = await import('../shared/config');
  const { describeDbError, newUuid } = await import('../shared/db/dialect');
  const { createDriver } = await import('../shared/db/provider');
  const { ScryptPasswordHasher } = await import(
    '../modules/identity/infrastructure/crypto/scrypt-password-hasher'
  );
  const cfg = loadAppConfig(__dirname);
  const db = createDriver(cfg);
  await db.init();
  try {
    const hasher = new ScryptPasswordHasher();
    for (const c of CUENTAS) {
      const exists = await db.query('SELECT id FROM users WHERE email = $1', [c.email]);
      if (exists.rowCount) {
        console.log(`skip ${c.email} (existe)`);
        continue;
      }
      const now = new Date();
      // Cuentas de prueba con consentimiento de la versión vigente (ficción
      // de dev documentada: evita el ConsentGate en desarrollo local).
      const { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION } = await import(
        '../modules/identity/domain/consent-versions'
      );
      await db.query(
        `INSERT INTO users (id, email, display_name, password_hash, email_verified_at, status, role,
          terms_version, terms_accepted_at, privacy_version, privacy_accepted_at, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,'active',$6,$7,$8,$9,$10,$11,$11)`,
        [
          newUuid(),
          c.email,
          c.displayName,
          await hasher.hash(c.password),
          now,
          c.role,
          CURRENT_TERMS_VERSION,
          now,
          CURRENT_PRIVACY_VERSION,
          now,
          now,
        ],
      );
      console.log(`ok ${c.email} (${c.role})`);
    }
    console.log('seed listo (solo desarrollo)');
  } catch (e) {
    const msg = describeDbError(e);
    console.error(`seed falló: ${msg}`);
    if (/no such table|does not exist/i.test(msg)) {
      console.error('pista: corre npm run migrate primero');
    }
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}

main().catch((e: Error) => {
  console.error(`seed falló: ${e.message}`);
  process.exit(1);
});
