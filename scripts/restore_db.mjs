// Restore de prueba (I1). Uso: node scripts/restore_db.mjs <dump>
// Restaura a BD temporal lex_restore_test, verifica tablas/documentos y la borra.
// NUNCA toca lexdb. Sale 1 si algo falla. Solo stdlib.
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const dump = process.argv[2];
if (!dump || !existsSync(dump)) {
  console.error('FAIL indique dump existente: node scripts/restore_db.mjs backups/....dump');
  process.exit(1);
}
const psql = (db, sql) =>
  execSync(`docker exec lexagent-db-1 psql -U lex -d ${db} -t -c "${sql}"`, { encoding: 'utf8' }).trim();
let fails = 0;
const check = (n, ok, x = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${n}${ok ? '' : ` ${x}`}`);
  if (!ok) fails++;
};

try {
  execSync('docker cp ' + dump + ' lexagent-db-1:/tmp/restore.dump', { stdio: 'pipe' });
  execSync('docker exec lexagent-db-1 psql -U lex -d postgres -c "DROP DATABASE IF EXISTS lex_restore_test"', { stdio: 'pipe' });
  execSync('docker exec lexagent-db-1 psql -U lex -d postgres -c "CREATE DATABASE lex_restore_test OWNER lex"', { stdio: 'pipe' });
  execSync('docker exec lexagent-db-1 pg_restore -U lex -d lex_restore_test --no-owner --role=lex /tmp/restore.dump', { stdio: 'pipe' });
  check('restore sin error', true);
  const docs = psql('lex_restore_test', 'SELECT count(*) FROM documents');
  check('restore documents=3', docs === '3', docs);
  const chunks = psql('lex_restore_test', 'SELECT count(*) FROM chunks');
  check('restore chunks=1407', chunks === '1407', chunks);
  const users = psql('lex_restore_test', 'SELECT count(*) FROM users');
  check('restore users>0', Number(users) > 0, users);
  const mig = psql('lex_restore_test', 'SELECT count(*) FROM schema_migrations');
  check('restore migraciones>0', Number(mig) > 0, mig);
} catch (e) {
  check('restore sin error', false, String(e).slice(0, 200));
} finally {
  execSync('docker exec lexagent-db-1 psql -U lex -d postgres -c "DROP DATABASE IF EXISTS lex_restore_test"', { stdio: 'pipe' });
  execSync('docker exec lexagent-db-1 rm -f /tmp/restore.dump', { stdio: 'pipe' });
}
if (fails) {
  console.log(`${fails} restore roto(s)`);
  process.exit(1);
}
console.log('restore verde (BD temporal eliminada)');
