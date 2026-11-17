// Modelo y puerto de persistencia de investigaciones. Sin SQL ni framework.

export interface TokenUsage {
  prompt: number;
  completion: number;
  total: number;
}

export interface InvestigationClaim {
  [k: string]: unknown;
  texto?: string;
  tipo?: string;
  chunk_ids?: string[];
  secop_refs?: string[];
}

export interface InvestigationAnswer {
  [k: string]: unknown;
  resumen?: string;
  afirmaciones?: InvestigationClaim[];
  evidencia_insuficiente?: boolean;
  _valido?: boolean;
}

export interface Investigation {
  id: string;
  question: string;
  trace: unknown;
  answer: InvestigationAnswer;
  usage: TokenUsage;
  costUsd: number;
  userId: string | null;
  createdAt: Date;
}

export interface NewInvestigation {
  question: string;
  trace: unknown;
  answer: InvestigationAnswer;
  usage: TokenUsage;
  costUsd: number;
  userId: string | null;
}

export interface ChunkSource {
  chunk_id: string;
  ruta: string;
  texto: string;
  titulo: string;
  url_original: string;
}

export interface SecopSource {
  id_contrato: string;
  nombre_entidad: string;
  proveedor_adjudicado: string;
  valor_del_contrato: number | null;
  urlproceso: string | null;
}

export const INVESTIGATION_REPOSITORY = Symbol('INVESTIGATION_REPOSITORY');

export interface InvestigationRepository {
  save(input: NewInvestigation): Promise<{ id: string; createdAt: Date }>;
  findById(id: string): Promise<Investigation | null>;
  findChunkSources(ids: string[]): Promise<ChunkSource[]>;
  findSecopSources(ids: string[]): Promise<SecopSource[]>;
}
