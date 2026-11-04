// Controlador /account/security/totp: enrolamiento y gestión 2FA (con sesión).
import { Body, Controller, Get, Post, Req, UseFilters, UseGuards } from '@nestjs/common';
import { RequestMeta } from '../../application/ports';
import {
  ConfirmTotp,
  DisableTotp,
  RegenerateRecoveryCodes,
  SetupTotp,
  TotpStatus,
} from '../../application/totp';
import { AuthErrorFilter } from './auth-error.filter';
import { AuthGuard, AuthUser } from './auth.guard';
import { CurrentUser } from './current-user.decorator';
import { TotpCodeDto, TotpDisableDto } from './dto';

interface RawReq {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
}

function metaOf(req: RawReq): RequestMeta {
  const h = (k: string): string | null => {
    const v = req.headers[k];
    if (Array.isArray(v)) return v[0] ?? null;
    return v ?? null;
  };
  const xff = h('x-forwarded-for');
  const ip = (xff?.split(',')[0]?.trim() || req.ip || null) as string | null;
  return { ip, userAgent: h('user-agent') };
}

@Controller('account/security/totp')
@UseFilters(AuthErrorFilter)
@UseGuards(AuthGuard)
export class TotpController {
  constructor(
    private readonly setup: SetupTotp,
    private readonly confirm: ConfirmTotp,
    private readonly status: TotpStatus,
    private readonly disable: DisableTotp,
    private readonly regen: RegenerateRecoveryCodes,
  ) {}

  @Get('status')
  async statusGet(@CurrentUser() user: AuthUser): Promise<Record<string, unknown>> {
    return this.status.execute(user.id);
  }

  @Post('setup')
  async setupPost(
    @CurrentUser() user: AuthUser,
    @Req() req: RawReq,
  ): Promise<Record<string, unknown>> {
    return this.setup.execute(user.id, metaOf(req));
  }

  @Post('confirm')
  async confirmPost(
    @CurrentUser() user: AuthUser,
    @Body() dto: TotpCodeDto,
    @Req() req: RawReq,
  ): Promise<Record<string, unknown>> {
    return this.confirm.execute(user.id, user.sessionId, dto.code, metaOf(req));
  }

  @Post('disable')
  async disablePost(
    @CurrentUser() user: AuthUser,
    @Body() dto: TotpDisableDto,
    @Req() req: RawReq,
  ): Promise<{ message: string }> {
    return this.disable.execute(
      user.id,
      user.sessionId,
      { password: dto.password, code: dto.code },
      metaOf(req),
    );
  }

  @Post('recovery-codes/regenerate')
  async regenPost(
    @CurrentUser() user: AuthUser,
    @Body() dto: TotpDisableDto,
    @Req() req: RawReq,
  ): Promise<Record<string, unknown>> {
    return this.regen.execute(
      user.id,
      { password: dto.password, code: dto.code },
      metaOf(req),
    );
  }
}
