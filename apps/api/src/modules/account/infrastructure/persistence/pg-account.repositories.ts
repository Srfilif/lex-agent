// Repositorios pg del módulo account.
import { Injectable } from '@nestjs/common';
import { Db } from '../../../../db';
import { asBool, asDate, asDateOrNull, asJson } from '../../../../shared/db/dialect';
import {
  AccountPrivacyRepository,
  DeletionSummary,
  MemoryEntry,
  MemoryRepository,
  PreferencesRepository,
} from '../../domain/repositories';

@Injectable()
export class PgPreferencesRepository implements PreferencesRepository {
  constructor(private readonly db: Db) {}

  async get(userId: string): Promise<Record<string, unknown>> {
    const r = await this.db.raw.query('SELECT data FROM user_preferences WHERE user_id = $1', [
      userId,
    ]);
    if (!r.rowCount) return {};
    const row = r.rows[0] as { data: unknown };
    return asJson<Record<string, unknown>>(row.data, {});
  }

  async save(userId: string, data: Record<string, unknown>): Promise<void> {
    await this.db.raw.query(
      `INSERT INTO user_preferences (user_id, data, updated_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, updated_at = CURRENT_TIMESTAMP`,
      [userId, JSON.stringify(data)],
    );
  }
}

@Injectable()
export class PgMemoryRepository implements MemoryRepository {
  constructor(private readonly db: Db) {}

  async list(userId: string): Promise<MemoryEntry[]> {
    const r = await this.db.raw.query(
      'SELECT id, fact, created_at FROM user_memories WHERE user_id = $1 ORDER BY created_at, id',
      [userId],
    );
    return (r.rows as Array<{ id: string; fact: string; created_at: Date }>).map((m) => ({
      id: m.id,
      fact: m.fact,
      createdAt: asDate(m.created_at),
    }));
  }

  async add(userId: string, fact: string): Promise<MemoryEntry> {
    const r = await this.db.raw.query(
      `INSERT INTO user_memories (user_id, fact) VALUES ($1, $2)
       RETURNING id, fact, created_at`,
      [userId, fact],
    );
    const m = r.rows[0] as { id: string; fact: string; created_at: Date };
    return { id: m.id, fact: m.fact, createdAt: asDate(m.created_at) };
  }

  async remove(userId: string, id: string): Promise<boolean> {
    const r = await this.db.raw.query('DELETE FROM user_memories WHERE user_id = $1 AND id = $2', [
      userId,
      id,
    ]);
    return (r.rowCount ?? 0) > 0;
  }

  async count(userId: string): Promise<number> {
    const r = await this.db.raw.query('SELECT CAST(count(*) AS INTEGER) AS n FROM user_memories WHERE user_id = $1', [
      userId,
    ]);
    return (r.rows[0] as { n: number }).n;
  }

  async dropOldest(userId: string, keep: number): Promise<number> {
    const r = await this.db.raw.query(
      `DELETE FROM user_memories WHERE user_id = $1 AND id NOT IN (
         SELECT id FROM user_memories WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2
       )`,
      [userId, Math.max(keep, 0)],
    );
    return r.rowCount ?? 0;
  }
}

@Injectable()
export class PgAccountPrivacyRepository implements AccountPrivacyRepository {
  constructor(private readonly db: Db) {}

  async markDeletionRequested(userId: string, now: Date): Promise<void> {
    await this.db.raw.query('UPDATE users SET deletion_requested_at = $2 WHERE id = $1', [
      userId,
      now,
    ]);
  }

  async getDeletionRequested(userId: string): Promise<Date | null> {
    const r = await this.db.raw.query('SELECT deletion_requested_at FROM users WHERE id = $1', [
      userId,
    ]);
    if (!r.rowCount) return null;
    const row = r.rows[0] as { deletion_requested_at: Date | null };
    return asDateOrNull(row.deletion_requested_at);
  }

  async clearDeletionRequested(userId: string): Promise<void> {
    await this.db.raw.query('UPDATE users SET deletion_requested_at = NULL WHERE id = $1', [
      userId,
    ]);
  }

