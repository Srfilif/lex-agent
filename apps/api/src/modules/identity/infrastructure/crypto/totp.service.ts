// TOTP RFC 6238 (SHA-1, 6 dígitos, 30s) + base32 RFC 4648. Sin deps.
// Compatible con Google/Microsoft Authenticator, Aegis, etc.
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { TotpService } from '../../application/ports';

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf: Buffer): string {
  let out = '';
  let bits = 0;
  let acc = 0;
  for (const byte of buf) {
    acc = (acc << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += B32[(acc >> bits) & 31];
    }
  }
  if (bits > 0) out += B32[(acc << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  const clean = s.replace(/=+$/, '').toUpperCase();
  const bytes: number[] = [];
  let bits = 0;
  let acc = 0;
  for (const ch of clean) {
    const v = B32.indexOf(ch);
    if (v < 0) throw new Error('base32 inválido');
    acc = (acc << 5) | v;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((acc >> bits) & 255);
    }
  }
  return Buffer.from(bytes);
}

function hotp(secret: Buffer, counter: number, digits: number): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac('sha1', secret).update(msg).digest();
  const offset = (mac[mac.length - 1] as number) & 0x0f;
  const code =
    (((mac[offset] as number) & 0x7f) << 24) |
    ((mac[offset + 1] as number) << 16) |
    ((mac[offset + 2] as number) << 8) |
    (mac[offset + 3] as number);
  return (code % 10 ** digits).toString().padStart(digits, '0');
}

export class RfcTotpService implements TotpService {
  constructor(
    private readonly stepSec: number,
    private readonly windowSteps: number,
    private readonly digits = 6,
  ) {}

  generateSecret(bytes = 20): Buffer {
    return randomBytes(bytes);
  }

  /**
   * Verifica dentro de la ventana; devuelve el contador casado o null.
   * El llamador persiste el contador (anti-replay, ver TotpConfig).
   */
  verify(secret: Buffer, code: string, nowMs = Date.now()): number | null {
    if (!/^\d+$/.test(code) || code.length !== this.digits) return null;
    const center = Math.floor(nowMs / 1000 / this.stepSec);
    for (let c = center - this.windowSteps; c <= center + this.windowSteps; c++) {
      if (c < 0) continue;
      const expected = hotp(secret, c, this.digits);
      const a = Buffer.from(code);
      const b = Buffer.from(expected);
      if (a.length === b.length && timingSafeEqual(a, b)) return c;
    }
    return null;
  }

  randomRecoveryCode(): string {
    const raw = base32Encode(randomBytes(5)); // 5 bytes → 8 chars
    return `${raw.slice(0, 4)}-${raw.slice(4)}`;
  }

  otpauthUrl(secret: Buffer, label: string, issuer: string): string {
    const params = new URLSearchParams({
      secret: base32Encode(secret),
      issuer,
      algorithm: 'SHA1',
      digits: String(this.digits),
      period: String(this.stepSec),
    });
    return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(label)}?${params}`;
  }
}
