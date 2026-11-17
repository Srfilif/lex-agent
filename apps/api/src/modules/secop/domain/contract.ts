// Modelo de lectura de contratos SECOP. Sin SQL ni framework.

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
  modalidad_de_contratacion?: unknown;
  dias_adicionados?: unknown;
  valor_del_contrato?: unknown;
  valor_facturado?: unknown;
  enlace_origen: string;
  senales: Array<{ regla: string; detalle: string }>;
}

export interface ResultadoContratos {
  contratos: ContratoResumido[];
  fecha_consulta: string;
  modo: string;
  dataset: string;
}
