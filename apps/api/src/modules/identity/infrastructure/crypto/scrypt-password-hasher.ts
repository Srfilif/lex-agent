// scrypt (node:crypto) para contraseñas. Sin deps nativas (Alpine).
// Formato versionado: $scrypt$v=1$n=32768,r=8,p=1$<sal>$<hash> (base64url).
// Parámetros: ~64MB, ~50-100ms por verificación en CPU modesta.
import { scrypt as scryptCb, randomBytes, timingSafeEqual, ScryptOptions } from 'crypto';
import { PasswordHasher } from '../../application/ports';

function scryptAsync(
  password: string,
  salt: string,
  keylen: number,
  opts: ScryptOptions,
): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCb(password, salt, keylen, opts, (err, dk: Buffer) => {
      if (err) reject(err);
      else resolve(dk);
    });
  });
}

const VERSION = 'v=1';
const N = 32768;
const R = 8;
const P = 1;
const KEYLEN = 32;
const PREFIX = `$scrypt$${VERSION}$n=${N},r=${R},p=${P}$`;

export class ScryptPasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(16).toString('base64url');
    const dk = await scryptAsync(password, salt, KEYLEN, {
      N,
      r: R,
      p: P,
      maxmem: 64 * 1024 * 1024, // N=2^15,r=8 supera el default de 32MB
    });
    return `${PREFIX}${salt}$${dk.toString('base64url')}`;
  }

  async verify(password: string, hash: string): Promise<boolean> {
    const parts = hash.split('$');
    // ['', 'scrypt', 'v=1', 'n=..', sal, hash]
    if (parts.length !== 6 || parts[1] !== 'scrypt') return false;
    const params = parts[3] ?? '';
    const m = /^n=(\d+),r=(\d+),p=(\d+)$/.exec(params);
    if (!m) return false;
    const salt = parts[4] ?? '';
    const expected = parts[5] ?? '';
    let dk: Buffer;
    try {
      dk = (await scryptAsync(password, salt, KEYLEN, {
        N: Number(m[1]),
        r: Number(m[2]),
        p: Number(m[3]),
        maxmem: 256 * 1024 * 1024,
      })) as Buffer;
    } catch {
      return false;
    }
    const a = Buffer.from(dk.toString('base64url'));
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  needsRehash(hash: string): boolean {
    return !hash.startsWith(PREFIX);
  }
}
