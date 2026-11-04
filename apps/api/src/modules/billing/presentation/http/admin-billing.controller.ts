// Concesión manual de planes (admin). Fase F añade checkout; esto queda
// como override auditado.
import { Body, Controller, Post, Req, UseFilters, UseGuards } from '@nestjs/common';
import { IsInt, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import {
  AuthErrorFilter,
  AuthGuard,
  AuthUser,
  CurrentUser,
  RequestMeta,
  Roles,
  RolesGuard,
} from '../../../identity';
import { AdminGrantPlan } from '../../application/admin-grant';

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

class GrantDto {
  @IsUUID('4')
  user_id!: string;

  @IsString()
  @MaxLength(20)
  plan!: string;

  @IsInt()
  @Min(1)
  @Max(365)
  days!: number;
}

@Controller('admin/billing')
@UseFilters(AuthErrorFilter)
@UseGuards(AuthGuard, RolesGuard)
@Roles('admin')
export class AdminBillingController {
  constructor(private readonly grant: AdminGrantPlan) {}

  @Post('grant')
  async grantPost(
    @CurrentUser() admin: AuthUser,
    @Body() dto: GrantDto,
    @Req() req: RawReq,
  ): Promise<Record<string, unknown>> {
    return this.grant.execute(
      admin.id,
      { userId: dto.user_id, plan: dto.plan.trim().toLowerCase(), days: dto.days },
      metaOf(req),
    );
  }
}
