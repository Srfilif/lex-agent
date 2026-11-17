// Adaptador sandbox del puerto PaymentProvider (Fase F).
// Firma HMAC-SHA256 propia (hex) sobre el cuerpo crudo — NO es la firma real
// de Wompi; el adaptador Wompi futuro implementa el mismo puerto.
// Sin red ni credenciales: los webhooks se emiten vía el simulador.
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import {
  CheckoutRequest,
  CheckoutResult,
  PaymentProvider,
  ProviderEvent,
  ProviderEventType,
} from '../../application/ports';
import { eventoMalformado } from '../../application/errors';


function isEventType(v: unknown): v is ProviderEventType {
  return v === 'payment.succeeded' || v === 'payment.failed' || v === 'refund.succeeded';
}

export class SandboxPaymentProvider implements PaymentProvider {
  readonly name = 'sandbox';
  readonly signatureHeader = 'x-sandbox-signature';

  constructor(private readonly webhookSecret: string) {}

  async createCheckout(r: CheckoutRequest): Promise<CheckoutResult> {
    if (!Number.isInteger(r.amountMinor) || r.amountMinor <= 0) {
      throw new Error('monto inválido para checkout');
    }
    if (!/^[A-Z]{3}$/.test(r.currency)) throw new Error('moneda inválida para checkout');
    const providerPaymentId = `pay_sandbox_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
    return {
      providerPaymentId,
      checkoutUrl: `/billing/sandbox/checkouts/${providerPaymentId}`,
      amountMinor: r.amountMinor,
      currency: r.currency,
    };
  }

  sign(rawBody: Buffer): string {
    return createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex');
  }

  verifyWebhook(rawBody: Buffer, signature: string): boolean {
    if (!/^[0-9a-f]{64}$/.test(signature)) return false;
    const a = Buffer.from(signature, 'hex');
    const b = Buffer.from(this.sign(rawBody), 'hex');
    return a.length === b.length && timingSafeEqual(a, b);
  }

  parseEvent(payload: unknown): ProviderEvent {
    const p = payload as Record<string, unknown>;
    const data = p?.data as Record<string, unknown> | undefined;
    const meta = p?.metadata as Record<string, unknown> | undefined;
    const occurred = typeof p?.occurred_at === 'string' ? new Date(p.occurred_at) : null;
    if (
      typeof p?.id !== 'string' ||
      !isEventType(p?.type) ||
      typeof data?.payment_id !== 'string' ||
      !Number.isInteger(data?.amount_minor) ||
      typeof data?.currency !== 'string' ||
      !occurred ||
      Number.isNaN(occurred.getTime()) ||
      typeof meta?.user_id !== 'string' ||
      typeof meta?.plan_code !== 'string'
    ) {
      throw eventoMalformado();
    }
    return {
      providerEventId: p.id as string,
      type: p.type as ProviderEventType,
      providerPaymentId: data.payment_id as string,
      amountMinor: data.amount_minor as number,
      currency: data.currency as string,
      occurredAt: occurred,
      metadata: { userId: meta.user_id as string, planCode: meta.plan_code as string },
    };
  }

  /** Construye el payload firmado de un evento (lo usa el simulador). */
  buildEvent(
    type: ProviderEventType,
    args: {
      providerPaymentId: string;
      amountMinor: number;
      currency: string;
      userId: string;
      planCode: string;
    },
  ): { payload: Record<string, unknown>; signature: string } {
    const payload: Record<string, unknown> = {
      id: `evt_sandbox_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
      type,
      occurred_at: new Date().toISOString(),
      data: {
        payment_id: args.providerPaymentId,
        amount_minor: args.amountMinor,
        currency: args.currency,
      },
      metadata: { user_id: args.userId, plan_code: args.planCode },
    };
    const raw = Buffer.from(JSON.stringify(payload), 'utf8');
    return { payload, signature: this.sign(raw) };
  }
}
