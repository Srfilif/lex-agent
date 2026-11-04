// Puertos de infraestructura usados por los casos de uso de identidad.
import { UserRole } from '../domain/user';

export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');
export const TOKEN_GENERATOR = Symbol('TOKEN_GENERATOR');
export const EMAIL_SENDER = Symbol('EMAIL_SENDER');
export const ACCESS_TOKENS = Symbol('ACCESS_TOKENS');
export const RATE_LIMITER = Symbol('RATE_LIMITER');
export const TOTP_SERVICE = Symbol('TOTP_SERVICE');
export const SECRET_CRYPTO = Symbol('SECRET_CRYPTO');
export const MFA_TOKENS = Symbol('MFA_TOKENS');

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, hash: string): Promise<boolean>;
  needsRehash(hash: string): boolean;
}

export interface TokenGenerator {
  /** Token opaco base64url (32 bytes por defecto). */
  randomToken(bytes?: number): string;
  sha256hex(v: string): string;
  uuid(): string;
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface EmailSender {
  send(m: EmailMessage): Promise<void>;
}

export interface AccessClaims {
  sub: string;
  sid: string;
  role: UserRole;
  /** I2: sesión emitida tras MFA (tokens viejos → false). */
  mfa: boolean;
}

export interface AccessTokens {
  issueAccess(userId: string, sessionId: string, role: UserRole, mfa?: boolean): string;
  verifyAccess(token: string): AccessClaims | null;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSec: number;
}

export interface RateLimiter {
  consume(key: string, limit: number, windowSec: number): Promise<RateLimitResult>;
}

/** Meta de la petición para auditoría (IP/UA nunca como autenticadores). */
export interface RequestMeta {
  ip: string | null;
  userAgent: string | null;
}

export interface TotpService {
  generateSecret(bytes?: number): Buffer;
  /** Contador casado dentro de la ventana, o null. */
  verify(secret: Buffer, code: string, nowMs?: number): number | null;
  otpauthUrl(secret: Buffer, label: string, issuer: string): string;
  /** Código de recuperación formato XXXX-XXXX (8 chars base32). */
  randomRecoveryCode(): string;
}

export interface SecretCrypto {
  encrypt(plain: Buffer): string;
  decrypt(enc: string): Buffer;
}

export interface MfaTokens {
  /** Pre-token de 2ª fase (no sirve como sesión). */
  issue(userId: string): string;
  verify(token: string): string | null;
}
