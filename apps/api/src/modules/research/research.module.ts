// Módulo research: investigador, verificación de citas e informe.
import { Module } from '@nestjs/common';
import { SharedModule } from '../../shared/shared.module';
import { IdentityModule } from '../identity';
import { BillingModule } from '../billing';
import { CorpusModule } from '../corpus';
import { SecopModule } from '../secop';
import { INVESTIGATION_REPOSITORY } from './domain/investigation';
import { PgInvestigationRepository } from './infrastructure/persistence/pg-investigation.repository';
import { ResearchTools } from './application/tools';
import { Investigate } from './application/investigate';
import { VerifyInvestigation } from './application/verify-investigation';
import { BuildReport } from './application/build-report';
import { VERIFICATION_PORT } from './application/ports';
import { AgentController } from './presentation/http/agent.controller';
import { ReportController } from './presentation/http/report.controller';

@Module({
  imports: [SharedModule, IdentityModule, BillingModule, CorpusModule, SecopModule],
  controllers: [AgentController, ReportController],
  providers: [
    { provide: INVESTIGATION_REPOSITORY, useClass: PgInvestigationRepository },
    ResearchTools,
    Investigate,
    VerifyInvestigation,
    BuildReport,
    { provide: VERIFICATION_PORT, useExisting: VerifyInvestigation },
  ],
})
export class ResearchModule {}
