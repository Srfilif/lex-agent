// Módulo secop: lectura del caché local (controlador + servicio).
// Extraído de AppModule (Fase 1 chat) para reutilizar SecopService
// desde el módulo chat. Rutas y comportamiento intactos.
import { Module } from '@nestjs/common';
import { SharedModule } from '../shared/shared.module';
import { SecopController } from './secop.controller';
import { SecopService } from './secop.service';

@Module({
  imports: [SharedModule],
  controllers: [SecopController],
  providers: [SecopService],
  exports: [SecopService],
})
export class SecopModule {}
