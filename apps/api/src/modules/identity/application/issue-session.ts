// Emisión de sesiones compartida por login directo y login MFA.
// Extraído de LoginUser (Fase C): evict + creación + par de tokens.
import { Inject, Injectable } from '@nestjs/common';
import { AppConfig, CONFIG } from '../../../shared/config';
import {
  SESSION_REPOSITORY,
  SessionRepository,
} from '../domain/repositories';
import { AuthSession } from '../domain/session';
import { User } from '../domain/user';
import {
  ACCESS_TOKENS,
  AccessTokens,
  RequestMeta,
  TOKEN_GENERATOR,
  TokenGenerator,
} from './ports';

export interface IssuedSession {
  access_token: string;
  refresh_token: string;
  token_type: 'bearer';
  expires_in: number;
}

@Injectable()
export class IssueSession {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(TOKEN_GENERATOR) private readonly gen: TokenGenerator,
    @Inject(ACCESS_TOKENS) private readonly access: AccessTokens,
    @Inject(CONFIG) private readonly cfg: AppConfig,
  ) {}

  async execute(
    user: User,
    meta: RequestMeta,
    deviceLabel?: string,
    mfaOk = false,
  ): Promise<IssuedSession> {
    const now = new Date();
    const inactivityMs = this.cfg.auth.inactivityDays * 86400 * 1000;
    const active = (await this.sessions.listByUser(user.id)).filter((s) =>
      s.isActive(now, inactivityMs),
    );
    active.sort((a, b) => a.snapshot.lastSeenAt.getTime() - b.snapshot.lastSeenAt.getTime());
    while (active.length >= this.cfg.auth.maxSessions) {
      const oldest = active.shift();
      if (!oldest) break;
      oldest.revoke(now, 'limite_sesiones');
      await this.sessions.save(oldest);
    }
    const refresh = this.gen.randomToken();
    const session = AuthSession.create({
      id: this.gen.uuid(),
      userId: user.id,
      refreshHash: this.gen.sha256hex(refresh),
      family: this.gen.uuid(),
      expiresAt: new Date(now.getTime() + this.cfg.auth.refreshTtlDays * 86400 * 1000),
      now,
      deviceLabel: deviceLabel?.slice(0, 80) ?? null,
      userAgent: meta.userAgent?.slice(0, 300) ?? null,
      ip: meta.ip,
      mfaOk,
    });
    await this.sessions.insert(session);
    return {
      access_token: this.access.issueAccess(user.id, session.id, user.role, mfaOk),
      refresh_token: refresh,
      token_type: 'bearer',
      expires_in: this.cfg.auth.accessTtlMin * 60,
    };
  }
}
