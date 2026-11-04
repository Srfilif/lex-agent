// Repositorios pg de identidad. SQL parametrizado; fechas TIMESTAMPTZ↔Date.
import { Injectable } from '@nestjs/common';
import { Db } from '../../../../db';
import { escapeLike } from '../../../../shared/sql';
import {
  NewSecurityEvent,
  OneTimeToken,
  OneTimeTokenKind,
  OneTimeTokenRepository,
  RecoveryCodeRepository,
  RecoveryCodeRow,
  SecurityEventRepository,
  SessionRepository,
  TotpRepository,
  USER_REPOSITORY,
  UserListQuery,
  UserRepository,
} from '../../domain/repositories';
import { AuthSession } from '../../domain/session';
import { TotpConfig } from '../../domain/totp';
import { NewUserProps, User, UserProps } from '../../domain/user';

// Re-export del token para el módulo (evita import profundo extra).
export { USER_REPOSITORY };

interface UserRow {
  id: string;
  email: string;
  display_name: string;
  password_hash: string;
  email_verified_at: Date | null;
  status: string;
  role: string;
  created_at: Date;
  updated_at: Date;
}

function toUser(r: UserRow): User {
  const props: UserProps = {
    id: r.id,
    email: r.email,
    displayName: r.display_name,
    passwordHash: r.password_hash,
    emailVerifiedAt: r.email_verified_at,
    status: r.status as UserProps['status'],
    role: r.role as UserProps['role'],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
  return User.rehydrate(props);
}

@Injectable()
export class PgUserRepository implements UserRepository {
  constructor(private readonly db: Db) {}

  async findByEmail(email: string): Promise<User | null> {
    const r = await this.db.raw.query('SELECT * FROM users WHERE email = $1', [email]);
    if (!r.rowCount) return null;
    return toUser(r.rows[0] as UserRow);
  }

  async findById(id: string): Promise<User | null> {
    const r = await this.db.raw.query('SELECT * FROM users WHERE id = $1', [id]);
    if (!r.rowCount) return null;
    return toUser(r.rows[0] as UserRow);
  }

  async insert(n: NewUserProps): Promise<User> {
    const r = await this.db.raw.query(
      `INSERT INTO users (id, email, display_name, password_hash, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $5) RETURNING *`,
      [n.id, n.email, n.displayName, n.passwordHash, n.now],
    );
    return toUser(r.rows[0] as UserRow);
  }

  async update(u: User): Promise<void> {
    const p = u.snapshot;
    await this.db.raw.query(
      `UPDATE users SET email = $2, display_name = $3, password_hash = $4,
        email_verified_at = $5, status = $6, role = $7, updated_at = $8
       WHERE id = $1`,
      [p.id, p.email, p.displayName, p.passwordHash, p.emailVerifiedAt, p.status, p.role, p.updatedAt],
    );
  }

  private searchClause(search: string): { clause: string; params: unknown[] } {
    if (!search) return { clause: '', params: [] };
    return { clause: 'WHERE email ILIKE $1', params: [`%${escapeLike(search)}%`] };
  }

  async list(q: UserListQuery): Promise<User[]> {
    const limit = Math.min(Math.max(Math.trunc(q.limit) || 20, 1), 100);
    const offset = Math.max(Math.trunc(q.offset) || 0, 0);
    const { clause, params } = this.searchClause(q.search);
    const r = await this.db.raw.query(
      `SELECT * FROM users ${clause} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
      params,
    );
    return (r.rows as UserRow[]).map(toUser);
  }

  async count(search: string): Promise<number> {
    const { clause, params } = this.searchClause(search);
    const r = await this.db.raw.query(`SELECT count(*)::int AS n FROM users ${clause}`, params);
    return (r.rows[0] as { n: number }).n;
  }
}

interface SessionRow {
  id: string;
  user_id: string;
  refresh_hash: string;
  family: string;
  prev_hash: string | null;
  created_at: Date;
  last_seen_at: Date;
  expires_at: Date;
  revoked_at: Date | null;
  revoke_reason: string | null;
  device_label: string | null;
  user_agent: string | null;
  ip: string | null;
  mfa_ok: boolean;
}

function toSession(r: SessionRow): AuthSession {
  return AuthSession.rehydrate({
    id: r.id,
    userId: r.user_id,
    refreshHash: r.refresh_hash,
    family: r.family,
    prevHash: r.prev_hash,
    createdAt: r.created_at,
    lastSeenAt: r.last_seen_at,
    expiresAt: r.expires_at,
    revokedAt: r.revoked_at,
    revokeReason: r.revoke_reason,
    deviceLabel: r.device_label,
    userAgent: r.user_agent,
    ip: r.ip,
    mfaOk: r.mfa_ok,
  });
}

@Injectable()
export class PgSessionRepository implements SessionRepository {
  constructor(private readonly db: Db) {}

  async insert(s: AuthSession): Promise<void> {
    const p = s.snapshot;
    await this.db.raw.query(
      `INSERT INTO auth_sessions
        (id, user_id, refresh_hash, family, prev_hash, created_at, last_seen_at,
         expires_at, revoked_at, revoke_reason, device_label, user_agent, ip, mfa_ok)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        p.id, p.userId, p.refreshHash, p.family, p.prevHash, p.createdAt, p.lastSeenAt,
        p.expiresAt, p.revokedAt, p.revokeReason,
        p.deviceLabel?.slice(0, 80) ?? null,
        p.userAgent?.slice(0, 300) ?? null,
        p.ip,
        p.mfaOk,
      ],
    );
  }

  async save(s: AuthSession): Promise<void> {
    const p = s.snapshot;
    await this.db.raw.query(
      `UPDATE auth_sessions SET last_seen_at = $2, revoked_at = $3,
        revoke_reason = $4, user_agent = $5, ip = $6 WHERE id = $1`,
      [p.id, p.lastSeenAt, p.revokedAt, p.revokeReason, p.userAgent?.slice(0, 300) ?? null, p.ip],
    );
  }

  async findById(id: string): Promise<AuthSession | null> {
    const r = await this.db.raw.query('SELECT * FROM auth_sessions WHERE id = $1', [id]);
    if (!r.rowCount) return null;
    return toSession(r.rows[0] as SessionRow);
  }

  async findByRefreshHash(hash: string): Promise<AuthSession | null> {
    const r = await this.db.raw.query('SELECT * FROM auth_sessions WHERE refresh_hash = $1', [
      hash,
    ]);
    if (!r.rowCount) return null;
    return toSession(r.rows[0] as SessionRow);
  }

  async findByPrevHash(hash: string): Promise<AuthSession | null> {
    const r = await this.db.raw.query('SELECT * FROM auth_sessions WHERE prev_hash = $1', [hash]);
    if (!r.rowCount) return null;
    return toSession(r.rows[0] as SessionRow);
  }

  async listByUser(userId: string): Promise<AuthSession[]> {
    const r = await this.db.raw.query(
      'SELECT * FROM auth_sessions WHERE user_id = $1 ORDER BY last_seen_at DESC',
      [userId],
    );
    return (r.rows as SessionRow[]).map(toSession);
  }

  async revokeFamily(family: string, now: Date, reason: string): Promise<number> {
    const r = await this.db.raw.query(
      `UPDATE auth_sessions SET revoked_at = $2, revoke_reason = $3
       WHERE family = $1 AND revoked_at IS NULL`,
      [family, now, reason],
    );
    return r.rowCount ?? 0;
  }

  async revokeAllForUser(userId: string, now: Date, reason: string): Promise<number> {
    const r = await this.db.raw.query(
      `UPDATE auth_sessions SET revoked_at = $2, revoke_reason = $3
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId, now, reason],
    );
    return r.rowCount ?? 0;
  }

  async revokeAllForUserExcept(
    userId: string,
    exceptSessionId: string,
    now: Date,
    reason: string,
  ): Promise<number> {
    const r = await this.db.raw.query(
      `UPDATE auth_sessions SET revoked_at = $3, revoke_reason = $4
       WHERE user_id = $1 AND id <> $2 AND revoked_at IS NULL`,
      [userId, exceptSessionId, now, reason],
    );
    return r.rowCount ?? 0;
  }
}

interface OttRow {
  id: string;
  user_id: string;
  kind: string;
  token_hash: string;
  new_email: string | null;
  expires_at: Date;
  consumed_at: Date | null;
}

@Injectable()
export class PgOneTimeTokenRepository implements OneTimeTokenRepository {
  constructor(private readonly db: Db) {}

  async issue(
    userId: string,
    kind: OneTimeTokenKind,
    tokenHash: string,
    expiresAt: Date,
    newEmail: string | null = null,
  ): Promise<void> {
    await this.db.raw.query(
      `INSERT INTO one_time_tokens (user_id, kind, token_hash, new_email, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, kind, tokenHash, newEmail, expiresAt],
    );
  }

  async findByHash(kind: OneTimeTokenKind, tokenHash: string): Promise<OneTimeToken | null> {
    const r = await this.db.raw.query(
      'SELECT * FROM one_time_tokens WHERE kind = $1 AND token_hash = $2',
      [kind, tokenHash],
    );
    if (!r.rowCount) return null;
    const w = r.rows[0] as OttRow;
    return {
      id: w.id,
      userId: w.user_id,
      kind: w.kind as OneTimeTokenKind,
      tokenHash: w.token_hash,
      newEmail: w.new_email,
      expiresAt: w.expires_at,
      consumedAt: w.consumed_at,
    };
  }

  async consume(id: string, now: Date): Promise<void> {
    await this.db.raw.query('UPDATE one_time_tokens SET consumed_at = $2 WHERE id = $1', [id, now]);
  }

  async deleteForUser(userId: string, kind: OneTimeTokenKind): Promise<void> {
    await this.db.raw.query('DELETE FROM one_time_tokens WHERE user_id = $1 AND kind = $2', [
      userId,
      kind,
    ]);
  }
}

