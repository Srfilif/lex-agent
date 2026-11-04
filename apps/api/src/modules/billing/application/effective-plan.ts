// Plan efectivo: suscripción viva que cubra hoy, o free por defecto.
// Punto único de resolución (los demás casos de uso lo consumen).
import { Inject, Injectable } from '@nestjs/common';
import { Entitlements, FREE_PLAN_CODE, Plan } from '../domain/plan';
import {
  PLAN_REPOSITORY,
  PlanRepository,
  SUBSCRIPTION_EVENT_REPOSITORY,
  SUBSCRIPTION_REPOSITORY,
  SubscriptionEventRepository,
  SubscriptionRepository,
} from '../domain/repositories';
import { Subscription } from '../domain/subscription';

export interface EffectivePlan {
  plan: Plan;
  entitlements: Entitlements;
  subscription: Subscription | null;
  isFreeDefault: boolean;
}

@Injectable()
export class EffectivePlanResolver {
  constructor(
    @Inject(PLAN_REPOSITORY) private readonly plans: PlanRepository,
    @Inject(SUBSCRIPTION_REPOSITORY) private readonly subs: SubscriptionRepository,
    @Inject(SUBSCRIPTION_EVENT_REPOSITORY) private readonly subEvents: SubscriptionEventRepository,
  ) {}

  async resolve(userId: string, now: Date): Promise<EffectivePlan> {
    const sub = await this.subs.findLiveByUser(userId);
    if (sub?.covers(now)) {
      const found = await this.plans.findByCode(sub.snapshot.planCode);
      if (found && found.plan.active) {
        return { plan: found.plan, entitlements: found.entitlements, subscription: sub, isFreeDefault: false };
      }
    }
    if (sub && sub.isLive && !sub.covers(now)) {
      // Expiración lazy (sin scheduler): periodo vencido → expired + evento.
      const from = sub.moveTo('expired', now);
      await this.subs.save(sub);
      await this.subEvents.append({
        subscriptionId: sub.snapshot.id,
        userId,
        type: 'expiracion',
        fromStatus: from,
        toStatus: 'expired',
        meta: { lazy: true },
      });
    }
    const free = await this.plans.findByCode(FREE_PLAN_CODE);
    if (!free) throw new Error('plan free ausente en catálogo');
    return { plan: free.plan, entitlements: free.entitlements, subscription: sub, isFreeDefault: true };
  }
}
