// Repositorios pg de billing. consume() es transaccional e idempotente.
import { Injectable } from '@nestjs/common';
import { Db } from '../../../../db';
import { asBool, asDate, asJson } from '../../../../shared/db/dialect';
import { Entitlements, Plan } from '../../domain/plan';
import {
  ConsumeResult,
  PaymentRepository,
  PlanRepository,
  SubscriptionEventInput,
  SubscriptionEventRepository,
  SubscriptionEventRow,
  SubscriptionRepository,
  UsageRepository,
  WebhookRepository,
  WebhookStatus,
} from '../../domain/repositories';
import { NewPaymentProps, Payment } from '../../domain/payment';
import { Subscription } from '../../domain/subscription';
import { PeriodUsage, UsageEventProps } from '../../domain/usage';

interface PlanRow {
  code: string;
  name: string;
  description: string;
  active: boolean;
  version: number;
  price_minor: number | null;
  currency: string;
}

@Injectable()
export class PgPlanRepository implements PlanRepository {
  constructor(private readonly db: Db) {}

  async listActive(): Promise<Array<{ plan: Plan; entitlements: Entitlements }>> {
    const r = await this.db.raw.query('SELECT * FROM plans WHERE active ORDER BY code');
    const out: Array<{ plan: Plan; entitlements: Entitlements }> = [];
    for (const w of r.rows as PlanRow[]) {
      out.push({ plan: toPlan(w), entitlements: await this.entitlements(w.code) });
    }
    return out;
  }

  async findByCode(code: string): Promise<{ plan: Plan; entitlements: Entitlements } | null> {
    const r = await this.db.raw.query('SELECT * FROM plans WHERE code = $1', [code]);
    if (!r.rowCount) return null;
    const w = r.rows[0] as PlanRow;
    return { plan: toPlan(w), entitlements: await this.entitlements(w.code) };
  }

  private async entitlements(planCode: string): Promise<Entitlements> {
    const r = await this.db.raw.query('SELECT key, value FROM plan_entitlements WHERE plan_code = $1', [
      planCode,
    ]);
    const e: Entitlements = {};
    for (const row of r.rows as Array<{ key: string; value: string }>) e[row.key] = row.value;
    return e;
  }
}

function toPlan(w: PlanRow): Plan {
  return {
    code: w.code,
    name: w.name,
    description: w.description,
    active: asBool(w.active),
    version: w.version,
    priceMinor: w.price_minor,
    currency: w.currency,
  };
}

interface SubRow {
  id: string;
  user_id: string;
  plan_code: string;
  status: string;
  current_period_start: Date;
  current_period_end: Date;
  cancel_at_period_end: boolean;
  created_at: Date;
  updated_at: Date;
}

function toSub(r: SubRow): Subscription {
  return Subscription.rehydrate({
    id: r.id,
    userId: r.user_id,
    planCode: r.plan_code,
    status: r.status as Subscription['snapshot']['status'],
    periodStart: asDate(r.current_period_start),
    periodEnd: asDate(r.current_period_end),
    cancelAtPeriodEnd: asBool(r.cancel_at_period_end),
    createdAt: asDate(r.created_at),
    updatedAt: asDate(r.updated_at),
  });
}

@Injectable()
export class PgSubscriptionRepository implements SubscriptionRepository {
  constructor(private readonly db: Db) {}

  async findLiveByUser(userId: string): Promise<Subscription | null> {
    const r = await this.db.raw.query(
      `SELECT * FROM subscriptions WHERE user_id = $1
       AND status IN ('trialing', 'active', 'past_due')
       ORDER BY current_period_end DESC LIMIT 1`,
      [userId],
    );
    if (!r.rowCount) return null;
    return toSub(r.rows[0] as SubRow);
  }

