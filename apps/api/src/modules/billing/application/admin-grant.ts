// Concesión manual de plan (admin). La Fase F añade checkout/pagos;
// este endpoint queda como concesión/manual override auditado.
import { Inject, Injectable } from '@nestjs/common';
import {
  noEncontrado,
  operacionNoPermitida,
  RequestMeta,
  SECURITY_EVENT_REPOSITORY,
  SecurityEventRepository,
  USER_REPOSITORY,
  UserRepository,
} from '../../identity';
import { PLAN_REPOSITORY, PlanRepository, SUBSCRIPTION_REPOSITORY, SubscriptionRepository } from '../domain/repositories';

@Injectable()
export class AdminGrantPlan {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PLAN_REPOSITORY) private readonly plans: PlanRepository,
    @Inject(SUBSCRIPTION_REPOSITORY) private readonly subs: SubscriptionRepository,
    @Inject(SECURITY_EVENT_REPOSITORY) private readonly events: SecurityEventRepository,
  ) {}

  async execute(
    adminId: string,
    input: { userId: string; plan: string; days: number },
    meta: RequestMeta,
  ): Promise<Record<string, unknown>> {
    if (!Number.isInteger(input.days) || input.days < 1 || input.days > 365) {
      throw operacionNoPermitida('days debe ser 1-365');
    }
    const user = await this.users.findById(input.userId);
    if (!user) throw noEncontrado('cuenta no encontrada');
    const found = await this.plans.findByCode(input.plan);
    if (!found || !found.plan.active) throw noEncontrado('plan no encontrado o inactivo');
    const now = new Date();
    const sub = await this.subs.grant(
      user.id,
      found.plan.code,
      new Date(now.getTime() + input.days * 86400 * 1000),
      now,
    );
    const p = sub.snapshot;
    await this.events.record({
      userId: user.id,
      type: 'billing_grant',
      success: true,
      ip: meta.ip,
      userAgent: meta.userAgent,
      meta: { admin: adminId, plan: p.planCode, days: input.days },
    });
    return {
      plan: p.planCode,
      status: p.status,
      current_period_end: p.periodEnd.toISOString(),
    };
  }
}
