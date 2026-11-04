// Entidad TotpConfig: enrolamiento en 2 estados + anti-replay.
// pending → active solo tras verificar un código (confirm). El secreto vive
// cifrado (infra); aquí solo viaja opaco.
import { DomainError } from './errors';

export type TotpStatus = 'pending' | 'active';

export interface TotpProps {
  userId: string;
  secretEnc: string;
  status: TotpStatus;
  lastCounter: number;
  createdAt: Date;
  confirmedAt: Date | null;
}

export class TotpConfig {
  private constructor(private p: TotpProps) {}

  static startPending(userId: string, secretEnc: string, now: Date): TotpConfig {
    return new TotpConfig({
      userId,
      secretEnc,
      status: 'pending',
      lastCounter: -1,
      createdAt: now,
      confirmedAt: null,
    });
  }

  static rehydrate(p: TotpProps): TotpConfig {
    return new TotpConfig({ ...p });
  }

  get snapshot(): TotpProps {
    return { ...this.p };
  }

  get isActive(): boolean {
    return this.p.status === 'active';
  }

  /** Activa tras una verificación válida; rechaza contadores reutilizados. */
  confirm(counter: number, now: Date): void {
    if (counter <= this.p.lastCounter) {
      throw new DomainError('totp_reutilizado', 'código ya utilizado; espere uno nuevo');
    }
    this.p.status = 'active';
    this.p.lastCounter = counter;
    this.p.confirmedAt = now;
  }

  /** Marca un contador como consumido (login/operaciones). */
  consumeCounter(counter: number): void {
    if (!this.isActive) throw new DomainError('totp_inactivo', '2FA no está activado');
    if (counter <= this.p.lastCounter) {
      throw new DomainError('totp_reutilizado', 'código ya utilizado; espere uno nuevo');
    }
    this.p.lastCounter = counter;
  }
}

/** Normaliza un código de recuperación ("abcd-1234" → "ABCD1234"). */
export function normalizeRecoveryCode(v: unknown): string {
  if (typeof v !== 'string') throw new DomainError('codigo_invalido', 'código inválido');
  const n = v.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (n.length !== 8) throw new DomainError('codigo_invalido', 'código inválido');
  return n;
}