interface TotpRow {
  user_id: string;
  secret_enc: string;
  status: string;
  last_counter: string;
  created_at: Date;
  confirmed_at: Date | null;
}

function toTotp(r: TotpRow): TotpConfig {
  return TotpConfig.rehydrate({
    userId: r.user_id,
    secretEnc: r.secret_enc,
    status: r.status as 'pending' | 'active',
    lastCounter: Number(r.last_counter),
    createdAt: r.created_at,
    confirmedAt: r.confirmed_at,
  });
}

@Injectable()
export class PgTotpRepository implements TotpRepository {
  constructor(private readonly db: Db) {}

  async findByUser(userId: string): Promise<TotpConfig | null> {
    const r = await this.db.raw.query('SELECT * FROM totp_configs WHERE user_id = $1', [userId]);
    if (!r.rowCount) return null;
    return toTotp(r.rows[0] as TotpRow);
  }

  async savePending(t: TotpConfig): Promise<void> {
    const p = t.snapshot;
    await this.db.raw.query(
      `INSERT INTO totp_configs (user_id, secret_enc, status, last_counter, created_at, confirmed_at)
       VALUES ($1, $2, 'pending', -1, $3, NULL)
       ON CONFLICT (user_id) DO UPDATE SET
         secret_enc = EXCLUDED.secret_enc, status = 'pending',
         last_counter = -1, created_at = EXCLUDED.created_at, confirmed_at = NULL`,
      [p.userId, p.secretEnc, p.createdAt],
    );
  }

