// Dominio billing: planes y entitlements como datos (nunca condicionales).
// Claves contratadas: investigaciones_mes, tokens_mes, max_pasos, modelos.

export const FREE_PLAN_CODE = 'free';

export interface Plan {
  code: string;
  name: string;
  description: string;
  active: boolean;
  version: number;
  /** Precio sandbox en unidades menores; null = gratis (sin checkout). */
  priceMinor: number | null;
  currency: string;
}

export type Entitlements = Record<string, string>;

export function intEntitlement(e: Entitlements, key: string, def: number): number {
  const n = Number.parseInt(e[key] ?? '', 10);
  return Number.isFinite(n) && n >= 0 ? n : def;
}

export function modelosPermitidos(e: Entitlements): string[] {
  return (e['modelos'] ?? '')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
}
