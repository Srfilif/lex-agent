// Controlador /account de perfil/preferencias/privacidad (Fase G).
// Rutas disjuntas del /account de identity (GET me, security/*).
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import {
  AuthErrorFilter,
  AuthGuard,
  AuthUser,
  CurrentUser,
  RequestMeta,
} from '../../../identity';
import {
  ConfirmAccountDelete,
  ExportAccount,
  RequestAccountDelete,
} from '../../application/privacy';
import { Consents } from '../../application/consents';
import { GetPreferences, UpdatePreferences } from '../../application/preferences';
import { Memories } from '../../application/memories';
import {
  ConfirmEmailChange,
  RequestEmailChange,
  UpdateProfile,
} from '../../application/profile';

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

import {
  ConsentsDto,
  DeleteConfirmDto,
  EmailRequestDto,
  MemoryDto,
  PreferencesDto,
  TokenDto,
  UpdateProfileDto,
} from './dto';

@Controller('account')
@UseFilters(AuthErrorFilter)
@UseGuards(AuthGuard)
export class AccountPreferencesController {
  constructor(
    private readonly updateProfile: UpdateProfile,
    private readonly getPrefs: GetPreferences,
    private readonly updatePrefs: UpdatePreferences,
    private readonly reqEmail: RequestEmailChange,
    private readonly confEmail: ConfirmEmailChange,
    private readonly exportAcc: ExportAccount,
    private readonly reqDelete: RequestAccountDelete,
    private readonly confDelete: ConfirmAccountDelete,
    private readonly memories: Memories,
    private readonly consents: Consents,
  ) {}

  @Patch('me')
  async patchMe(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateProfileDto,
    @Req() req: RawReq,
  ): Promise<Record<string, unknown>> {
    return this.updateProfile.execute(user.id, { displayName: dto.display_name }, metaOf(req));
  }

  @Get('preferences')
  async prefsGet(@CurrentUser() user: AuthUser): Promise<Record<string, unknown>> {
    return (await this.getPrefs.execute(user.id)) as unknown as Record<string, unknown>;
  }

  @Patch('preferences')
  async prefsPatch(
    @CurrentUser() user: AuthUser,
    @Body() dto: PreferencesDto,
  ): Promise<Record<string, unknown>> {
    const out = await this.updatePrefs.execute(
      user.id,
      dto as unknown as Record<string, unknown>,
    );
    return out as unknown as Record<string, unknown>;
  }

  @Post('email/request')
  async emailReqPost(
    @CurrentUser() user: AuthUser,
    @Body() dto: EmailRequestDto,
    @Req() req: RawReq,
  ): Promise<{ message: string }> {
    return this.reqEmail.execute(
      user.id,
      { password: dto.password, newEmail: dto.new_email },
      metaOf(req),
    );
  }

  @Post('email/confirm')
  async emailConfPost(
    @CurrentUser() user: AuthUser,
    @Body() dto: TokenDto,
    @Req() req: RawReq,
  ): Promise<Record<string, unknown>> {
    return this.confEmail.execute(user.id, user.sessionId, dto.token, metaOf(req));
  }

  @Get('export')
  async exportGet(
    @CurrentUser() user: AuthUser,
    @Req() req: RawReq,
  ): Promise<Record<string, unknown>> {
    return this.exportAcc.execute(user.id, metaOf(req));
  }

  @Post('delete-request')
  async deleteReqPost(
    @CurrentUser() user: AuthUser,
    @Req() req: RawReq,
  ): Promise<{ message: string }> {
    return this.reqDelete.execute(user.id, metaOf(req));
  }

  @Post('delete-confirm')
  async deleteConfPost(
    @CurrentUser() user: AuthUser,
    @Body() dto: DeleteConfirmDto,
  ): Promise<Record<string, unknown>> {
    return this.confDelete.execute(user.id, { password: dto.password, token: dto.token });
  }

  @Get('memories')
  async memoriesList(@CurrentUser() user: AuthUser): Promise<Record<string, unknown>> {
    return this.memories.list(user.id);
  }

  @Post('memories')
  async memoriesAdd(
    @CurrentUser() user: AuthUser,
    @Body() dto: MemoryDto,
  ): Promise<Record<string, unknown>> {
    return this.memories.add(user.id, dto.fact);
  }

  @Get('consents')
  async consentsGet(@CurrentUser() user: AuthUser): Promise<Record<string, unknown>> {
    return (await this.consents.get(user.id)) as unknown as Record<string, unknown>;
  }

  @Post('consents')
  async consentsPost(
    @CurrentUser() user: AuthUser,
    @Body() dto: ConsentsDto,
    @Req() req: RawReq,
  ): Promise<Record<string, unknown>> {
    const out = await this.consents.accept(
      user.id,
      { termsAccepted: dto.terms_accepted, privacyAccepted: dto.privacy_accepted },
      metaOf(req),
    );
    return out as unknown as Record<string, unknown>;
  }

  @Delete('memories/:id')
  async memoriesRemove(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<{ message: string }> {
    return this.memories.remove(user.id, id);
  }
}
