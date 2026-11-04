// Simulador sandbox (solo provider=sandbox, 403 si no). Ver caso de uso.
import { Controller, Get, Param, Post, UseFilters } from '@nestjs/common';
import { AuthErrorFilter } from '../../../identity';
import { SandboxSimulator } from '../../application/sandbox-simulator';

@Controller('billing/sandbox/checkouts')
@UseFilters(AuthErrorFilter)
export class SandboxController {
  constructor(private readonly sim: SandboxSimulator) {}

  @Get(':id')
  async describe(@Param('id') id: string): Promise<Record<string, unknown>> {
    return this.sim.describe(id.trim().slice(0, 80));
  }

  @Post(':id/approve')
  async approve(@Param('id') id: string): Promise<Record<string, unknown>> {
    return this.sim.decide(id.trim().slice(0, 80), true);
  }

  @Post(':id/decline')
  async decline(@Param('id') id: string): Promise<Record<string, unknown>> {
    return this.sim.decide(id.trim().slice(0, 80), false);
  }
}
