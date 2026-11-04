// Backup Postgres (I1). Uso: node scripts/backup_db.mjs [salida]
// pg_dump formato custom vía docker. Sale 1 si falla. Solo stdlib.
import { execFileSync, execSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';

const out = process.argv[2] ?? `backups/lexdb-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')}.dump`;
mkdirSync('backups', { recursive: true });
if (existsSync(out)) {
  console.error(`FAIL ya existe ${out} (no se sobrescribe)`);
  process.exit(1);
}
try {
  execSync(`docker exec lexagent-db-1 pg_dump -U lex -d lexdb -Fc -f /tmp/bak.dump`, { stdio: 'pipe' });
  execFileSync('docker', ['cp', 'lexagent-db-1:/tmp/bak.dump', out], { stdio: 'pipe' });
  execSync(`docker exec lexagent-db-1 rm -f /tmp/bak.dump`, { stdio: 'pipe' });
  const { size } = await import('node:fs').then((m) => m.statSync(out));
  console.log(`backup ok: ${out} (${(size / 1024 / 1024).toFixed(1)} MB)`);
} catch (e) {
  console.error(`FAIL backup: ${(e).message}`);
  process.exit(1);
}
