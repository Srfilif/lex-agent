import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  UnauthorizedException,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { Investigate } from '../../application/investigate';
import { InvestigateDto } from './dto';
import { AuthErrorFilter, AuthUser, OptionalAuthGuard, OptionalUser } from '../../../identity';
import { AppConfig, CONFIG } from '../../../../shared/config';

// investigate atribuye al usuario cuando hay Bearer (cuotas Fase E);
// anónimo = legacy (bloqueado en producción salvo ALLOW_ANON_INVESTIGATE).
@Controller('agent')
@UseFilters(AuthErrorFilter)
export class AgentController {
  constructor(
    private readonly svc: Investigate,
    @Inject(CONFIG) private readonly cfg: AppConfig,
  ) {}

  @Post('investigate')
  @UseGuards(OptionalAuthGuard)
  async investigate(
    @Body() body: InvestigateDto,
    @OptionalUser() user?: AuthUser,
  ): Promise<Record<string, unknown>> {
    if (!body.pregunta.trim()) throw new BadRequestException('falta pregunta');
    if (!user && (!this.cfg.allowAnonInvestigate || this.cfg.access.mode !== 'public')) {
      throw new UnauthorizedException('investigación anónima desactivada en este entorno');
    }
    return this.svc.execute(body.pregunta.trim(), body.max_pasos, user?.id ?? null);
  }

  @Get('investigaciones/:id')
  async obtener(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<Record<string, unknown>> {
    const r = await this.svc.obtener(id);
    if (!r) throw new NotFoundException('investigación no encontrada');
    return r;
  }
}
