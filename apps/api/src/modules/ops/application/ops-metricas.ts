import { Inject, Injectable } from '@nestjs/common';
import {
  Metricas,
  OPS_METRICS_REPOSITORY,
  OpsMetricsRepository,
} from '../domain/metrics';

export type { Metricas, UsoKind } from '../domain/metrics';

// Caso de uso de observabilidad: solo delega en el puerto de lectura.
@Injectable()
export class OpsMetricas {
  constructor(@Inject(OPS_METRICS_REPOSITORY) private readonly repo: OpsMetricsRepository) {}

  async resumen(): Promise<Metricas> {
    return this.repo.summary();
  }
}