  async grant(userId: string, planCode: string, until: Date, now: Date): Promise<Subscription> {
    const client = await this.db.raw.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE subscriptions SET status = 'canceled', updated_at = $2
         WHERE user_id = $1 AND status IN ('trialing', 'active', 'past_due')`,
        [userId, now],
      );
      const r = await client.query(
        `INSERT INTO subscriptions (user_id, plan_code, status, current_period_start, current_period_end, created_at, updated_at)
         VALUES ($1, $2, 'active', $3, $4, $3, $3) RETURNING *`,
        [userId, planCode, now, until],
      );
      await client.query('COMMIT');
      return toSub(r.rows[0] as SubRow);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async save(s: Subscription): Promise<void> {
    const p = s.snapshot;
    await this.db.raw.query(
      `UPDATE subscriptions SET plan_code = $2, status = $3, current_period_start = $4,
        current_period_end = $5, cancel_at_period_end = $6, updated_at = $7 WHERE id = $1`,
      [p.id, p.planCode, p.status, p.periodStart, p.periodEnd, p.cancelAtPeriodEnd, p.updatedAt],
    );
  }
}

@Injectable()
export class PgUsageRepository implements UsageRepository {
  constructor(private readonly db: Db) {}

  async consume(
    event: UsageEventProps,
    period: string,
    quotaInv: number,
    quotaTokens: number,
    invUnits: number,
    tokenUnits: number,
  ): Promise<ConsumeResult> {
    const client = await this.db.raw.connect();
    try {
      await client.query('BEGIN');
      const ins = await client.query(
        `INSERT INTO usage_events
          (user_id, kind, units, tokens_in, tokens_out, cost_usd, idempotency_key, ref_type, ref_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (idempotency_key) DO NOTHING RETURNING id`,
        [
          event.userId, event.kind, event.units, event.tokensIn, event.tokensOut,
          event.costUsd, event.idempotencyKey, event.refType, event.refId,
        ],
      );
      if (!ins.rowCount) {
        await client.query('ROLLBACK');
        return { outcome: 'duplicado' };
      }
      await client.query(
        `INSERT INTO usage_periods (user_id, period) VALUES ($1, $2)
         ON CONFLICT (user_id, period) DO NOTHING`,
        [event.userId, period],
      );
      // Chequeo-y-descuento en una sentencia (atómico ante concurrencia).
      const upd = await client.query(
        `UPDATE usage_periods
         SET investigations = investigations + $3, tokens = tokens + $4, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1 AND period = $2
           AND investigations + $3 <= $5 AND tokens + $4 <= $6`,
        [event.userId, period, invUnits, tokenUnits, quotaInv, quotaTokens],
      );
      if (!upd.rowCount) {
        // ¿Cuál cuota falló? (lectura para el mensaje; el rollback anula todo)
        const cur = await client.query(
          'SELECT investigations, tokens FROM usage_periods WHERE user_id = $1 AND period = $2',
          [event.userId, period],
        );
        await client.query('ROLLBACK');
        const row = cur.rows[0] as { investigations: string; tokens: string };
        if (Number(row.investigations) + invUnits > quotaInv) return { outcome: 'cuota_investigaciones' };
        return { outcome: 'cuota_tokens' };
      }
      await client.query('COMMIT');
      return { outcome: 'ok' };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async record(event: UsageEventProps, period: string): Promise<'ok' | 'duplicado'> {
    const client = await this.db.raw.connect();
    try {
      await client.query('BEGIN');
      const ins = await client.query(
        `INSERT INTO usage_events
          (user_id, kind, units, tokens_in, tokens_out, cost_usd, idempotency_key, ref_type, ref_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (idempotency_key) DO NOTHING RETURNING id`,
        [
          event.userId, event.kind, event.units, event.tokensIn, event.tokensOut,
          event.costUsd, event.idempotencyKey, event.refType, event.refId,
        ],
      );
      if (!ins.rowCount) {
        await client.query('ROLLBACK');
        return 'duplicado';
      }
      // sqlite no acepta alias en INSERT: sin calificar equivale a la fila actual.
      const upsertPeriods = this.db.isSqlite
        ? `INSERT INTO usage_periods (user_id, period, investigations, tokens, updated_at)
           VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
           ON CONFLICT (user_id, period) DO UPDATE SET
             investigations = investigations + $3,
             tokens = tokens + $4, updated_at = CURRENT_TIMESTAMP`
        : `INSERT INTO usage_periods AS p (user_id, period, investigations, tokens, updated_at)
           VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
           ON CONFLICT (user_id, period) DO UPDATE SET
             investigations = p.investigations + $3,
             tokens = p.tokens + $4, updated_at = CURRENT_TIMESTAMP`;
      await client.query(upsertPeriods, [
        event.userId,
        period,
        event.units,
        event.tokensIn + event.tokensOut,
      ]);
      await client.query('COMMIT');
      return 'ok';
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async periodUsage(userId: string, period: string): Promise<PeriodUsage> {
    const r = await this.db.raw.query(
      'SELECT investigations, tokens FROM usage_periods WHERE user_id = $1 AND period = $2',
      [userId, period],
    );
    if (!r.rowCount) return { period, investigations: 0, tokens: 0 };
    const w = r.rows[0] as { investigations: string; tokens: string };
    return { period, investigations: Number(w.investigations), tokens: Number(w.tokens) };
  }
}

interface PayRow {
  id: string;
  user_id: string;
  subscription_id: string | null;
  provider: string;
  provider_payment_id: string;
  plan_code: string;
  amount_minor: number;
  currency: string;
  status: string;
  created_at: Date;
  updated_at: Date;
}

function toPay(r: PayRow): Payment {
  return Payment.rehydrate({
    id: r.id,
    userId: r.user_id,
    subscriptionId: r.subscription_id,
    provider: r.provider,
    providerPaymentId: r.provider_payment_id,
    planCode: r.plan_code,
    amountMinor: r.amount_minor,
    currency: r.currency,
    status: r.status as Payment['snapshot']['status'],
    createdAt: asDate(r.created_at),
    updatedAt: asDate(r.updated_at),
  });
}

@Injectable()
export class PgPaymentRepository implements PaymentRepository {
  constructor(private readonly db: Db) {}

  async insertPending(n: NewPaymentProps): Promise<Payment> {
    const r = await this.db.raw.query(
      `INSERT INTO payments
        (user_id, subscription_id, provider, provider_payment_id,
         plan_code, amount_minor, currency, status, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8,$8) RETURNING *`,
      [
        n.userId,
        n.subscriptionId,
        n.provider,
        n.providerPaymentId,
        n.planCode,
        n.amountMinor,
        n.currency,
        n.now,
      ],
    );
    return toPay(r.rows[0] as PayRow);
  }

  async findByProviderId(provider: string, providerPaymentId: string): Promise<Payment | null> {
    const r = await this.db.raw.query(
      'SELECT * FROM payments WHERE provider = $1 AND provider_payment_id = $2',
      [provider, providerPaymentId],
    );
    if (!r.rowCount) return null;
    return toPay(r.rows[0] as PayRow);
  }

  async save(p: Payment): Promise<void> {
    const s = p.snapshot;
    await this.db.raw.query(
      'UPDATE payments SET status = $2, subscription_id = $3, updated_at = $4 WHERE id = $1',
      [s.id, s.status, s.subscriptionId, s.updatedAt],
    );
  }

  async listByUser(userId: string, limit: number): Promise<Payment[]> {
    const lim = Math.min(Math.max(Math.trunc(limit) || 50, 1), 100);
    const r = await this.db.raw.query(
      `SELECT * FROM payments WHERE user_id = $1 ORDER BY created_at DESC LIMIT ${lim}`,
      [userId],
    );
    return (r.rows as PayRow[]).map(toPay);
  }
}

@Injectable()
export class PgWebhookRepository implements WebhookRepository {
  constructor(private readonly db: Db) {}

  async tryInsert(
    provider: string,
    providerEventId: string,
    type: string,
    payload: Record<string, unknown>,
  ): Promise<'insertado' | 'duplicado'> {
    const r = await this.db.raw.query(
      `INSERT INTO webhook_events (provider, provider_event_id, type, payload)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (provider, provider_event_id) DO NOTHING RETURNING id`,
      [provider, providerEventId, type, JSON.stringify(payload)],
    );
    return r.rowCount ? 'insertado' : 'duplicado';
  }

  async markStatus(
    provider: string,
    providerEventId: string,
    status: WebhookStatus,
  ): Promise<void> {
    await this.db.raw.query(
      'UPDATE webhook_events SET status = $3 WHERE provider = $1 AND provider_event_id = $2',
      [provider, providerEventId, status],
    );
  }
}

interface SubEvRow {
  id: string;
  subscription_id: string;
  user_id: string;
  type: string;
  from_status: string | null;
  to_status: string | null;
  meta: Record<string, unknown>;
  created_at: Date;
}

@Injectable()
export class PgSubscriptionEventRepository implements SubscriptionEventRepository {
  constructor(private readonly db: Db) {}

  async append(e: SubscriptionEventInput): Promise<void> {
    await this.db.raw.query(
      `INSERT INTO subscription_events
        (subscription_id, user_id, type, from_status, to_status, meta)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [e.subscriptionId, e.userId, e.type, e.fromStatus, e.toStatus, JSON.stringify(e.meta)],
    );
  }

  async listBySubscription(
    subscriptionId: string,
    limit: number,
  ): Promise<SubscriptionEventRow[]> {
    const lim = Math.min(Math.max(Math.trunc(limit) || 50, 1), 100);
    const r = await this.db.raw.query(
      `SELECT * FROM subscription_events WHERE subscription_id = $1
       ORDER BY created_at DESC LIMIT ${lim}`,
      [subscriptionId],
    );
    return (r.rows as SubEvRow[]).map((w) => ({
      id: w.id,
      subscriptionId: w.subscription_id,
      userId: w.user_id,
      type: w.type,
      fromStatus: w.from_status,
      toStatus: w.to_status,
      meta: asJson<Record<string, unknown>>(w.meta, {}),
      createdAt: asDate(w.created_at),
    }));
  }
}
