// Regla de veredicto por afirmación (ver CITATION_VERIFICATION.md). Pura.

export type Soporte = 'si' | 'parcial' | 'no' | 'na';
export type Veredicto =
  | 'verificada'
  | 'parcial'
  | 'no_verificada'
  | 'sin_respaldo'
  | 'cita_inventada';

export function dictaminar(v: {
  chunk_ids: string[];
  secop_refs: string[];
  existencia: boolean;
  secop_ok: boolean;
  soporte: Soporte;
}): { veredicto: Veredicto; motivo?: string } {
  const citado = v.chunk_ids.length > 0 || v.secop_refs.length > 0;
  if (!citado) return { veredicto: 'sin_respaldo' };
  if (v.chunk_ids.length > 0 && !v.existencia) return { veredicto: 'cita_inventada' };
  if (!v.secop_ok) {
    return { veredicto: 'no_verificada', motivo: 'secop_ref no existe en caché SECOP' };
  }
  if (v.chunk_ids.length === 0) return { veredicto: 'verificada' };
  if (v.soporte === 'si') return { veredicto: 'verificada' };
  if (v.soporte === 'parcial') return { veredicto: 'parcial' };
  return { veredicto: 'no_verificada' };
}
