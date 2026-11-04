// Gestión de suscripción por el titular: cancelar (fin de periodo),
// reanudar, cambiar de plan (inmediato, sin prorrata en sandbox),
// historial de pagos y eventos.
import { Inject, Injectable } from '@nestjs/common';
import {
  RequestMeta,
  SECURITY_EVENT_REPOSITORY,
  SecurityEventRepository,
  noEncontrado,
  operacionNoPermitida,
} from '../../identity';
import {
  PAYMENT_REPOSITORY,
  PLAN_REPOSITORY,
  PaymentRepository,
  PlanRepository,
  SUBSCRIPTION_EVENT_REPOSITORY,
  SUBSCRIPTION_REPOSITORY,
  SubscriptionEventRepository,
  SubscriptionRepository,
} from '../domain/repositories';
import { sinSuscripcion } from './errors';

@Injectable()
export class CancelSubscription {
  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY) private readonly subs: SubscriptionRepository,
    @Inject(SUBSCRIPTION_EVENT_REPOSITORY) private readonly subEvents: SubscriptionEventRepository,
    @Inject(SECURITY_EVENT_REPOSITORY) private readonly events: SecurityEventRepository,
  ) {}

  /** Cancela la renovación; mantiene acceso hasta fin de periodo. */
  async execute(userId: string, meta: RequestMeta): Promise<Record<string, unknown>> {
    const sub = await this.subs.findLiveByUser(userId);
    if (!sub) throw sinSuscripcion();
    const now = new Date();
    sub.scheduleCancel(now);
    await this.subs.save(sub);
    const s = sub.snapshot;
    await this.subEvents.append({
      subscriptionId: s.id,
      userId,
      type: 'cancelacion',
      fromStatus: s.status,
      toStatus: s.status,
      meta: { access_until: s.periodEnd.toISOString() },
    });
    await this.events.record({
      userId,
      type: 'billing_cancelacion',
      success: true,
      ip: meta.ip,
      userAgent: meta.userAgent,
      meta: { plan: s.planCode },
    });
    return { cancel_at_period_end: true, access_until: s.periodEnd.toISOString(), plan: s.planCode };
  }
}

@Injectable()
export class ResumeSubscription {
  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY) private readonly subs: SubscriptionRepository,
    @Inject(SUBSCRIPTION_EVENT_REPOSITORY) private readonly subEvents: SubscriptionEventRepository,
  ) {}

  async execute(userId: string): Promise<Record<string, unknown>> {
    const sub = await this.subs.findLiveByUser(userId);
    if (!sub) throw sinSuscripcion();
    if (!sub.snapshot.cancelAtPeriodEnd) {
      throw operacionNoPermitida('la suscripción no está marcada para cancelar');
    }
    sub.undoScheduleCancel(new Date());
    await this.subs.save(sub);
    await this.subEvents.append({
      subscriptionId: sub.snapshot.id,
      userId,
      type: 'reactivacion',
      fromStatus: sub.snapshot.status,
      toStatus: sub.snapshot.status,
      meta: {},
    });
    return { cancel_at_period_end: false, plan: sub.snapshot.planCode };
  }
}

@Injectable()
export class ChangePlan {
  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY) private readonly subs: SubscriptionRepository,
    @Inject(PLAN_REPOSITORY) private readonly plans: PlanRepository,
    @Inject(SUBSCRIPTION_EVENT_REPOSITORY) private readonly subEvents: SubscriptionEventRepository,
    @Inject(SECURITY_EVENT_REPOSITORY) private readonly events: SecurityEventRepository,
  ) {}

  /**
   * Cambio inmediato con periodo nuevo de 30 días, sin prorrata (sandbox).
   * Requiere suscripción viva de pago; free→pago va por checkout.
   */
  async execute(
    userId: string,
    planCode: string,
    meta: RequestMeta,
  ): Promise<Record<string, unknown>> {
    const found = await this.plans.findByCode(planCode);
    if (!found || !found.plan.active || found.plan.priceMinor === null) {
      throw noEncontrado('plan no encontrado o sin precio');
    }
    const live = await this.subs.findLiveByUser(userId);
    if (!live) throw sinSuscripcion();
    if (live.snapshot.planCode === found.plan.code) {
      throw operacionNoPermitida('ya está en ese plan');
    }
    const now = new Date();
    const from = live.snapshot;
    const sub = await this.subs.grant(
      userId,
      found.plan.code,
      new Date(now.getTime() + 30 * 86400 * 1000),
      now,
    );
    const s = sub.snapshot;
    await this.subEvents.append({
      subscriptionId: s.id,
      userId,
      type: 'cambio_plan',
      fromStatus: `${from.planCode}/${from.status}`,
      toStatus: `${s.planCode}/${s.status}`,
      meta: {},
    });
    await this.events.record({
      userId,
      type: 'billing_cambio_plan',
      success: true,
      ip: meta.ip,
      userAgent: meta.userAgent,
      meta: { de: from.planCode, a: s.planCode },
    });
    return { plan: s.planCode, status: s.status, current_period_end: s.periodEnd.toISOString() };
  }
}

@Injectable()
export class GetPayments {
  constructor(@Inject(PAYMENT_REPOSITORY) private readonly payments: PaymentRepository) {}

  async execute(userId: string): Promise<Record<string, unknown>> {
    const list = await this.payments.listByUser(userId, 50);
    return {
      payments: list.map((p) => {
        const s = p.snapshot;
        return {
          id: s.id,
          plan: s.planCode,
          amount_minor: s.amountMinor,
          currency: s.currency,
          status: s.status,
          provider: s.provider,
          created_at: s.createdAt.toISOString(),
        };
      }),
    };
  }
}

@Injectable()
export class GetSubscriptionHistory {
  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY) private readonly subs: SubscriptionRepository,
    @Inject(SUBSCRIPTION_EVENT_REPOSITORY) private readonly subEvents: SubscriptionEventRepository,
  ) {}

  async execute(userId: string): Promise<Record<string, unknown>> {
    const sub = await this.subs.findLiveByUser(userId);
    if (!sub) throw sinSuscripcion();
    const events = await this.subEvents.listBySubscription(sub.snapshot.id, 50);
    return {
      subscription: sub.snapshot.id,
      plan: sub.snapshot.planCode,
      events: events.map((e) => ({
        type: e.type,
        from: e.fromStatus,
        to: e.toStatus,
        meta: e.meta,
        created_at: e.createdAt.toISOString(),
      })),
    };
  }
}
