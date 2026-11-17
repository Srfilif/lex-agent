import { ContratoResumido, FiltrosContratos, ResultadoContratos } from '../domain/contract';

/** Persistencia de lectura del caché SECOP. */
export const SECOP_REPOSITORY = Symbol('SECOP_REPOSITORY');

export interface SecopSearchResult {
  contratos: ContratoResumido[];
  /** Marca de la última sincronización, tal como la entrega la persistencia. */
  syncedAt: unknown;
}

export interface SecopRepository {
  search(filtros: FiltrosContratos): Promise<SecopSearchResult>;
}

/** Contrato publicado a chat y al agente investigador. */
export const SECOP_QUERY = Symbol('SECOP_QUERY');

export interface ConsultarContratos {
  contratos(filtros: FiltrosContratos): Promise<ResultadoContratos>;
}
