// Lectura pública de conversaciones compartidas (B9). Sin AuthGuard:
// el token opaco de 144 bits es la credencial (revocable por el dueño).
import { Controller, Get, Param, UseFilters } from '@nestjs/common';
import { AuthErrorFilter } from '../../../identity';
import { Conversations } from '../../application/conversations';

@Controller('chat/shared')
@UseFilters(AuthErrorFilter)
export class SharedChatController {
  constructor(private readonly convs: Conversations) {}

  @Get(':token')
  async get(@Param('token') token: string): Promise<Record<string, unknown>> {
    return this.convs.getShared(token.slice(0, 200));
  }
}
