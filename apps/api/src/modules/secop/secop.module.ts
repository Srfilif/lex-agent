// Módulo SECOP: lectura del caché local. Expone un puerto de consulta a chat
// y research; el SQL queda aislado en infraestructura.
import { Module } from '@nestjs/common';
import { SharedModule } from '../../shared/shared.module';
import { SECOP_QUERY, SECOP_REPOSITORY } from './application/ports';
import { SearchContracts } from './application/search-contracts';
import { PgSecopRepository } from './infrastructure/persistence/pg-secop.repository';
import { SecopController } from './presentation/http/secop.controller';

@Module({
  imports: [SharedModule],
  controllers: [SecopController],
  providers: [
    { provide: SECOP_REPOSITORY, useClass: PgSecopRepository },
    SearchContracts,
    { provide: SECOP_QUERY, useExisting: SearchContracts },
  ],
  exports: [SECOP_QUERY, SearchContracts],
})
export class SecopModule {}
