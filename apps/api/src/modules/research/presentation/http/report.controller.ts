import { Controller, Get, NotFoundException, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { BuildReport } from '../../application/build-report';
import { InvestigationNotFoundError } from '../../application/errors';
import { AuthUser, OptionalAuthGuard, OptionalUser } from '../../../identity';

@Controller('report')
export class ReportController {
  constructor(private readonly svc: BuildReport) {}

  @Get(':id')
  @UseGuards(OptionalAuthGuard)
  async informe(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @OptionalUser() user?: AuthUser,
  ): Promise<Record<string, unknown>> {
    try {
      const r = await this.svc.execute(id, user?.id ?? null);
      return { id, ...r };
    } catch (e) {
      if (e instanceof InvestigationNotFoundError) {
        throw new NotFoundException('investigación no encontrada');
      }
      throw e;
    }
  }
}
