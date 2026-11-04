// Controlador /admin/users: gestión mínima de cuentas (solo admin).
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { RequestMeta } from '../../application/ports';
import {
  AdminListUsers,
  AdminResetTotp,
  AdminSetUserRole,
  AdminSetUserStatus,
} from '../../application/admin';
import { UserRole, UserStatus } from '../../domain/user';
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

class ListUsersDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

class StatusDto {
  @IsString()
  @IsIn(['active', 'disabled'])
  status!: UserStatus;
}

class RoleDto {
  @IsString()
  @IsIn(['user', 'admin'])
  role!: UserRole;
}

@Controller('admin/users')
@UseFilters(AuthErrorFilter)
@UseGuards(AuthGuard, RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(
    private readonly list: AdminListUsers,
    private readonly setStatus: AdminSetUserStatus,
    private readonly setRole: AdminSetUserRole,
    private readonly resetTotp: AdminResetTotp,
  ) {}

  @Get()
  async listGet(@Query() q: ListUsersDto): Promise<Record<string, unknown>> {
    return this.list.execute({
      limit: q.limit ?? 20,
      offset: q.offset ?? 0,
      search: (q.search ?? '').trim().slice(0, 100),
    });
  }

  @Patch(':id/status')
  async statusPatch(
    @CurrentUser() admin: AuthUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: StatusDto,
    @Req() req: RawReq,
  ): Promise<Record<string, unknown>> {
    return this.setStatus.execute(admin.id, id, dto.status, metaOf(req));
  }

  @Patch(':id/role')
  async rolePatch(
    @CurrentUser() admin: AuthUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: RoleDto,
    @Req() req: RawReq,
  ): Promise<Record<string, unknown>> {
    return this.setRole.execute(admin.id, id, dto.role, metaOf(req));
  }

  @Post(':id/totp/reset')
  async totpResetPost(
    @CurrentUser() admin: AuthUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: RawReq,
  ): Promise<{ message: string }> {
    return this.resetTotp.execute(admin.id, id, metaOf(req));
  }
}
