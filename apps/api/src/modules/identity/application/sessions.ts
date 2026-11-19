// Casos de uso de sesiones: rotación, revocación y consulta.
import { Inject, Injectable } from '@nestjs/common';
import { AppConfig, CONFIG } from '../../../shared/config';
import {
  SECURITY_EVENT_REPOSITORY,
  SESSION_REPOSITORY,
  SecurityEventRepository,
  SessionRepository,
  USER_REPOSITORY,
  UserRepository,
} from '../domain/repositories';
import {
  cuentaNoDisponible,
  limiteExcedido,
  noEncontrado,
  reusoDetectado,
  sesionRevocada,
  tokenInvalido,
} from './errors';
import {
  ACCESS_TOKENS,
  AccessTokens,
  RATE_LIMITER,
  RateLimiter,
  RequestMeta,
  TOKEN_GENERATOR,
  TokenGenerator,
} from './ports';
import { AccessPolicy } from './access';

@Injectable()
export class RefreshSession {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(SECURITY_EVENT_REPOSITORY) private readonly events: SecurityEventRepository,
    @Inject(TOKEN_GENERATOR) private readonly gen: TokenGenerator,
    @Inject(ACCESS_TOKENS) private readonly access: AccessTokens,
    @Inject(RATE_LIMITER) private readonly limiter: RateLimiter,
    @Inject(CONFIG) private readonly cfg: AppConfig,
    private readonly gate: AccessPolicy,
  ) {}

  async execute(refreshToken: string, meta: RequestMeta): Promise<Record<string, unknown>> {
    const rl = await this.limiter.consume(`refresh:${meta.ip ?? 'sin-ip'}`, 60, 60);
    if (!rl.allowed) throw limiteExcedido(rl.retryAfterSec);
    const now = new Date();
    const inactivityMs = this.cfg.auth.inactivityDays * 86400 * 1000;
    const hash = this.gen.sha256hex(refreshToken);
    const s = await this.sessions.findByRefreshHash(hash);
    if (!s) {
      // ¿Reúso de un token ya rotado cuya fila original se purgó?
      const next = await this.sessions.findByPrevHash(hash);
      if (next) await this.compromise(next.family, next.userId, meta);
      throw tokenInvalido();
    }
    if (s.revoked && s.snapshot.revokeReason === 'rotada') {
      // Reutilización de refresh ya rotado → familia comprometida.
      await this.compromise(s.family, s.userId, meta);
    }
    if (s.revoked) throw sesionRevocada();
    if (s.isExpired(now) || s.isStale(now, inactivityMs)) {
      s.revoke(now, 'expirada');
      await this.sessions.save(s);
      throw tokenInvalido();
    }
    const user = await this.users.findById(s.userId);
    if (!user || !user.canAuthenticate()) {
      s.revoke(now, 'cuenta_no_disponible');
      await this.sessions.save(s);
      throw cuentaNoDisponible();
    }
    await this.gate.checkSession(user, meta);
    const nextRefresh = this.gen.randomToken();
    const next = s.rotate(now, this.gen.uuid(), this.gen.sha256hex(nextRefresh));
    await this.sessions.save(s);
    await this.sessions.insert(next);
    return {
      access_token: this.access.issueAccess(user.id, next.id, user.role, next.mfaOk),
      refresh_token: nextRefresh,
      token_type: 'bearer',
      expires_in: this.cfg.auth.accessTtlMin * 60,
    };
  }

  private async compromise(family: string, userId: string, meta: RequestMeta): Promise<never> {
    await this.sessions.revokeFamily(family, new Date(), 'reuso_detectado');
    await this.events.record({
      userId,
      type: 'refresh_reuso',
      success: false,
      ip: meta.ip,
      userAgent: meta.userAgent,
      meta: { family },
    });
    throw reusoDetectado();
  }
}

@Injectable()
export class Logout {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(SECURITY_EVENT_REPOSITORY) private readonly events: SecurityEventRepository,
    @Inject(TOKEN_GENERATOR) private readonly gen: TokenGenerator,
  ) {}

  /** Idempotente: token ausente o desconocido responde igual. */
  async execute(refreshToken: string | null, meta: RequestMeta): Promise<{ message: string }> {
    if (refreshToken) {
      const s = await this.sessions.findByRefreshHash(this.gen.sha256hex(refreshToken));
      if (s && !s.revoked) {
        s.revoke(new Date(), 'logout');
        await this.sessions.save(s);
        await this.events.record({
          userId: s.userId,
          type: 'logout',
          success: true,
          ip: meta.ip,
          userAgent: meta.userAgent,
          meta: {},
        });
      }
    }
    return { message: 'sesión terminada' };
  }
}

@Injectable()
export class LogoutAll {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(SECURITY_EVENT_REPOSITORY) private readonly events: SecurityEventRepository,
  ) {}

  async execute(userId: string, meta: RequestMeta): Promise<Record<string, unknown>> {
    const n = await this.sessions.revokeAllForUser(userId, new Date(), 'logout_all');
    await this.events.record({
      userId,
      type: 'logout_all',
      success: true,
      ip: meta.ip,
      userAgent: meta.userAgent,
      meta: { sesiones: n },
    });
    return { message: 'todas las sesiones terminadas', sesiones_revocadas: n };
  }
}

@Injectable()
export class ListSessions {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(CONFIG) private readonly cfg: AppConfig,
  ) {}

  async execute(userId: string, currentSid: string): Promise<Record<string, unknown>> {
    const now = new Date();
    const inactivityMs = this.cfg.auth.inactivityDays * 86400 * 1000;
    const list = (await this.sessions.listByUser(userId))
      .filter((s) => s.isActive(now, inactivityMs))
      .map((s) => {
        const p = s.snapshot;
        return {
          id: p.id,
          current: p.id === currentSid,
          created_at: p.createdAt.toISOString(),
          last_seen_at: p.lastSeenAt.toISOString(),
          expires_at: p.expiresAt.toISOString(),
          device_label: p.deviceLabel,
        };
      })
      .sort((a, b) => (a.last_seen_at < b.last_seen_at ? 1 : -1));
    return { sessions: list };
  }
}

@Injectable()
export class RevokeSession {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(SECURITY_EVENT_REPOSITORY) private readonly events: SecurityEventRepository,
  ) {}

  async execute(
    userId: string,
    sessionId: string,
    meta: RequestMeta,
  ): Promise<{ message: string }> {
    const s = await this.sessions.findById(sessionId);
    // 404 idéntico para "ajena" e "inexistente" (no filtrar).
    if (!s || s.userId !== userId) throw noEncontrado('sesión no encontrada');
    s.revoke(new Date(), 'manual');
    await this.sessions.save(s);
    await this.events.record({
      userId,
      type: 'session_revocada',
      success: true,
      ip: meta.ip,
      userAgent: meta.userAgent,
      meta: {},
    });
    return { message: 'sesión revocada' };
  }
}
