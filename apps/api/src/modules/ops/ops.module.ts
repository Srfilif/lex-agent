// Módulo ops: observabilidad (métricas admin solo-lectura).
import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity';
import { OpsMetricas } from './application/ops-metricas';
import { OpsController } from './presentation/http/ops.controller';

@Module({
  imports: [IdentityModule],
  controllers: [OpsController],
  providers: [OpsMetricas],
})
export class OpsModule {}
