// Procesamiento de webhooks: firma → idempotencia → aplicación.
// Reintentos y duplicados son seguros; fuera-de-orden se resuelve por estado.
import { Inject, Injectable } from '@nestjs/common';
import {
  RequestMeta,
  SECURITY_EVENT_REPOSITORY,
  SecurityEventRepository,
  noEncontrado,
} from '../../identity';
import { Payment } from '../domain/payment';
import {
  PAYMENT_REPOSITORY,
  PaymentRepository,
  SUBSCRIPTION_EVENT_REPOSITORY,
  SUBSCRIPTION_REPOSITORY,
  SubscriptionEventRepository,
  SubscriptionRepository,
  WEBHOOK_REPOSITORY,
  WebhookRepository,
} from '../domain/repositories';
import { PAYMENT_PROVIDER, PaymentProvider, ProviderEvent } from './ports';
import { eventoMalformado, firmaWebhookInvalida, pagoInvalido } from './errors';

const PERIOD_DAYS = 30;

@Injectable()
export class HandleWebhook {
  constructor(
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    @Inject(PAYMENT_REPOSITORY) private readonly payments: PaymentRepository,
    @Inject(SUBSCRIPTION_REPOSITORY) private readonly subs: SubscriptionRepository,
    @Inject(WEBHOOK_REPOSITORY) private readonly webhooks: WebhookRepository,
    @Inject(SUBSCRIPTION_EVENT_REPOSITORY) private readonly subEvents: SubscriptionEventRepository,
    @Inject(SECURITY_EVENT_REPOSITORY) private readonly events: SecurityEventRepository,
  ) {}

  async execute(
    provider: string,
    rawBody: Buffer,
    signature: string,
    meta: RequestMeta,
  ): Promise<Record<string, unknown>> {
    if (provider !== this.provider.name) throw noEncontrado('proveedor no configurado');
    if (!signature || !this.provider.verifyWebhook(rawBody, signature)) {
      throw firmaWebhookInvalida();
    }
    let payload: unknown;
    try {
      payload = JSON.parse(rawBody.toString('utf8')) as unknown;
    } catch {
      throw eventoMalformado();
    }
    const event = this.provider.parseEvent(payload);
    const seen = await this.webhooks.tryInsert(
      provider,
      event.providerEventId,
      event.type,
      payload as Record<string, unknown>,
    );
    if (seen === 'duplicado') return { status: 'duplicado' };
    try {
      const out = await this.apply(event, meta);
      await this.webhooks.markStatus(provider, event.providerEventId, 'processed');
      return out;
    } catch (e) {
      await this.webhooks.markStatus(provider, event.providerEventId, 'failed');
      throw e;
    }
  }

  private async apply(event: ProviderEvent, meta: RequestMeta): Promise<Record<string, unknown>> {
    const payment = await this.payments.findByProviderId(
      this.provider.name,
      event.providerPaymentId,
    );
    if (!payment) throw pagoInvalido('pago desconocido para el proveedor');
    const p = payment.snapshot;
    // No confiar en monto/moneda del evento: deben coincidir con lo cobrado.
    if (p.amountMinor !== event.amountMinor || p.currency !== event.currency) {
      throw pagoInvalido('monto o moneda del evento no coincide');
    }
    if (p.userId !== event.metadata.userId || p.planCode !== event.metadata.planCode) {
      throw pagoInvalido('metadatos del evento no coinciden');
    }
    const now = new Date();
    switch (event.type) {
      case 'payment.succeeded':
        return this.onSucceeded(payment, event, now, meta);
      case 'payment.failed':
        return this.onFailed(payment, event, now, meta);
      case 'refund.succeeded':
        return this.onRefunded(payment, event, now, meta);
      default:
        return { status: 'ignorado' };
    }
  }

  private async onSucceeded(
    pay: Payment,
    event: ProviderEvent,
    now: Date,
    meta: RequestMeta,
  ): Promise<Record<string, unknown>> {
    if (!pay.tryMarkSucceeded(now)) return { status: 'ignorado' }; // ya final (stale/dup)
    await this.payments.save(pay);
    const sub = await this.subs.grant(
      pay.snapshot.userId,
      pay.snapshot.planCode,
      new Date(now.getTime() + PERIOD_DAYS * 86400 * 1000),
      now,
    );
    const s = sub.snapshot;
    await this.subEvents.append({
      subscriptionId: s.id,
      userId: s.userId,
      type: 'pago_ok',
      fromStatus: null,
      toStatus: s.status,
      meta: { payment: pay.snapshot.id, provider_event: event.providerEventId },
    });
    await this.events.record({
      userId: s.userId,
      type: 'billing_pago_ok',
      success: true,
      ip: meta.ip,
      userAgent: meta.userAgent,
      meta: { plan: s.planCode },
    });
    return { status: 'ok', subscription: s.id, plan: s.planCode };
  }

  private async onFailed(
    pay: Payment,
    event: ProviderEvent,
    now: Date,
    meta: RequestMeta,
  ): Promise<Record<string, unknown>> {
    if (!pay.tryMarkFailed(now)) return { status: 'ignorado' }; // succeeded gana a failed
    await this.payments.save(pay);
    // Si el cobro aplicaba a una suscripción viva → mora (dunning).
    const subId = pay.snapshot.subscriptionId;
    if (subId) {
      const live = await this.subs.findLiveByUser(pay.snapshot.userId);
      if (live && live.snapshot.id === subId && live.canTransitionTo('past_due')) {
        const from = live.moveTo('past_due', now);
        await this.subs.save(live);
        await this.subEvents.append({
          subscriptionId: subId,
          userId: pay.snapshot.userId,
          type: 'pago_fallo',
          fromStatus: from,
          toStatus: 'past_due',
          meta: { payment: pay.snapshot.id, provider_event: event.providerEventId },
        });
      }
    }
    await this.events.record({
      userId: pay.snapshot.userId,
      type: 'billing_pago_fallo',
      success: false,
      ip: meta.ip,
      userAgent: meta.userAgent,
      meta: { plan: pay.snapshot.planCode },
    });
    return { status: 'ok' };
  }

  private async onRefunded(
    pay: Payment,
    event: ProviderEvent,
    now: Date,
    meta: RequestMeta,
  ): Promise<Record<string, unknown>> {
    if (!pay.tryMarkRefunded(now)) return { status: 'ignorado' };
    await this.payments.save(pay);
    // Acceso hasta fin de periodo (sin corte inmediato); queda auditado.
    const live = await this.subs.findLiveByUser(pay.snapshot.userId);
    if (live) {
      await this.subEvents.append({
        subscriptionId: live.snapshot.id,
        userId: pay.snapshot.userId,
        type: 'reembolso',
        fromStatus: live.snapshot.status,
        toStatus: live.snapshot.status,
        meta: { payment: pay.snapshot.id, provider_event: event.providerEventId },
      });
    }
    await this.events.record({
      userId: pay.snapshot.userId,
      type: 'billing_reembolso',
      success: true,
      ip: meta.ip,
      userAgent: meta.userAgent,
      meta: { plan: pay.snapshot.planCode },
    });
    return { status: 'ok' };
  }
}
