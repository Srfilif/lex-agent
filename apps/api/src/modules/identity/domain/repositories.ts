// Puertos de persistencia del dominio de identidad (los implementa pg).
import { AuthSession } from './session';
import { TotpConfig } from './totp';
import { NewUserProps, User } from './user';

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
export const WHITELIST_REPOSITORY = Symbol('WHITELIST_REPOSITORY');
export const ACCESS_CODE_REPOSITORY = Symbol('ACCESS_CODE_REPOSITORY');
export const SESSION_REPOSITORY = Symbol('SESSION_REPOSITORY');
export const ONE_TIME_TOKEN_REPOSITORY = Symbol('ONE_TIME_TOKEN_REPOSITORY');
export const SECURITY_EVENT_REPOSITORY = Symbol('SECURITY_EVENT_REPOSITORY');
export const TOTP_REPOSITORY = Symbol('TOTP_REPOSITORY');
export const RECOVERY_CODE_REPOSITORY = Symbol('RECOVERY_CODE_REPOSITORY');

export interface UserListQuery {
  limit: number;
  offset: number;
  search: string;
}

export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  insert(n: NewUserProps): Promise<User>;
  update(u: User): Promise<void>;
  list(q: UserListQuery): Promise<User[]>;
  count(search: string): Promise<number>;
}

export interface SessionRepository {
  insert(s: AuthSession): Promise<void>;
  save(s: AuthSession): Promise<void>;
  findById(id: string): Promise<AuthSession | null>;
  findByRefreshHash(hash: string): Promise<AuthSession | null>;
  findByPrevHash(hash: string): Promise<AuthSession | null>;
  listByUser(userId: string): Promise<AuthSession[]>;
  revokeFamily(family: string, now: Date, reason: string): Promise<number>;
  revokeAllForUser(userId: string, now: Date, reason: string): Promise<number>;
  revokeAllForUserExcept(
    userId: string,
    exceptSessionId: string,
    now: Date,
    reason: string,
  ): Promise<number>;
}

export type OneTimeTokenKind = 'email_verify' | 'password_reset' | 'email_change' | 'account_delete';

export interface OneTimeToken {
  id: string;
  userId: string;
  kind: OneTimeTokenKind;
  tokenHash: string;
  newEmail: string | null;
  expiresAt: Date;
  consumedAt: Date | null;
}

export interface OneTimeTokenRepository {
  issue(
    userId: string,
    kind: OneTimeTokenKind,
    tokenHash: string,
    expiresAt: Date,
    newEmail?: string | null,
  ): Promise<void>;
  findByHash(kind: OneTimeTokenKind, tokenHash: string): Promise<OneTimeToken | null>;
  consume(id: string, now: Date): Promise<void>;
  deleteForUser(userId: string, kind: OneTimeTokenKind): Promise<void>;
}

export interface NewSecurityEvent {
  userId: string | null;
  type: string;
  success: boolean;
  ip: string | null;
  userAgent: string | null;
  meta: Record<string, unknown>;
}

export interface SecurityEventRepository {
  record(e: NewSecurityEvent): Promise<void>;
}

export interface TotpRepository {
  findByUser(userId: string): Promise<TotpConfig | null>;
  /** Inserta o reemplaza el pendiente (reiniciar setup invalida el anterior). */
  savePending(t: TotpConfig): Promise<void>;
  save(t: TotpConfig): Promise<void>;
  delete(userId: string): Promise<void>;
}

export interface RecoveryCodeRow {
  id: string;
  userId: string;
  usedAt: Date | null;
}

export interface RecoveryCodeRepository {
  /** Reemplaza todos los códigos del usuario (invalida anteriores). */
  replaceAll(userId: string, codeHashes: string[]): Promise<void>;
  findByHash(codeHash: string): Promise<RecoveryCodeRow | null>;
  /** Marca uso solo si estaba sin usar (anti doble-uso concurrente). */
  markUsed(id: string, now: Date): Promise<boolean>;
  countLeft(userId: string): Promise<number>;
}

export interface WhitelistEntry {
  id: string;
  pattern: string;
  label: string | null;
  createdAt: Date;
}

export interface WhitelistRepository {
  list(): Promise<WhitelistEntry[]>;
  patterns(): Promise<string[]>;
  add(id: string, pattern: string, label: string | null, createdBy: string | null): Promise<WhitelistEntry>;
  remove(id: string): Promise<boolean>;
}

export interface AccessCode {
  id: string;
  codeHash: string;
  label: string | null;
  maxUses: number;
  usedCount: number;
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface AccessCodeRepository {
  list(): Promise<AccessCode[]>;
  findByHash(codeHash: string): Promise<AccessCode | null>;
  insert(c: {
    id: string;
    codeHash: string;
    label: string | null;
    maxUses: number;
    expiresAt: Date | null;
    createdBy: string | null;
  }): Promise<AccessCode>;
  /** Consume un uso solo si quedan usos y no está revocado (atómico). */
  consume(id: string): Promise<boolean>;
  revoke(id: string, now: Date): Promise<boolean>;
}
