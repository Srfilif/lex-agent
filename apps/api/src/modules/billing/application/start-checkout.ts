// Inicio de checkout: crea el cobro pendiente en el proveedor.
// La suscripción SOLO se activa con webhook verificado (nunca por retorno).
import { Inject, Injectable } from '@nestjs/common';
import {
  RequestMeta,
  SECURITY_EVENT_REPOSITORY,
  SecurityEventRepository,
  USER_REPOSITORY,
  UserRepository,
  noEncontrado,
} from '../../identity';
import {
  PAYMENT_REPOSITORY,
  PLAN_REPOSITORY,
  PaymentRepository,
  PlanRepository,
  SUBSCRIPTION_REPOSITORY,
  SubscriptionRepository,
} from '../domain/repositories';
import { PAYMENT_PROVIDER, PaymentProvider } from './ports';
import { pagoInvalido } from './errors';

@Injectable()
export class StartCheckout {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PLAN_REPOSITORY) private readonly plans: PlanRepository,
    @Inject(PAYMENT_REPOSITORY) private readonly payments: PaymentRepository,
    @Inject(SUBSCRIPTION_REPOSITORY) private readonly subs: SubscriptionRepository,
    @Inject(SECURITY_EVENT_REPOSITORY) private readonly events: SecurityEventRepository,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
  ) {}

  async execute(
    userId: string,
    planCode: string,
    meta: RequestMeta,
  ): Promise<Record<string, unknown>> {
    const user = await this.users.findById(userId);
    if (!user || !user.canAuthenticate()) throw noEncontrado('cuenta no encontrada');
    const found = await this.plans.findByCode(planCode);
    if (!found || !found.plan.active) throw noEncontrado('plan no encontrado o inactivo');
    const { plan } = found;
    if (plan.priceMinor === null) {
      throw pagoInvalido('el plan free no requiere pago');
    }
    const live = await this.subs.findLiveByUser(userId);
    const now = new Date();
    const co = await this.provider.createCheckout({
      userId,
      planCode: plan.code,
      amountMinor: plan.priceMinor,
      currency: plan.currency,
    });
    // El precio lo fija el servidor (catálogo), jamás el cliente.
    if (co.amountMinor !== plan.priceMinor || co.currency !== plan.currency) {
      throw pagoInvalido('monto del proveedor no coincide con el catálogo');
    }
    const payment = await this.payments.insertPending({
      userId,
      subscriptionId: live?.snapshot.id ?? null,
      provider: this.provider.name,
      providerPaymentId: co.providerPaymentId,
      planCode: plan.code,
      amountMinor: co.amountMinor,
      currency: co.currency,
      now,
    });
    const p = payment.snapshot;
    await this.events.record({
      userId,
      type: 'billing_checkout',
      success: true,
      ip: meta.ip,
      userAgent: meta.userAgent,
      meta: { plan: plan.code, payment: p.id },
    });
    return {
      checkout_id: p.providerPaymentId,
      checkout_url: co.checkoutUrl,
      plan: plan.code,
      amount_minor: p.amountMinor,
      currency: p.currency,
    };
  }
}
