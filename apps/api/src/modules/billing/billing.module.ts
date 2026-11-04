// Módulo billing: catálogo, suscripciones, medición (E) y pagos sandbox (F).
import { Module } from '@nestjs/common';
import { SharedModule } from '../../shared/shared.module';
import { AppConfig, CONFIG } from '../../shared/config';
import { IdentityModule } from '../identity';
import {
  PAYMENT_REPOSITORY,
  PLAN_REPOSITORY,
  SUBSCRIPTION_EVENT_REPOSITORY,
  SUBSCRIPTION_REPOSITORY,
  USAGE_REPOSITORY,
  WEBHOOK_REPOSITORY,
} from './domain/repositories';
import { AdminGrantPlan } from './application/admin-grant';
import { BillingForAgent } from './application/billing-for-agent';
import { EffectivePlanResolver } from './application/effective-plan';
import { HandleWebhook } from './application/handle-webhook';
import { PAYMENT_PROVIDER } from './application/ports';
import { GetEntitlements, GetPlans, GetSubscriptionStatus, GetUsage } from './application/reads';
import { SandboxSimulator } from './application/sandbox-simulator';
import { StartCheckout } from './application/start-checkout';
import {
  CancelSubscription,
  ChangePlan,
  GetPayments,
  GetSubscriptionHistory,
  ResumeSubscription,
} from './application/subscription-manage';
import {
  PgPaymentRepository,
  PgPlanRepository,
  PgSubscriptionEventRepository,
  PgSubscriptionRepository,
  PgUsageRepository,
  PgWebhookRepository,
} from './infrastructure/persistence/pg-billing.repositories';
import { SandboxPaymentProvider } from './infrastructure/payments/sandbox.provider';
import { AdminBillingController } from './presentation/http/admin-billing.controller';
import { BillingController } from './presentation/http/billing.controller';
import { SandboxController } from './presentation/http/sandbox.controller';
import { WebhooksController } from './presentation/http/webhooks.controller';

@Module({
  imports: [SharedModule, IdentityModule],
  controllers: [BillingController, AdminBillingController, WebhooksController, SandboxController],
  providers: [
    { provide: PLAN_REPOSITORY, useClass: PgPlanRepository },
    { provide: SUBSCRIPTION_REPOSITORY, useClass: PgSubscriptionRepository },
    { provide: USAGE_REPOSITORY, useClass: PgUsageRepository },
    { provide: PAYMENT_REPOSITORY, useClass: PgPaymentRepository },
    { provide: WEBHOOK_REPOSITORY, useClass: PgWebhookRepository },
    { provide: SUBSCRIPTION_EVENT_REPOSITORY, useClass: PgSubscriptionEventRepository },
    {
      provide: PAYMENT_PROVIDER,
      inject: [CONFIG],
      useFactory: (cfg: AppConfig) => new SandboxPaymentProvider(cfg.billing.webhookSecret),
    },
    EffectivePlanResolver,
    GetPlans,
    GetSubscriptionStatus,
    GetUsage,
    GetEntitlements,
    BillingForAgent,
    AdminGrantPlan,
    StartCheckout,
    HandleWebhook,
    SandboxSimulator,
    CancelSubscription,
    ResumeSubscription,
    ChangePlan,
    GetPayments,
    GetSubscriptionHistory,
  ],
  exports: [BillingForAgent, EffectivePlanResolver],
})
export class BillingModule {}
