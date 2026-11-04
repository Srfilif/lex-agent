// Coste de inferencia por millón de tokens (ver MODEL_EVALUATION.md R1).
// Kernel compartido: lo usan el agente (investigación) y el verificador (juez).

export const USD_IN = 1.25 / 1e6;
export const USD_OUT = 4.25 / 1e6;

/**
 * B7: tarifa por modelo. Solo spark-1.3 está medida (R1); wonder-1.0 y
 * spark-1.2 heredan la misma tarifa HASTA calibrar (ver MODEL_EVALUATION).
 * Desconocido → tarifa base (nunca costo 0 silencioso).
 */
const MODEL_RATES: Record<string, { in: number; out: number }> = {
  'muse-spark-1.3': { in: USD_IN, out: USD_OUT },
  'muse-wonder-1.0': { in: USD_IN, out: USD_OUT },
  'muse-spark-1.2': { in: USD_IN, out: USD_OUT },
};

export interface UsoTokens {
  prompt: number;
  completion: number;
  total: number;
}

export function costoTokens(usage: UsoTokens, model?: string): number {
  const r = (model && MODEL_RATES[model]) || { in: USD_IN, out: USD_OUT };
  return usage.prompt * r.in + usage.completion * r.out;
}
