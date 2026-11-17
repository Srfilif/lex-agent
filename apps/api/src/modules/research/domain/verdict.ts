// Reglas de veredicto por afirmación (ver CITATION_VERIFICATION.md). Puras.

export type Soporte = 'si' | 'parcial' | 'no' | 'na';
export type Veredicto =
  | 'verificada'
  | 'parcial'
  | 'no_verificada'
  | 'sin_respaldo'
  | 'cita_inventada';

export interface Juicio {
  idx: number;
  soporte: 'si' | 'parcial' | 'no' | 'na';
  motivo: string;
}

export interface VeredictoAfirm {
  idx: number;
  texto: string;
  chunk_ids: string[];
  secop_refs: string[];
  existencia: boolean;
  secop_ok: boolean;
  soporte: Juicio['soporte'];
  motivo_soporte: string;
  veredicto: Veredicto;
}

export interface VerificationResult {
  afirmaciones: VeredictoAfirm[];
  citas_inventadas: number;
  resumen: Record<string, number>;
  juez: {
    usage: { prompt: number; completion: number; total: number };
    costo_usd: number;
  };
}

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
