// Entidad Payment: cobro único del proveedor (sin datos de tarjeta).
// pending → succeeded | failed; succeeded → refunded. Sin más salidas.

export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'refunded';

export interface PaymentProps {
  id: string;
  userId: string;
  subscriptionId: string | null;
  provider: string;
  providerPaymentId: string;
  planCode: string;
  amountMinor: number;
  currency: string;
  status: PaymentStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewPaymentProps {
  userId: string;
  subscriptionId: string | null;
  provider: string;
  providerPaymentId: string;
  planCode: string;
  amountMinor: number;
  currency: string;
  now: Date;
}

export class Payment {
  private constructor(private p: PaymentProps) {}

  static startPending(n: NewPaymentProps, id: string): Payment {
    if (!Number.isInteger(n.amountMinor) || n.amountMinor <= 0) {
      throw new Error('monto inválido para checkout');
    }
    return new Payment({
      id,
      userId: n.userId,
      subscriptionId: n.subscriptionId,
      provider: n.provider,
      providerPaymentId: n.providerPaymentId,
      planCode: n.planCode,
      amountMinor: n.amountMinor,
      currency: n.currency,
      status: 'pending',
      createdAt: n.now,
      updatedAt: n.now,
    });
  }

  static rehydrate(p: PaymentProps): Payment {
    return new Payment({ ...p });
  }

  get snapshot(): PaymentProps {
    return { ...this.p };
  }

  /** Intenta marcar éxito; false si ya estaba en estado final (stale/dup). */
  tryMarkSucceeded(now: Date): boolean {
    if (this.p.status !== 'pending') return false;
    this.p.status = 'succeeded';
    this.p.updatedAt = now;
    return true;
  }

  tryMarkFailed(now: Date): boolean {
    if (this.p.status !== 'pending') return false;
    this.p.status = 'failed';
    this.p.updatedAt = now;
    return true;
  }

  tryMarkRefunded(now: Date): boolean {
    if (this.p.status !== 'succeeded') return false;
    this.p.status = 'refunded';
    this.p.updatedAt = now;
    return true;
  }
}
