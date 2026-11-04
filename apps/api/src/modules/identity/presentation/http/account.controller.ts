// Controlador /account (Fase B: perfil; preferencias en Fase G).
import { Controller, Get, UseFilters, UseGuards } from '@nestjs/common';
import { GetProfile } from '../../application/profile';
import { AuthErrorFilter } from './auth-error.filter';
import { AuthGuard, AuthUser } from './auth.guard';
import { CurrentUser } from './current-user.decorator';

@Controller('account')
@UseFilters(AuthErrorFilter)
export class AccountController {
  constructor(private readonly profile: GetProfile) {}

  @Get('me')
  @UseGuards(AuthGuard)
  async me(@CurrentUser() user: AuthUser): Promise<Record<string, unknown>> {
    return this.profile.execute(user.id);
  }
}
