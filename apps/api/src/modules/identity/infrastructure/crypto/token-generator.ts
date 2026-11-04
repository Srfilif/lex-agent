// Generador de tokens opacos + sha256 (node:crypto, sin deps).
import { createHash, randomBytes, randomUUID } from 'crypto';
import { TokenGenerator } from '../../application/ports';

export class CryptoTokenGenerator implements TokenGenerator {
  randomToken(bytes = 32): string {
    return randomBytes(bytes).toString('base64url');
  }

  sha256hex(v: string): string {
    return createHash('sha256').update(v, 'utf8').digest('hex');
  }

  uuid(): string {
    return randomUUID();
  }
}
