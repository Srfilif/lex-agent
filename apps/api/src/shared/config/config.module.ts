import { Global, Module } from '@nestjs/common';
import { CONFIG, loadAppConfig } from './app-config';

// Módulo global: la config se valida una vez al arrancar (falla rápido).
@Global()
@Module({
  providers: [{ provide: CONFIG, useValue: loadAppConfig() }],
  exports: [CONFIG],
})
export class ConfigModule {}
