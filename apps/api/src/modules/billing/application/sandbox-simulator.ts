// Simulador sandbox: emite payloads webhook firmados para un cobro pendiente.
// Solo URL-capability (id impredicible) y solo con provider=sandbox (403 si no).
// No aplica nada: el llamador POSTea el payload a /billing/webhooks/sandbox,
// ejercitando firma + idempotencia + máquina reales.
import { Inject, Injectable } from '@nestjs/common';
import { AppConfig, CONFIG } from '../../../shared/config';
import { noEncontrado, operacionNoPermitida } from '../../identity';
import {
  PAYMENT_REPOSITORY,
  PaymentRepository,
} from '../domain/repositories';
import { PAYMENT_PROVIDER, PaymentProvider, SandboxEventBuilder } from './ports';

@Injectable()
export class SandboxSimulator {
  constructor(
    @Inject(PAYMENT_REPOSITORY) private readonly payments: PaymentRepository,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider & SandboxEventBuilder,
    @Inject(CONFIG) private readonly cfg: AppConfig,
  ) {}

  private guard(): void {
    if (this.cfg.billing.provider !== 'sandbox') {
      throw operacionNoPermitida('simulador disponible solo con provider=sandbox');
    }
  }

  async describe(providerPaymentId: string): Promise<Record<string, unknown>> {
    this.guard();
    const p = await this.payments.findByProviderId('sandbox', providerPaymentId);
    if (!p) throw noEncontrado('cobro no encontrado');
    const s = p.snapshot;
    return {
      checkout_id: s.providerPaymentId,
      plan: s.planCode,
      amount_minor: s.amountMinor,
      currency: s.currency,
      status: s.status,
      approve_url: `/billing/sandbox/checkouts/${s.providerPaymentId}/approve`,
      decline_url: `/billing/sandbox/checkouts/${s.providerPaymentId}/decline`,
    };
  }

  async decide(
    providerPaymentId: string,
    approve: boolean,
  ): Promise<Record<string, unknown>> {
    this.guard();
    const p = await this.payments.findByProviderId('sandbox', providerPaymentId);
    if (!p) throw noEncontrado('cobro no encontrado');
    const s = p.snapshot;
    if (s.status !== 'pending') {
      throw operacionNoPermitida(`el cobro ya está ${s.status}`);
    }
    const { payload, signature } = this.provider.buildEvent(
      approve ? 'payment.succeeded' : 'payment.failed',
      {
        providerPaymentId: s.providerPaymentId,
        amountMinor: s.amountMinor,
        currency: s.currency,
        userId: s.userId,
        planCode: s.planCode,
      },
    );
    return {
      webhook_url: '/billing/webhooks/sandbox',
      signature_header: 'x-sandbox-signature',
      signature,
      payload,
    };
  }
}
