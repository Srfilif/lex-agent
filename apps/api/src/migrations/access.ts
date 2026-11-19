// Gestión del control de acceso (uso: npm run access -- <comando> ...).
// allow <patrón> [etiqueta] · unallow <id|patrón> · wlist
// code [--label x] [--uses N] [--days D] · clist · revoke <id> · mode
// Patrones: correo exacto o *@dominio.tld. Los códigos se muestran una vez.
import { createHash, randomBytes } from 'crypto';
import { loadAppConfig } from '../shared/config';
import { createDriver } from '../shared/db/provider';
import { newUuid } from '../shared/db/dialect';
import { describeDbError } from '../shared/db/dialect';
import {
  formatAccessCode,
  normalizeAccessCode,
  parseWhitelistPattern,
} from '../modules/identity/domain/access';

function uso(): never {
  console.error(
    'uso: npm run access -- allow <patrón> [etiqueta] | unallow <id|patrón> | wlist | ' +
      'code [--label x] [--uses N] [--days D] | clist | revoke <id> | mode',
  );
  process.exit(1);
}

function sha256hex(v: string): string {
  return createHash('sha256').update(v, 'utf8').digest('hex');
}

function flag(args: string[], name: string): string | null {
  const i = args.indexOf(name);
  if (i < 0 || i + 1 >= args.length) return null;
  return args[i + 1];
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd) uso();
  const cfg = loadAppConfig(__dirname);
  const db = createDriver(cfg);
  await db.init();
  try {
    if (cmd === 'mode') {
      const w = await db.query('SELECT COUNT(*) AS n FROM access_whitelist');
      const c = await db.query(
        'SELECT COUNT(*) AS n FROM access_codes WHERE revoked_at IS NULL AND used_count < max_uses',
      );
      console.log(`modo: ${cfg.access.mode}`);
      console.log(`whitelist: ${cfg.access.whitelist.length} en .env + ${w.rows[0].n} en BD`);
      console.log(
        `códigos: ${cfg.access.staticCode ? 'estático .env sí' : 'sin estático'} + ${c.rows[0].n} activos en BD`,
      );
      return;
    }
    if (cmd === 'wlist') {
      const r = await db.query(
        'SELECT id, pattern, label, created_at FROM access_whitelist ORDER BY created_at DESC',
      );
      for (const w of r.rows as Array<Record<string, unknown>>) {
        console.log(`${w.id}  ${w.pattern}${w.label ? `  (${w.label})` : ''}`);
      }
      if (!r.rowCount) console.log('(vacía en BD)');
      return;
    }
    if (cmd === 'allow') {
      const pattern = parseWhitelistPattern(rest[0] ?? '');
      const label = (rest[1] ?? '').trim().slice(0, 80) || null;
      await db.query('INSERT INTO access_whitelist (id, pattern, label) VALUES ($1, $2, $3)', [
        newUuid(),
        pattern,
        label,
      ]);
      console.log(`ok: ${pattern}`);
      return;
    }
    if (cmd === 'unallow') {
      const target = (rest[0] ?? '').trim();
      if (!target) uso();
      const byId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(target);
      const r = byId
        ? await db.query('DELETE FROM access_whitelist WHERE id = $1', [target])
        : await db.query('DELETE FROM access_whitelist WHERE pattern = $1', [
            target.toLowerCase(),
          ]);
      if (!r.rowCount) {
        console.error('sin coincidencias');
        process.exit(1);
      }
      console.log(`ok: ${r.rowCount} eliminada(s)`);
      return;
    }
    if (cmd === 'clist') {
      const r = await db.query(
        `SELECT id, label, max_uses, used_count, expires_at, revoked_at, created_at
         FROM access_codes ORDER BY created_at DESC`,
      );
      for (const c of r.rows as Array<Record<string, unknown>>) {
        console.log(
          `${c.id}  usos ${c.used_count}/${c.max_uses}` +
            `${c.label ? `  (${c.label})` : ''}` +
            `${c.expires_at ? `  expira ${c.expires_at}` : ''}` +
            `${c.revoked_at ? '  REVOCADO' : ''}`,
        );
      }
      if (!r.rowCount) console.log('(sin códigos en BD)');
      return;
    }
    if (cmd === 'code') {
      const label = (flag(rest, '--label') ?? '').trim().slice(0, 80) || null;
      const maxUses = Number(flag(rest, '--uses') ?? '1');
      const daysRaw = flag(rest, '--days');
      const days = daysRaw === null ? null : Number(daysRaw);
      if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 10000) {
        console.error('--uses debe estar entre 1 y 10000');
        process.exit(1);
      }
      if (days !== null && (!Number.isInteger(days) || days < 1 || days > 3650)) {
        console.error('--days debe estar entre 1 y 3650');
        process.exit(1);
      }
      const code = formatAccessCode(randomBytes(12));
      await db.query(
        `INSERT INTO access_codes (id, code_hash, label, max_uses, expires_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          newUuid(),
          sha256hex(normalizeAccessCode(code)),
          label,
          maxUses,
          days === null ? null : new Date(Date.now() + days * 86400 * 1000),
        ],
      );
      console.log(`código (se muestra una sola vez): ${code}`);
      return;
    }
    if (cmd === 'revoke') {
      const id = (rest[0] ?? '').trim();
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
        console.error('revocar requiere el id uuid del código (ver clist)');
        process.exit(1);
      }
      const r = await db.query(
        'UPDATE access_codes SET revoked_at = CURRENT_TIMESTAMP WHERE id = $1 AND revoked_at IS NULL',
        [id],
      );
      if (!r.rowCount) {
        console.error('código no encontrado o ya revocado');
        process.exit(1);
      }
      console.log('ok: revocado');
      return;
    }
    uso();
  } catch (e) {
    console.error(`access falló: ${describeDbError(e)}`);
    process.exit(1);
  } finally {
    await db.end();
  }
}

main().catch((e: Error) => {
  console.error(`access falló: ${e.message}`);
  process.exit(1);
});
