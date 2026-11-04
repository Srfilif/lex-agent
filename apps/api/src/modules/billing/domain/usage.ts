// Medición de uso: eventos idempotentes + periodos mensuales (UTC).

export type UsageKind =
  | 'investigacion'
  | 'investigacion_tokens'
  | 'verificacion'
  | 'chat'
  | 'titulo'
  | 'sugerencias'
  | 'abstencion';

export interface UsageEventProps {
  userId: string;
  kind: UsageKind;
  units: number;
  tokensIn: number;
  tokensOut: number;
  costUsd: number | null;
  idempotencyKey: string;
  refType: string | null;
  refId: string | null;
}

export interface PeriodUsage {
  period: string;
  investigations: number;
  tokens: number;
}

/** Clave de periodo mensual UTC: 'YYYY-MM'. */
export function periodKey(now: Date): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** Próximo reset: día 1 del mes siguiente, 00:00 UTC. */
export function nextReset(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}
