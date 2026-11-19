// Controlador /admin/access: modo, whitelist y códigos (solo admin).
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { AccessAdmin } from '../../application/access';
import { RequestMeta } from '../../application/ports';
import { AuthErrorFilter } from './auth-error.filter';
import { AuthGuard, AuthUser } from './auth.guard';
import { CurrentUser } from './current-user.decorator';
import { Roles, RolesGuard } from './roles.guard';

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

class WhitelistAddDto {
  @IsString()
  @MaxLength(254)
  pattern!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  label?: string;
}

class CodeCreateDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  label?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  max_uses?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  expires_in_days?: number;
}

@Controller('admin/access')
@UseFilters(AuthErrorFilter)
@UseGuards(AuthGuard, RolesGuard)
@Roles('admin')
export class AccessAdminController {
  constructor(private readonly admin: AccessAdmin) {}

  @Get('mode')
  async modeGet(): Promise<Record<string, unknown>> {
    return this.admin.modeState();
  }

  @Get('whitelist')
  async whitelistGet(): Promise<Record<string, unknown>> {
    return this.admin.listWhitelist();
  }

  @Post('whitelist')
  async whitelistPost(
    @CurrentUser() user: AuthUser,
    @Body() dto: WhitelistAddDto,
    @Req() req: RawReq,
  ): Promise<Record<string, unknown>> {
    return this.admin.addWhitelist(user.id, { pattern: dto.pattern, label: dto.label }, metaOf(req));
  }

  @Delete('whitelist/:id')
  async whitelistDelete(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: RawReq,
  ): Promise<{ message: string }> {
    return this.admin.removeWhitelist(user.id, id, metaOf(req));
  }

  @Get('codes')
  async codesGet(): Promise<Record<string, unknown>> {
    return this.admin.listCodes();
  }

  @Post('codes')
  async codesPost(
    @CurrentUser() user: AuthUser,
    @Body() dto: CodeCreateDto,
    @Req() req: RawReq,
  ): Promise<Record<string, unknown>> {
    const out = await this.admin.createCode(
      user.id,
      { label: dto.label, maxUses: dto.max_uses, expiresInDays: dto.expires_in_days ?? null },
      metaOf(req),
    );
    return out as unknown as Record<string, unknown>;
  }

  @Post('codes/:id/revoke')
  async codesRevokePost(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: RawReq,
  ): Promise<{ message: string }> {
    return this.admin.revokeCode(user.id, id, metaOf(req));
  }
}
