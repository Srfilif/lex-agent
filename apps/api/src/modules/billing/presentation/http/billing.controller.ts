// Controlador /billing: catálogo público + estado propio (autenticado)
// + checkout y gestión de suscripción (Fases E–F).
import { Body, Controller, Get, Post, Req, UseFilters, UseGuards } from '@nestjs/common';
import { IsString, MaxLength } from 'class-validator';
import {
  AuthErrorFilter,
  AuthGuard,
  AuthUser,
  CurrentUser,
  RequestMeta,
} from '../../../identity';
import { GetEntitlements, GetPlans, GetSubscriptionStatus, GetUsage } from '../../application/reads';
import { StartCheckout } from '../../application/start-checkout';
import {
  CancelSubscription,
  ChangePlan,
  GetPayments,
  GetSubscriptionHistory,
  ResumeSubscription,
} from '../../application/subscription-manage';

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

class PlanDto {
  @IsString()
  @MaxLength(20)
  plan!: string;
}

@Controller('billing')
@UseFilters(AuthErrorFilter)
export class BillingController {
  constructor(
    private readonly plans: GetPlans,
    private readonly status: GetSubscriptionStatus,
    private readonly usage: GetUsage,
    private readonly entitlements: GetEntitlements,
    private readonly checkout: StartCheckout,
    private readonly cancel: CancelSubscription,
    private readonly resume: ResumeSubscription,
    private readonly change: ChangePlan,
    private readonly payments: GetPayments,
    private readonly history: GetSubscriptionHistory,
  ) {}

  @Get('plans')
  async plansGet(): Promise<Record<string, unknown>> {
    return this.plans.execute();
  }

  @Get('subscription')
  @UseGuards(AuthGuard)
  async subscriptionGet(@CurrentUser() user: AuthUser): Promise<Record<string, unknown>> {
    return this.status.execute(user.id);
  }

  @Get('usage')
  @UseGuards(AuthGuard)
  async usageGet(@CurrentUser() user: AuthUser): Promise<Record<string, unknown>> {
    return this.usage.execute(user.id);
  }

  @Get('entitlements')
  @UseGuards(AuthGuard)
  async entitlementsGet(@CurrentUser() user: AuthUser): Promise<Record<string, unknown>> {
    return this.entitlements.execute(user.id);
  }

  @Post('checkout')
  @UseGuards(AuthGuard)
  async checkoutPost(
    @CurrentUser() user: AuthUser,
    @Body() dto: PlanDto,
    @Req() req: RawReq,
  ): Promise<Record<string, unknown>> {
    return this.checkout.execute(user.id, dto.plan.trim().toLowerCase(), metaOf(req));
  }

  @Post('subscription/cancel')
  @UseGuards(AuthGuard)
  async cancelPost(
    @CurrentUser() user: AuthUser,
    @Req() req: RawReq,
  ): Promise<Record<string, unknown>> {
    return this.cancel.execute(user.id, metaOf(req));
  }

  @Post('subscription/resume')
  @UseGuards(AuthGuard)
  async resumePost(@CurrentUser() user: AuthUser): Promise<Record<string, unknown>> {
    return this.resume.execute(user.id);
  }

  @Post('subscription/change-plan')
  @UseGuards(AuthGuard)
  async changePost(
    @CurrentUser() user: AuthUser,
    @Body() dto: PlanDto,
    @Req() req: RawReq,
  ): Promise<Record<string, unknown>> {
    return this.change.execute(user.id, dto.plan.trim().toLowerCase(), metaOf(req));
  }

  @Get('payments')
  @UseGuards(AuthGuard)
  async paymentsGet(@CurrentUser() user: AuthUser): Promise<Record<string, unknown>> {
    return this.payments.execute(user.id);
  }

  @Get('subscription/history')
  @UseGuards(AuthGuard)
  async historyGet(@CurrentUser() user: AuthUser): Promise<Record<string, unknown>> {
    return this.history.execute(user.id);
  }
}
