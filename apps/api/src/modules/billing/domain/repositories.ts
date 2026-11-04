// Puertos de persistencia de billing.
import { Entitlements, Plan } from './plan';
import { NewPaymentProps, Payment } from './payment';
import { Subscription } from './subscription';
import { PeriodUsage, UsageEventProps } from './usage';

export const PLAN_REPOSITORY = Symbol('PLAN_REPOSITORY');
export const SUBSCRIPTION_REPOSITORY = Symbol('SUBSCRIPTION_REPOSITORY');
export const USAGE_REPOSITORY = Symbol('USAGE_REPOSITORY');
export const PAYMENT_REPOSITORY = Symbol('PAYMENT_REPOSITORY');
export const WEBHOOK_REPOSITORY = Symbol('WEBHOOK_REPOSITORY');
export const SUBSCRIPTION_EVENT_REPOSITORY = Symbol('SUBSCRIPTION_EVENT_REPOSITORY');

export interface PlanRepository {
  listActive(): Promise<Array<{ plan: Plan; entitlements: Entitlements }>>;
  findByCode(code: string): Promise<{ plan: Plan; entitlements: Entitlements } | null>;
}

export interface SubscriptionRepository {
  findLiveByUser(userId: string): Promise<Subscription | null>;
  /** Concede plan (cancela la viva anterior). Invariante: 1 viva/usuario. */
  grant(userId: string, planCode: string, until: Date, now: Date): Promise<Subscription>;
  save(s: Subscription): Promise<void>;
}

export type ConsumeResult =
  | { outcome: 'ok' }
  | { outcome: 'duplicado' }
  | { outcome: 'cuota_investigaciones' }
  | { outcome: 'cuota_tokens' };

export interface UsageRepository {
  /**
   * Descuento atómico: inserta el evento (idempotente) y suma contadores
   * solo si caben en las cuotas. Todo en una transacción.
   */
  consume(
    event: UsageEventProps,
    period: string,
    quotaInv: number,
    quotaTokens: number,
    invUnits: number,
    tokenUnits: number,
  ): Promise<ConsumeResult>;
  /** Registro sin compuerta (post-vuelo): suma e inserta idempotente. */
  record(event: UsageEventProps, period: string): Promise<'ok' | 'duplicado'>;
  periodUsage(userId: string, period: string): Promise<PeriodUsage>;
}

export interface PaymentRepository {
  insertPending(n: NewPaymentProps): Promise<Payment>;
  findByProviderId(provider: string, providerPaymentId: string): Promise<Payment | null>;
  save(p: Payment): Promise<void>;
  listByUser(userId: string, limit: number): Promise<Payment[]>;
}

export type WebhookStatus = 'processed' | 'ignored' | 'failed';

export interface WebhookRepository {
  /** Inserta o detecta duplicado por (provider, event_id). */
  tryInsert(
    provider: string,
    providerEventId: string,
    type: string,
    payload: Record<string, unknown>,
  ): Promise<'insertado' | 'duplicado'>;
  markStatus(provider: string, providerEventId: string, status: WebhookStatus): Promise<void>;
}

export interface SubscriptionEventInput {
  subscriptionId: string;
  userId: string;
  type: string;
  fromStatus: string | null;
  toStatus: string | null;
  meta: Record<string, unknown>;
}

export interface SubscriptionEventRow extends SubscriptionEventInput {
  id: string;
  createdAt: Date;
}

export interface SubscriptionEventRepository {
  append(e: SubscriptionEventInput): Promise<void>;
  listBySubscription(subscriptionId: string, limit: number): Promise<SubscriptionEventRow[]>;
}
