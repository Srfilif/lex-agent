import { Inject, Injectable } from '@nestjs/common';
import { CONSULTAR_CONTRATOS, ConsultarContratos } from './secop.port';
import { ToolDef } from '../gateway/model-gateway';
import {
  CORPUS_REPOSITORY,
  CorpusRepository,
  SearchDocuments,
} from '../modules/corpus';

// 4 herramientas del agente (ver MVP_SCOPE C + RAG_DESIGN verificación).

export const TOOLS: ToolDef[] = [
  {
    type: 'function',
    function: {
      name: 'buscar_normas',
      description:
        'Busca artículos de normas (leyes, constitución, decretos) en el corpus. Devuelve fragmentos con chunk_id citable, ruta y texto.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'consulta jurídica' },
          top_k: { type: 'integer', description: 'nº fragmentos (1-10)', default: 5 },
          tipo: { type: 'string', description: 'filtro: ley, constitucion, decreto' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'buscar_jurisprudencia',
      description:
        'Busca sentencias y jurisprudencia en el corpus. Si no hay resultados, dilo: el corpus de sentencias está en construcción.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          top_k: { type: 'integer', default: 5 },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultar_secop',
      description:
        'Consulta contratos SECOP II sincronizados por entidad, proveedor, objeto, cuantía, modalidad o año. Devuelve filas con enlace al origen y señales (indicios, no acusaciones).',
      parameters: {
        type: 'object',
        properties: {
          entidad: { type: 'string' },
          proveedor: { type: 'string' },
          objeto: { type: 'string' },
          valor_min: { type: 'number' },
          valor_max: { type: 'number' },
          modalidad: { type: 'string' },
          anio: { type: 'integer' },
          limit: { type: 'integer', default: 10 },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'verificar_cita',
      description:
        'Verifica que un chunk_id exista en el corpus y, si se da cita textual, que sea subcadena del fragmento. Úsala antes de citar.',
      parameters: {
        type: 'object',
        properties: {
          chunk_id: { type: 'string' },
          cita: { type: 'string', description: 'cita textual a comprobar (opcional)' },
        },
        required: ['chunk_id'],
      },
    },
  },
];

@Injectable()
export class Tools {
  constructor(
    @Inject(CORPUS_REPOSITORY) private readonly corpus: CorpusRepository,
    private readonly search: SearchDocuments,
    @Inject(CONSULTAR_CONTRATOS) private readonly secop: ConsultarContratos,
  ) {}

  async ejecutar(nombre: string, argsJson: string): Promise<string> {
    let a: Record<string, unknown>;
    try {
      a = JSON.parse(argsJson || '{}');
    } catch {
      return JSON.stringify({ error: 'argumentos JSON inválidos' });
    }
    const s = (v: unknown) => (typeof v === 'string' ? v : undefined);
    const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
    try {
      switch (nombre) {
        case 'buscar_normas': {
          const r = await this.search.execute(String(a.query ?? ''), {
            topK: Math.min(Math.max(n(a.top_k) ?? 5, 1), 10),
            tipo: s(a.tipo),
          });
          return JSON.stringify({
            hits: r.hits.map((h) => ({
              chunk_id: h.chunk_id,
              ruta: h.ruta,
              texto: h.texto.slice(0, 2500),
              doc: h.doc,
            })),
          });
        }
        case 'buscar_jurisprudencia': {
          const r = await this.search.execute(String(a.query ?? ''), {
            topK: Math.min(Math.max(n(a.top_k) ?? 5, 1), 10),
            tipo: 'sentencia',
          });
          return JSON.stringify({
            hits: r.hits.map((h) => ({
              chunk_id: h.chunk_id,
              ruta: h.ruta,
              texto: h.texto.slice(0, 1500),
              doc: h.doc,
            })),
            nota: r.hits.length
              ? undefined
              : 'Sin resultados: el corpus de sentencias está en construcción.',
          });
        }
        case 'consultar_secop': {
          const r = await this.secop.contratos({
            entidad: s(a.entidad),
            proveedor: s(a.proveedor),
            objeto: s(a.objeto),
            valorMin: n(a.valor_min),
            valorMax: n(a.valor_max),
            modalidad: s(a.modalidad),
            anio: n(a.anio),
            limit: Math.min(Math.max(n(a.limit) ?? 10, 1), 20),
          });
          return JSON.stringify({
            count: r.contratos.length,
            fecha_consulta: r.fecha_consulta,
            contratos: r.contratos.map((c) => ({
              id_contrato: c.id_contrato,
              entidad: c.nombre_entidad,
              proveedor: c.proveedor_adjudicado,
              objeto: String(c.objeto_del_contrato ?? c.descripcion_del_proceso ?? '').slice(0, 400),
              valor: c.valor_del_contrato,
              modalidad: c.modalidad_de_contratacion,
              fecha_firma: c.fecha_de_firma,
              estado: c.estado_contrato,
              enlace: c.enlace_origen,
              senales: c.senales,
            })),
          });
        }
        case 'verificar_cita': {
          const id = s(a.chunk_id);
          if (!id) return JSON.stringify({ existe: false, error: 'falta chunk_id' });
          const c = await this.corpus.chunkRef(id);
          if (!c) return JSON.stringify({ existe: false });
          const cita = s(a.cita);
          const norm = (t: string) => t.replace(/\s+/g, ' ').trim();
          return JSON.stringify({
            existe: true,
            ruta: c.ruta,
            fidelidad:
              cita === undefined ? 'no comprobada (sin cita textual)' : norm(c.texto).includes(norm(cita)),
          });
        }
        default:
          return JSON.stringify({ error: `herramienta desconocida: ${nombre}` });
      }
    } catch (e) {
      return JSON.stringify({ error: (e as Error).message.slice(0, 300) });
    }
  }
}
