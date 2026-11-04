import { Module } from '@nestjs/common';
import { ConfigModule } from './shared/config';
import { SharedModule } from './shared/shared.module';
import { CorpusModule } from './modules/corpus';
import { IdentityModule } from './modules/identity';
import { BillingModule } from './modules/billing';
import { AccountModule } from './modules/account/account.module';
import { ChatModule } from './modules/chat/chat.module';
import { OpsModule } from './modules/ops/ops.module';
import { SecopModule } from './secop/secop.module';
import { SecopService } from './secop/secop.service';
import { HealthController } from './health.controller';
import { AgentController } from './agent/agent.controller';
import { AgentService } from './agent/agent.service';
import { Tools } from './agent/tools';
import { CONSULTAR_CONTRATOS } from './agent/secop.port';
import { VERIFICAR_INVESTIGACION } from './report/verify.port';
import { VerifierService } from './verify/verifier.service';
import { ReportController } from './report/report.controller';
import { ReportService } from './report/report.service';

@Module({
  imports: [ConfigModule, SharedModule, CorpusModule, IdentityModule, BillingModule, AccountModule, SecopModule, ChatModule, OpsModule],
  controllers: [HealthController, AgentController, ReportController],
  providers: [
    AgentService,
    Tools,
    VerifierService,
    ReportService,
    { provide: CONSULTAR_CONTRATOS, useExisting: SecopService },
    { provide: VERIFICAR_INVESTIGACION, useExisting: VerifierService },
  ],
})
export class AppModule {}
