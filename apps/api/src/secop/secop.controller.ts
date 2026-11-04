import { Controller, Get, Query } from '@nestjs/common';
import { SecopService } from './secop.service';
import { SecopQueryDto } from './secop.dto';

@Controller('secop')
export class SecopController {
  constructor(private readonly svc: SecopService) {}

  @Get('contracts')
  async contracts(@Query() query: SecopQueryDto): Promise<Record<string, unknown>> {
    const r = await this.svc.contratos({
      entidad: query.entidad || undefined,
      proveedor: query.proveedor || undefined,
      objeto: query.objeto || undefined,
      valorMin: query.valor_min,
      valorMax: query.valor_max,
      modalidad: query.modalidad || undefined,
      estado: query.estado || undefined,
      anio: query.anio,
      limit: query.limit,
    });
    return {
      ...r,
      count: r.contratos.length,
      advertencia:
        'Datos de calidad variable (ver PUBLIC_DATA_SOURCES.md). Las señales son indicios para revisar, no prueba de irregularidad.',
    };
  }
}
