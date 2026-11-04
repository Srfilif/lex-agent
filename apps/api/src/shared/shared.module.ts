import { Global, Module } from '@nestjs/common';
import { Db } from '../db';
import { ModelGateway } from '../gateway/model-gateway';

// Núcleo compartido transitorio (Bloque B): expone Db y ModelGateway a los
// módulos hasta que tengan módulo propio (Bloques D: LlmModule, database).
@Global()
@Module({
  providers: [Db, ModelGateway],
  exports: [Db, ModelGateway],
})
export class SharedModule {}
