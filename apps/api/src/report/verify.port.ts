// Puerto: lo que el informe necesita del verificador (definido por el consumidor).
// Implementado por VerifierService vía useExisting.

export const VERIFICAR_INVESTIGACION = Symbol('VERIFICAR_INVESTIGACION');

export interface VeredictoAfirmacion {
  idx: number;
  texto: string;
  chunk_ids: string[];
  secop_refs: string[];
  veredicto: string;
  motivo_soporte: string;
}

export interface UsoJuez {
  usage: { prompt: number; completion: number; total: number };
  costo_usd: number;
}

export interface VerificarInvestigacion {
  verificar(investigacionId: string): Promise<{
    afirmaciones: VeredictoAfirmacion[];
    citas_inventadas: number;
    resumen: Record<string, number>;
    juez: UsoJuez;
  }>;
}
