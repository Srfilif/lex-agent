// Casos de uso de lectura: planes, suscripción, uso y entitlements.
import { Inject, Injectable } from '@nestjs/common';
import { intEntitlement, modelosPermitidos } from '../domain/plan';
import {
  PLAN_REPOSITORY,
  PlanRepository,
  USAGE_REPOSITORY,
  UsageRepository,
} from '../domain/repositories';
import { nextReset, periodKey } from '../domain/usage';
import { EffectivePlanResolver } from './effective-plan';

@Injectable()
export class GetPlans {
  constructor(@Inject(PLAN_REPOSITORY) private readonly plans: PlanRepository) {}

  async execute(): Promise<Record<string, unknown>> {
    const list = await this.plans.listActive();
    return {
      plans: list.map(({ plan, entitlements }) => ({
        code: plan.code,
        name: plan.name,
        description: plan.description,
        version: plan.version,
        price_minor: plan.priceMinor,
        currency: plan.currency,
        limites: {
          investigaciones_mes: intEntitlement(entitlements, 'investigaciones_mes', 0),
          tokens_mes: intEntitlement(entitlements, 'tokens_mes', 0),
          max_pasos: intEntitlement(entitlements, 'max_pasos', 6),
          modelos: modelosPermitidos(entitlements),
        },
      })),
    };
  }
}

@Injectable()
export class GetSubscriptionStatus {
  constructor(private readonly effective: EffectivePlanResolver) {}

  async execute(userId: string): Promise<Record<string, unknown>> {
    const now = new Date();
    const e = await this.effective.resolve(userId, now);
    const s = e.subscription?.snapshot;
    return {
      plan: e.plan.code,
      plan_name: e.plan.name,
      status: s && !e.isFreeDefault ? s.status : 'free',
      current_period_end: s && !e.isFreeDefault ? s.periodEnd.toISOString() : null,
      cancel_at_period_end: s?.cancelAtPeriodEnd ?? false,
    };
  }
}

@Injectable()
export class GetUsage {
  constructor(
    private readonly effective: EffectivePlanResolver,
    @Inject(USAGE_REPOSITORY) private readonly usage: UsageRepository,
  ) {}

  async execute(userId: string): Promise<Record<string, unknown>> {
    const now = new Date();
    const e = await this.effective.resolve(userId, now);
    const period = periodKey(now);
    const used = await this.usage.periodUsage(userId, period);
    const limInv = intEntitlement(e.entitlements, 'investigaciones_mes', 0);
    const limTok = intEntitlement(e.entitlements, 'tokens_mes', 0);
    return {
      plan: e.plan.code,
      period,
      reset_at: nextReset(now).toISOString(),
      investigaciones: {
        used: used.investigations,
        limit: limInv,
        remaining: Math.max(0, limInv - used.investigations),
      },
      tokens: {
        used: used.tokens,
        limit: limTok,
        remaining: Math.max(0, limTok - used.tokens),
      },
    };
  }
}

@Injectable()
export class GetEntitlements {
  constructor(
    private readonly effective: EffectivePlanResolver,
    @Inject(USAGE_REPOSITORY) private readonly usage: UsageRepository,
  ) {}

  async execute(userId: string): Promise<Record<string, unknown>> {
    const now = new Date();
    const e = await this.effective.resolve(userId, now);
    const used = await this.usage.periodUsage(userId, periodKey(now));
    const limInv = intEntitlement(e.entitlements, 'investigaciones_mes', 0);
    const limTok = intEntitlement(e.entitlements, 'tokens_mes', 0);
    return {
      plan: e.plan.code,
      puede_investigar: used.investigations < limInv && used.tokens < limTok,
      max_pasos: intEntitlement(e.entitlements, 'max_pasos', 6),
      modelos: modelosPermitidos(e.entitlements),
      investigaciones_restantes: Math.max(0, limInv - used.investigations),
      tokens_restantes: Math.max(0, limTok - used.tokens),
    };
  }
}
