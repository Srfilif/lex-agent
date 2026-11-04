// Pre-token MFA: prueba "primera fase superada", NO una sesión.
// HS256 con claim purpose='mfa' (rechazado por el guard de access y viceversa).
import { createHmac, timingSafeEqual } from 'crypto';
import { MfaTokens } from '../../application/ports';

const HEADER = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');

export class Hs256MfaTokens implements MfaTokens {
  constructor(
    private readonly secret: string,
    private readonly ttlMin: number,
  ) {}

  issue(userId: string): string {
    const iat = Math.floor(Date.now() / 1000);
    const payload = Buffer.from(
      JSON.stringify({ purpose: 'mfa', sub: userId, iat, exp: iat + this.ttlMin * 60 }),
    ).toString('base64url');
    const sig = createHmac('sha256', this.secret)
      .update(`${HEADER}.${payload}`)
      .digest('base64url');
    return `${HEADER}.${payload}.${sig}`;
  }

  verify(token: string): string | null {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [h, p, s] = parts as [string, string, string];
    if (h !== HEADER) return null;
    const expected = createHmac('sha256', this.secret).update(`${h}.${p}`).digest('base64url');
    const a = Buffer.from(s);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    let j: Record<string, unknown>;
    try {
      j = JSON.parse(Buffer.from(p, 'base64url').toString('utf8')) as Record<string, unknown>;
    } catch {
      return null;
    }
    const now = Math.floor(Date.now() / 1000);
    if (
      j.purpose !== 'mfa' ||
      typeof j.sub !== 'string' ||
      typeof j.exp !== 'number' ||
      j.exp <= now
    ) {
      return null;
    }
    return j.sub;
  }
}
