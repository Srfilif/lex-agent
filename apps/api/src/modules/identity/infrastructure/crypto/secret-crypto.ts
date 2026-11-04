// Cifrado de secretos TOTP: AES-256-GCM con clave externa a la DB.
// Formato versionado: v1.<ivB64u>.<ct+tagB64u>. IV aleatorio por cifrado.
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { SecretCrypto } from '../../application/ports';

export class AesGcmSecretCrypto implements SecretCrypto {
  private readonly key: Buffer;

  constructor(keyHex: string) {
    this.key = Buffer.from(keyHex, 'hex');
    if (this.key.length !== 32) throw new Error('clave AES-256 inválida (32 bytes)');
  }

  encrypt(plain: Buffer): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const ct = Buffer.concat([cipher.update(plain), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `v1.${iv.toString('base64url')}.${Buffer.concat([ct, tag]).toString('base64url')}`;
  }

  decrypt(enc: string): Buffer {
    const parts = enc.split('.');
    if (parts.length !== 3 || parts[0] !== 'v1') throw new Error('formato de cifrado inválido');
    const iv = Buffer.from(parts[1] as string, 'base64url');
    const data = Buffer.from(parts[2] as string, 'base64url');
    if (iv.length !== 12 || data.length < 17) throw new Error('formato de cifrado inválido');
    const ct = data.subarray(0, data.length - 16);
    const tag = data.subarray(data.length - 16);
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]);
  }
}
