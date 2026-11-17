// Interfaz pública del módulo SECOP.
export { SecopModule } from './secop.module';
export { SearchContracts } from './application/search-contracts';
export {
  SECOP_QUERY,
  SECOP_REPOSITORY,
  type ConsultarContratos,
  type SecopRepository,
} from './application/ports';
export type { ContratoResumido, FiltrosContratos, ResultadoContratos } from './domain/contract';
