// Módulo ops: observabilidad (métricas admin solo-lectura).
import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity';
import { OPS_METRICS_REPOSITORY } from './domain/metrics';
import { OpsMetricas } from './application/ops-metricas';
import { PgOpsMetricsRepository } from './infrastructure/persistence/pg-ops-metrics.repository';
import { OpsController } from './presentation/http/ops.controller';

@Module({
  imports: [IdentityModule],
  controllers: [OpsController],
  providers: [
    { provide: OPS_METRICS_REPOSITORY, useClass: PgOpsMetricsRepository },
    OpsMetricas,
  ],
})
export class OpsModule {}