  async exportData(userId: string): Promise<Record<string, unknown>> {
    const q = (sql: string, params: unknown[] = []) => this.db.raw.query(sql, [userId, ...params]);
    const [u, prefs, sessions, totp, subs, subEvents, pays, usage, events, invs, mems] = await Promise.all([
      q(`SELECT id, email, display_name, email_verified_at IS NOT NULL AS verified,
                status, role, created_at,
                terms_version, terms_accepted_at, privacy_version, privacy_accepted_at
         FROM users WHERE id = $1`),
      q('SELECT data, updated_at FROM user_preferences WHERE user_id = $1'),
      q(`SELECT id, created_at, last_seen_at, expires_at, revoked_at, device_label
         FROM auth_sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`),
      q('SELECT status, created_at, confirmed_at FROM totp_configs WHERE user_id = $1'),
      q(`SELECT id, plan_code, status, current_period_start, current_period_end,
                cancel_at_period_end FROM subscriptions WHERE user_id = $1 ORDER BY created_at DESC`),
      q(`SELECT se.type, se.from_status, se.to_status, se.meta, se.created_at
         FROM subscription_events se JOIN subscriptions s ON s.id = se.subscription_id
         WHERE se.user_id = $1 ORDER BY se.created_at DESC LIMIT 100`),
      q(`SELECT plan_code, amount_minor, currency, status, provider, created_at
         FROM payments WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100`),
      q(`SELECT kind, units, tokens_in, tokens_out, cost_usd, ref_type, ref_id, created_at
         FROM usage_events WHERE user_id = $1 ORDER BY created_at DESC LIMIT 500`),
      q(`SELECT type, success, created_at FROM security_events
         WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100`),
      q(`SELECT id, pregunta, costo_usd, created_at FROM investigaciones
         WHERE user_id = $1 ORDER BY created_at DESC LIMIT 200`),
      q('SELECT id, fact, created_at FROM user_memories WHERE user_id = $1 ORDER BY created_at'),
    ]);
    // En sqlite los booleanos llegan como 0/1 y los JSON como string: normalizar.
    const fix = (row: Record<string, unknown>): Record<string, unknown> => {
      const r = { ...row };
      for (const k of ['verified', 'success', 'active', 'cancel_at_period_end', 'mfa_ok']) {
        if (k in r) r[k] = asBool(r[k]);
      }
      for (const k of ['data', 'meta', 'payload', 'traza', 'respuesta', 'usage', 'citations']) {
        if (typeof r[k] === 'string') r[k] = asJson(r[k], r[k]);
      }
      return r;
    };
    const fixAll = (rows: Record<string, unknown>[]): Record<string, unknown>[] => rows.map(fix);
    return {
      user: u.rows[0] ? fix(u.rows[0] as Record<string, unknown>) : null,
      preferences: asJson<Record<string, unknown>>(
        (prefs.rows[0] as { data?: unknown } | undefined)?.data,
        {},
      ),
      sessions: fixAll(sessions.rows),
      totp: totp.rows[0] ? fix(totp.rows[0] as Record<string, unknown>) : { status: 'disabled' },
      subscriptions: fixAll(subs.rows),
      subscription_events: fixAll(subEvents.rows),
      payments: fixAll(pays.rows),
      usage_events: fixAll(usage.rows),
      security_events: fixAll(events.rows),
      investigaciones: fixAll(invs.rows),
      memories: fixAll(mems.rows),
    };
  }

  async deleteAccount(userId: string, now: Date): Promise<DeletionSummary> {
    const client = await this.db.raw.connect();
    try {
      await client.query('BEGIN');
      // 1. Anonimizar identidad (la fila se conserva por integridad de facturación).
      await client.query(
        `UPDATE users SET email = 'deleted_' || id || '@deleted.local',
          display_name = '', password_hash = '*deleted*', email_verified_at = NULL,
          status = 'deleted', deletion_requested_at = NULL, updated_at = $2
         WHERE id = $1`,
        [userId, now],
      );
      // 2. Secretos y factores fuera.
      await client.query('DELETE FROM user_preferences WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM user_memories WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM one_time_tokens WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM totp_configs WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM recovery_codes WHERE user_id = $1', [userId]);
      // 3. Sesiones revocadas (se conservan 90 días, luego purga).
      const sess = await client.query(
        `UPDATE auth_sessions SET revoked_at = $2, revoke_reason = 'cuenta_eliminada'
         WHERE user_id = $1 AND revoked_at IS NULL`,
        [userId, now],
      );
      // 4. Suscripción viva cancelada + evento.
      const sub = await client.query(
        `UPDATE subscriptions SET status = 'canceled', updated_at = $2
         WHERE user_id = $1 AND status IN ('trialing', 'active', 'past_due')
         RETURNING id, status`,
        [userId, now],
      );
      if (sub.rowCount) {
        await client.query(
          `INSERT INTO subscription_events (subscription_id, user_id, type, from_status, to_status)
           VALUES ($1, $2, 'expiracion', 'activa', 'canceled')`,
          [(sub.rows[0] as { id: string }).id, userId],
        );
      }
      // 5. Auditoría anonimizada (filas sin user_id, 1 año retención).
      const sev = await client.query('UPDATE security_events SET user_id = NULL WHERE user_id = $1', [
        userId,
      ]);
      // 6. Webhooks: quitar user_id del payload (Fase F deuda).
      const wh = await client.query(
        this.db.isSqlite
          ? `UPDATE webhook_events SET payload = json_remove(payload, '$.metadata.user_id')
             WHERE json_extract(payload, '$.metadata.user_id') = $1`
          : `UPDATE webhook_events SET payload = payload #- '{metadata,user_id}'
             WHERE payload->'metadata'->>'user_id' = $1`,
        [userId],
      );
      // 7. Investigaciones desvinculadas (se conservan anónimas).
      const inv = await client.query('UPDATE investigaciones SET user_id = NULL WHERE user_id = $1', [
        userId,
      ]);
      // 8. Uso/pagos/suscripciones se conservan (obligación legal; titular anonimizado).
      await client.query(
        `INSERT INTO security_events (user_id, type, success, meta)
         VALUES ($1, 'cuenta_eliminada', true, '{}')`,
        [userId],
      );
      await client.query('COMMIT');
      return {
        sessionsRevoked: sess.rowCount ?? 0,
        subscriptionCanceled: (sub.rowCount ?? 0) > 0,
        eventsAnonymized: sev.rowCount ?? 0,
        webhooksStripped: wh.rowCount ?? 0,
        investigationsDetached: inv.rowCount ?? 0,
      };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
}
