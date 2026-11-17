import { Global, Module } from '@nestjs/common';
import { Db } from '../db';
import { ModelGateway } from './llm/model-gateway';
import { LLM_CHAT } from './llm';

// Núcleo compartido: conexión de datos y adaptador LLM. La aplicación consume
// los puertos (`LLM_CHAT`), no las clases concretas.
@Global()
@Module({
  providers: [Db, ModelGateway, { provide: LLM_CHAT, useExisting: ModelGateway }],
  exports: [Db, ModelGateway, LLM_CHAT],
})
export class SharedModule {}
