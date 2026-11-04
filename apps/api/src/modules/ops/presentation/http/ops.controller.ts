// GET /ops/metricas: resumen operativo solo para admin (+MFA en prod).
import { Controller, Get, UseFilters, UseGuards } from '@nestjs/common';
import {
  AuthErrorFilter,
  AuthGuard,
  Roles,
  RolesGuard,
} from '../../../identity';
import { Metricas, OpsMetricas } from '../../application/ops-metricas';

@Controller('ops')
@UseFilters(AuthErrorFilter)
@UseGuards(AuthGuard, RolesGuard)
export class OpsController {
  constructor(private readonly metricas: OpsMetricas) {}

  @Get('metricas')
  @Roles('admin')
  async resumen(): Promise<Metricas> {
    return this.metricas.resumen();
  }
}
