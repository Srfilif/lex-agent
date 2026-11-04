import { Controller, Get, NotFoundException, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ReportService } from './report.service';
import { AuthUser, OptionalAuthGuard, OptionalUser } from '../modules/identity';

@Controller('report')
export class ReportController {
  constructor(private readonly svc: ReportService) {}

  @Get(':id')
  @UseGuards(OptionalAuthGuard)
  async informe(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @OptionalUser() user?: AuthUser,
  ): Promise<Record<string, unknown>> {
    try {
      const r = await this.svc.informe(id, user?.id ?? null);
      return { id, ...r };
    } catch (e) {
      if ((e as Error).message === 'investigación no encontrada') {
        throw new NotFoundException('investigación no encontrada');
      }
      throw e;
    }
  }
}
