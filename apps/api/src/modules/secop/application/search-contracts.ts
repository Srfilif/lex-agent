import { Inject, Injectable } from '@nestjs/common';
import {
  ConsultarContratos,
  SECOP_REPOSITORY,
  SecopRepository,
} from './ports';
import { FiltrosContratos, ResultadoContratos } from '../domain/contract';

const DATASET = 'jbjy-vk9h';
const MAX_LIMIT = 50;

// Caso de uso: consulta de contratos sobre el caché sincronizado.
// Orquesta el puerto de persistencia; no construye SQL.
@Injectable()
export class SearchContracts implements ConsultarContratos {
  constructor(@Inject(SECOP_REPOSITORY) private readonly repo: SecopRepository) {}

  async contratos(f: FiltrosContratos): Promise<ResultadoContratos> {
    const limit = Math.min(Math.max(f.limit ?? 20, 1), MAX_LIMIT);
    const { contratos, syncedAt } = await this.repo.search({ ...f, limit });
    return {
      contratos,
      fecha_consulta: this.fechaSync(syncedAt),
      modo: 'sincronizado (contratos más recientes; re-sync con npm run sync:secop)',
      dataset: DATASET,
    };
  }

  private fechaSync(v: unknown): string {
    if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString();
    if (typeof v === 'string' && v) {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) return d.toISOString();
    }
    return new Date().toISOString();
  }
}