  async save(t: TotpConfig): Promise<void> {
    const p = t.snapshot;
    await this.db.raw.query(
      `UPDATE totp_configs SET secret_enc = $2, status = $3,
        last_counter = $4, confirmed_at = $5 WHERE user_id = $1`,
      [p.userId, p.secretEnc, p.status, p.lastCounter, p.confirmedAt],
    );
  }

  async delete(userId: string): Promise<void> {
    await this.db.raw.query('DELETE FROM totp_configs WHERE user_id = $1', [userId]);
  }
}

interface RecRow {
  id: string;
  user_id: string;
  used_at: Date | null;
}

@Injectable()
export class PgRecoveryCodeRepository implements RecoveryCodeRepository {
  constructor(private readonly db: Db) {}

  async replaceAll(userId: string, codeHashes: string[]): Promise<void> {
    const client = await this.db.raw.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM recovery_codes WHERE user_id = $1', [userId]);
      for (const h of codeHashes) {
        await client.query('INSERT INTO recovery_codes (user_id, code_hash) VALUES ($1, $2)', [
          userId,
          h,
        ]);
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async findByHash(codeHash: string): Promise<RecoveryCodeRow | null> {
    const r = await this.db.raw.query('SELECT id, user_id, used_at FROM recovery_codes WHERE code_hash = $1', [
      codeHash,
    ]);
    if (!r.rowCount) return null;
    const w = r.rows[0] as RecRow;
    return { id: w.id, userId: w.user_id, usedAt: w.used_at };
  }

  async markUsed(id: string, now: Date): Promise<boolean> {
    const r = await this.db.raw.query(
      'UPDATE recovery_codes SET used_at = $2 WHERE id = $1 AND used_at IS NULL',
      [id, now],
    );
    return (r.rowCount ?? 0) === 1;
  }

  async countLeft(userId: string): Promise<number> {
    const r = await this.db.raw.query(
      'SELECT count(*)::int AS n FROM recovery_codes WHERE user_id = $1 AND used_at IS NULL',
      [userId],
    );
    return (r.rows[0] as { n: number }).n;
  }
}

@Injectable()
export class PgSecurityEventRepository implements SecurityEventRepository {
  constructor(private readonly db: Db) {}

  async record(e: NewSecurityEvent): Promise<void> {
    await this.db.raw.query(
      `INSERT INTO security_events (user_id, type, success, ip, user_agent, meta)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [e.userId, e.type, e.success, e.ip, e.userAgent?.slice(0, 300) ?? null, JSON.stringify(e.meta)],
    );
  }
}
