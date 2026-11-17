import { Module } from '@nestjs/common';
import { ConfigModule } from './shared/config';
import { SharedModule } from './shared/shared.module';
import { CorpusModule } from './modules/corpus';
import { IdentityModule } from './modules/identity';
import { BillingModule } from './modules/billing';
import { AccountModule } from './modules/account/account.module';
import { ChatModule } from './modules/chat/chat.module';
import { OpsModule } from './modules/ops/ops.module';
import { SecopModule } from './modules/secop';
import { ResearchModule } from './modules/research/research.module';
import { HealthController } from './shared/presentation/health.controller';

@Module({
  imports: [
    ConfigModule,
    SharedModule,
    CorpusModule,
    IdentityModule,
    BillingModule,
    AccountModule,
    SecopModule,
    ChatModule,
    OpsModule,
    ResearchModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
