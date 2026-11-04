// Access tokens JWT HS256 enrollados a mano (sin deps).
// Superficie mínima y fijada: alg=HS256 obligatorio, exp/iat verificados,
// firma con timingSafeEqual. Payload: {sub, sid, role, mfa, iat, exp}.
import { createHmac, timingSafeEqual } from 'crypto';
import { AccessClaims, AccessTokens } from '../../application/ports';
import { UserRole } from '../../domain/user';

const HEADER = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');

function b64uDecode(s: string): string {
  return Buffer.from(s, 'base64url').toString('utf8');
}

function isRole(v: unknown): v is UserRole {
  return v === 'user' || v === 'admin';
}

export class Hs256AccessTokens implements AccessTokens {
  constructor(
    private readonly secret: string,
    private readonly ttlMin: number,
  ) {}

  issueAccess(userId: string, sessionId: string, role: UserRole, mfa = false): string {
    const iat = Math.floor(Date.now() / 1000);
    const payload = Buffer.from(
      JSON.stringify({ sub: userId, sid: sessionId, role, mfa, iat, exp: iat + this.ttlMin * 60 }),
    ).toString('base64url');
    const sig = createHmac('sha256', this.secret)
      .update(`${HEADER}.${payload}`)
      .digest('base64url');
    return `${HEADER}.${payload}.${sig}`;
  }

  verifyAccess(token: string): AccessClaims | null {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [h, p, s] = parts as [string, string, string];
    if (h !== HEADER) return null; // algoritmo fijado: solo nuestro HS256
    const expected = createHmac('sha256', this.secret).update(`${h}.${p}`).digest('base64url');
    const a = Buffer.from(s);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    let j: Record<string, unknown>;
    try {
      j = JSON.parse(b64uDecode(p)) as Record<string, unknown>;
    } catch {
      return null;
    }
    const now = Math.floor(Date.now() / 1000);
    if (
      typeof j.sub !== 'string' ||
      typeof j.sid !== 'string' ||
      !isRole(j.role) ||
      typeof j.exp !== 'number' ||
      typeof j.iat !== 'number' ||
      j.exp <= now ||
      j.iat > now + 60
    ) {
      return null;
    }
    return { sub: j.sub, sid: j.sid, role: j.role, mfa: j.mfa === true };
  }
}
