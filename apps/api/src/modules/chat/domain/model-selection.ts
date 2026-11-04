// B7: selección de modelo de chat (puro, unit-testeable).
// Orden del plan = defecto (primero) + cadena de fallback (resto).
// El catálogo (config) filtra: un plan jamás concede un modelo no verificado.

export interface ModelSelection {
  model: string;
  fallbacks: string[];
}

export type SelectionFailure = 'sin_modelos' | 'no_permitido';

export type SelectionResult =
  | { ok: true; selection: ModelSelection }
  | { ok: false; reason: SelectionFailure };

export function resolveModel(
  requested: string | null | undefined,
  permitidos: string[],
  catalogo: string[],
): SelectionResult {
  const cat = new Set(catalogo);
  const candidatos = [...new Set(permitidos.filter((m) => cat.has(m)))];
  if (!candidatos.length) return { ok: false, reason: 'sin_modelos' };
  if (requested) {
    if (!candidatos.includes(requested)) return { ok: false, reason: 'no_permitido' };
    return {
      ok: true,
      selection: { model: requested, fallbacks: candidatos.filter((m) => m !== requested) },
    };
  }
  const [model, ...fallbacks] = candidatos as [string, ...string[]];
  return { ok: true, selection: { model, fallbacks } };
}
