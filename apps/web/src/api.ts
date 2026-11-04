export const API: string =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000';

async function j<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`API ${r.status}: ${t.slice(0, 200) || r.statusText}`);
  }
  return (await r.json()) as T;
}

export interface Investigacion {
  id: string;
  respuesta: { resumen?: string; afirmaciones?: unknown[] };
  costo_usd: number;
  json_valido: boolean;
}

export interface Veredicto {
  idx: number;
  texto: string;
  chunk_ids: string[];
  secop_refs: string[];
  veredicto: string;
  motivo_soporte: string;
}

export interface Fuente {
  chunk_id: string;
  ruta: string;
  titulo: string;
  url_original: string;
}

export interface ContratoCit {
  id_contrato: string;
  nombre_entidad: string;
  proveedor_adjudicado: string;
  valor_del_contrato: number | null;
  urlproceso: string | null;
}

export interface Informe {
  id: string;
  markdown: string;
  resumen: string;
  verificacion: { afirmaciones: Veredicto[]; citas_inventadas: number };
  fuentes: Fuente[];
  contratos: ContratoCit[];
  pregunta: string;
  traza: Array<{ paso: number; tool_calls: Array<{ name: string }> }>;
  costo_usd: string;
}

export interface Chunk {
  chunk_id: string;
  ruta: string;
  texto: string;
  texto_contexto: string;
  doc: {
    titulo: string;
    numero: string;
    tipo: string;
    url_original: string;
    vigencia: string;
    autoridad: string;
    fecha_consulta: string | null;
  };
}

export interface DocCobertura {
  titulo: string;
  numero: string | null;
  tipo: string;
  emisor: string;
  jurisdiccion: string | null;
  vigencia: string;
  fragmentos: number;
  fecha_consulta: string | null;
}

export interface Cobertura {
  documentos: number;
  fragmentos: number;
  docs: DocCobertura[];
}

export interface Contrato {
  id_contrato: string;
  nombre_entidad: string;
  proveedor_adjudicado: string;
  objeto_del_contrato: string | null;
  descripcion_del_proceso: string | null;
  valor_del_contrato: number | null;
  modalidad_de_contratacion: string | null;
  fecha_de_firma: string | null;
  estado_contrato: string | null;
  enlace_origen: string;
  senales: Array<{ regla: string; detalle: string }>;
}

export const api = {
  health: () => j<{ status: string }>(`${API}/health`),
  investigar: (pregunta: string) =>
    j<Investigacion>(`${API}/agent/investigate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pregunta }),
    }),
  informe: (id: string) => j<Informe>(`${API}/report/${id}`),
  chunk: (id: string) => j<Chunk>(`${API}/search/chunk/${id}`),
  cobertura: () => j<Cobertura>(`${API}/search/documentos`),
  contratos: (p: Record<string, string>) => {
    const q = new URLSearchParams(p).toString();
    return j<{ contratos: Contrato[]; count: number; fecha_consulta: string; advertencia: string }>(
      `${API}/secop/contracts?${q}`,
    );
  },
};
