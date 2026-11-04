// Entidad Subscription: máquina de estados mínima (Fase E).
// trialing/active/past_due = viva; cancel_at_period_end ≠ fin inmediato;
// canceled/expired = terminada. La Fase F añade pagos sobre estos estados.

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired';

const LIVE: SubscriptionStatus[] = ['trialing', 'active', 'past_due'];

/** Máquina de estados (Fase F): transiciones permitidas. Terminales: sin salida. */
const TRANSITIONS: Record<SubscriptionStatus, SubscriptionStatus[]> = {
  trialing: ['active', 'canceled', 'expired'],
  active: ['past_due', 'canceled', 'expired'],
  past_due: ['active', 'canceled', 'expired'],
  canceled: [],
  expired: [],
};

export interface SubscriptionProps {
  id: string;
  userId: string;
  planCode: string;
  status: SubscriptionStatus;
  periodStart: Date;
  periodEnd: Date;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class Subscription {
  private constructor(private p: SubscriptionProps) {}

  static rehydrate(p: SubscriptionProps): Subscription {
    return new Subscription({ ...p });
  }

  get snapshot(): SubscriptionProps {
    return { ...this.p };
  }

  get isLive(): boolean {
    return LIVE.includes(this.p.status);
  }

  /** Cubre `now` si está viva y dentro del periodo. */
  covers(now: Date): boolean {
    return (
      this.isLive &&
      this.p.periodStart.getTime() <= now.getTime() &&
      now.getTime() < this.p.periodEnd.getTime()
    );
  }

  /** Cancelar renovación: mantiene acceso hasta fin de periodo. */
  scheduleCancel(now: Date): void {
    if (!this.isLive) return;
    this.p.cancelAtPeriodEnd = true;
    this.p.updatedAt = now;
  }

  undoScheduleCancel(now: Date): void {
    this.p.cancelAtPeriodEnd = false;
    this.p.updatedAt = now;
  }

  markCanceled(now: Date): void {
    this.p.status = 'canceled';
    this.p.updatedAt = now;
  }

  markExpired(now: Date): void {
    if (!this.isLive) return;
    this.p.status = 'expired';
    this.p.updatedAt = now;
  }

  canTransitionTo(to: SubscriptionStatus): boolean {
    return TRANSITIONS[this.p.status].includes(to);
  }

  /**
   * Transición guardada. La aplicación verifica canTransitionTo antes y
   * traduce el rechazo a 400; aquí un salto inválido es error de programa.
   */
  moveTo(to: SubscriptionStatus, now: Date): SubscriptionStatus {
    if (!this.canTransitionTo(to)) {
      throw new Error(`transición inválida ${this.p.status} → ${to}`);
    }
    const from = this.p.status;
    this.p.status = to;
    this.p.updatedAt = now;
    return from;
  }
}
