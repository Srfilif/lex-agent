// Guard opcional: adjunta req.user si hay Bearer válido; si no, deja pasar
// como anónimo. Para endpoints legacy que atribuyen sin exigir auth (Fase E).
import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { ACCESS_TOKENS, AccessTokens } from '../../application/ports';
import { SESSION_REPOSITORY, SessionRepository } from '../../domain/repositories';
import { AppConfig, CONFIG } from '../../../../shared/config';
import { AuthUser } from './auth.guard';

interface OptRequest {
  headers: Record<string, string | string[] | undefined>;
  user?: AuthUser;
}

@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(
    @Inject(ACCESS_TOKENS) private readonly access: AccessTokens,
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(CONFIG) private readonly cfg: AppConfig,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    try {
      const req = ctx.switchToHttp().getRequest<OptRequest>();
      const h = req.headers['authorization'];
      const header = Array.isArray(h) ? h[0] : h;
      const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : '';
      if (!token) return true;
      const claims = this.access.verifyAccess(token);
      if (!claims) return true;
      const s = await this.sessions.findById(claims.sid);
      const now = new Date();
      if (
        !s ||
        s.userId !== claims.sub ||
        !s.isActive(now, this.cfg.auth.inactivityDays * 86400 * 1000)
      ) {
        return true;
      }
      req.user = { id: claims.sub, sessionId: claims.sid, role: claims.role, mfa: s.mfaOk };
    } catch {
      // Anónimo ante cualquier fallo: nunca bloquea.
    }
    return true;
  }
}
