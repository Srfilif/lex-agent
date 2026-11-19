// Guard Bearer: verifica el access JWT y adjunta req.user {id, sessionId, role}.
// Además exige sesión viva en DB (revocación efectiva antes de los 15 min).
import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { ACCESS_TOKENS, AccessTokens } from '../../application/ports';
import { mantenimiento, noAutenticado } from '../../application/errors';
import { SESSION_REPOSITORY, SessionRepository } from '../../domain/repositories';
import { UserRole } from '../../domain/user';
import { AppConfig, CONFIG } from '../../../../shared/config';

export interface AuthUser {
  id: string;
  sessionId: string;
  role: UserRole;
  /** I2: sesión emitida tras MFA (fuente: fila auth_sessions, no el token). */
  mfa: boolean;
}

interface GuardRequest {
  headers: Record<string, string | string[] | undefined>;
  user?: AuthUser;
  ip?: string;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(ACCESS_TOKENS) private readonly access: AccessTokens,
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(CONFIG) private readonly cfg: AppConfig,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<GuardRequest>();
    const h = req.headers['authorization'];
    const header = Array.isArray(h) ? h[0] : h;
    const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) throw noAutenticado();
    const claims = this.access.verifyAccess(token);
    if (!claims) throw noAutenticado();
    // Revocación efectiva: la sesión debe seguir activa en DB.
    const s = await this.sessions.findById(claims.sid);
    const now = new Date();
    if (
      !s ||
      s.userId !== claims.sub ||
      !s.isActive(now, this.cfg.auth.inactivityDays * 86400 * 1000)
    ) {
      throw noAutenticado();
    }
    req.user = { id: claims.sub, sessionId: claims.sid, role: claims.role, mfa: s.mfaOk };
    // Mantenimiento: bloqueo total salvo admins (incluye sesiones activas).
    if (this.cfg.access.mode === 'maintenance' && req.user.role !== 'admin') {
      throw mantenimiento();
    }
    return true;
  }
}
