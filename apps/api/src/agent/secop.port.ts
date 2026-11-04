// Puerto: lo que el agente necesita de SECOP (definido por el consumidor).
// Implementado por SecopService vía useExisting (sin wrapper ni proxy).

export const CONSULTAR_CONTRATOS = Symbol('CONSULTAR_CONTRATOS');

export interface FiltrosContratos {
  entidad?: string;
  proveedor?: string;
  objeto?: string;
  valorMin?: number;
  valorMax?: number;
  modalidad?: string;
  estado?: string;
  anio?: number;
  limit?: number;
}

export interface ContratoResumido {
  [k: string]: unknown;
  enlace_origen: string;
  senales: Array<{ regla: string; detalle: string }>;
}

export interface ConsultarContratos {
  contratos(f: FiltrosContratos): Promise<{
    contratos: ContratoResumido[];
    fecha_consulta: string;
    modo: string;
    dataset: string;
  }>;
}
