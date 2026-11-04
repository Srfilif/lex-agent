// @Roles + RolesGuard: autorización por rol (Fase D).
// Uso: @UseGuards(AuthGuard, RolesGuard) + @Roles('admin').
// Sin @Roles → permite (solo exige lo que los guards previos validaron).
// I2: con ADMIN_MFA_REQUIRED, 'admin' exige además sesión con mfa=true.
import { CanActivate, ExecutionContext, Inject, Injectable, SetMetadata } from '@nestjs/common';
import { mfaRequerido, prohibido } from '../../application/errors';
import { UserRole } from '../../domain/user';
import { AppConfig, CONFIG } from '../../../../shared/config';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);

interface RoleRequest {
  user?: { role?: UserRole; mfa?: boolean };
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(@Inject(CONFIG) private readonly cfg: AppConfig) {}

  canActivate(ctx: ExecutionContext): boolean {
    const handler = ctx.getHandler();
    const ctrl = ctx.getClass();
    const need: UserRole[] | undefined =
      Reflect.getMetadata(ROLES_KEY, handler) ?? Reflect.getMetadata(ROLES_KEY, ctrl);
    if (!need?.length) return true;
    const req = ctx.switchToHttp().getRequest<RoleRequest>();
    if (!req.user || !need.includes(req.user.role as UserRole)) throw prohibido();
    if (need.includes('admin') && this.cfg.auth.adminMfaRequired && req.user.mfa !== true) {
      throw mfaRequerido();
    }
    return true;
  }
}
