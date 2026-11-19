// Módulo account: perfil, preferencias, privacidad y memoria (Fase G + B8).
// Importa identity + billing (lectura); expone MemoryForAgent al chat.
import { Module } from '@nestjs/common';
import { SharedModule } from '../../shared/shared.module';
import { IdentityModule } from '../identity';
import { BillingModule } from '../billing';
import {
  ACCOUNT_PRIVACY_REPOSITORY,
  MEMORY_REPOSITORY,
  PREFERENCES_REPOSITORY,
} from './domain/repositories';
import {
  ConfirmEmailChange,
  RequestEmailChange,
  UpdateProfile,
} from './application/profile';
import { GetPreferences, UpdatePreferences } from './application/preferences';
import { Memories, MemoryForAgent } from './application/memories';
import { MEMORY_FOR_AGENT } from './application/ports';
import {
  ConfirmAccountDelete,
  ExportAccount,
  RequestAccountDelete,
} from './application/privacy';
import { Consents } from './application/consents';
import {
  PgAccountPrivacyRepository,
  PgMemoryRepository,
  PgPreferencesRepository,
} from './infrastructure/persistence/pg-account.repositories';
import { AccountPreferencesController } from './presentation/http/account.controller';

@Module({
  imports: [SharedModule, IdentityModule, BillingModule],
  controllers: [AccountPreferencesController],
  providers: [
    { provide: PREFERENCES_REPOSITORY, useClass: PgPreferencesRepository },
    { provide: ACCOUNT_PRIVACY_REPOSITORY, useClass: PgAccountPrivacyRepository },
    { provide: MEMORY_REPOSITORY, useClass: PgMemoryRepository },
    UpdateProfile,
    RequestEmailChange,
    ConfirmEmailChange,
    GetPreferences,
    UpdatePreferences,
    Memories,
    MemoryForAgent,
    { provide: MEMORY_FOR_AGENT, useExisting: MemoryForAgent },
    ExportAccount,
    RequestAccountDelete,
    ConfirmAccountDelete,
    Consents,
  ],
  exports: [MEMORY_FOR_AGENT, MemoryForAgent],
})
export class AccountModule {}
