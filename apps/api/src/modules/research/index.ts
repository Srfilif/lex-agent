// Interfaz pública del módulo research.
export { ResearchModule } from './research.module';
export { Investigate } from './application/investigate';
export { VerifyInvestigation } from './application/verify-investigation';
export { BuildReport } from './application/build-report';
export {
  INVESTIGATION_REPOSITORY,
  type Investigation,
  type InvestigationAnswer,
  type InvestigationRepository,
} from './domain/investigation';
export { dictaminar, type VeredictoAfirm, type VerificationResult } from './domain/verdict';
