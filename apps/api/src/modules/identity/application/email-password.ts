// Casos de uso: verificación de correo y contraseñas.
// Recuperación y reenvío responden igual exista o no la cuenta.
import { Inject, Injectable } from '@nestjs/common';
import {
  ONE_TIME_TOKEN_REPOSITORY,
  OneTimeTokenRepository,
  SECURITY_EVENT_REPOSITORY,
  SESSION_REPOSITORY,
  SecurityEventRepository,
  SessionRepository,
  USER_REPOSITORY,
  UserRepository,
} from '../domain/repositories';
import { parseEmail, parsePassword } from '../domain/value-objects';
import {
  AuthError,
  credencialesInvalidas,
  limiteExcedido,
  tokenInvalido,
} from './errors';
import {
  EMAIL_SENDER,
  EmailSender,
  PASSWORD_HASHER,
  PasswordHasher,
  RATE_LIMITER,
  RateLimiter,
  RequestMeta,
  TOKEN_GENERATOR,
  TokenGenerator,
} from './ports';

const VERIFY_TTL_MS = 24 * 3600 * 1000;
const RESET_TTL_MS = 3600 * 1000;

@Injectable()
export class VerifyEmail {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(ONE_TIME_TOKEN_REPOSITORY) private readonly tokens: OneTimeTokenRepository,
    @Inject(SECURITY_EVENT_REPOSITORY) private readonly events: SecurityEventRepository,
    @Inject(TOKEN_GENERATOR) private readonly gen: TokenGenerator,
    @Inject(RATE_LIMITER) private readonly limiter: RateLimiter,
  ) {}

  async execute(token: string, meta: RequestMeta): Promise<{ message: string }> {
    const rl = await this.limiter.consume(`verify:${meta.ip ?? 'sin-ip'}`, 30, 3600);
    if (!rl.allowed) throw limiteExcedido(rl.retryAfterSec);
    const now = new Date();
    const t = await this.tokens.findByHash('email_verify', this.gen.sha256hex(token));
    if (!t || t.consumedAt || t.expiresAt.getTime() <= now.getTime()) {
      throw tokenInvalido();
    }
    const user = await this.users.findById(t.userId);
    if (!user) throw tokenInvalido();
    await this.tokens.consume(t.id, now);
    user.verifyEmail(now);
    await this.users.update(user);
    await this.events.record({
      userId: user.id,
      type: 'email_verificado',
      success: true,
      ip: meta.ip,
      userAgent: meta.userAgent,
      meta: {},
    });
    return { message: 'correo verificado' };
  }
}

@Injectable()
export class ResendVerification {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(ONE_TIME_TOKEN_REPOSITORY) private readonly tokens: OneTimeTokenRepository,
    @Inject(TOKEN_GENERATOR) private readonly gen: TokenGenerator,
    @Inject(EMAIL_SENDER) private readonly email: EmailSender,
    @Inject(RATE_LIMITER) private readonly limiter: RateLimiter,
  ) {}

  async execute(email: string, meta: RequestMeta): Promise<{ message: string }> {
    const rl = await this.limiter.consume(`resend:${meta.ip ?? 'sin-ip'}`, 5, 3600);
    if (!rl.allowed) throw limiteExcedido(rl.retryAfterSec);
    const message = 'si existe una cuenta sin verificar, se envió un correo';
    let user = null;
    try {
      user = await this.users.findByEmail(parseEmail(email));
    } catch {
      return { message };
    }
    if (!user || !user.canAuthenticate() || user.emailVerified) return { message };
    const now = new Date();
    await this.tokens.deleteForUser(user.id, 'email_verify');
    const token = this.gen.randomToken();
    await this.tokens.issue(
      user.id,
      'email_verify',
      this.gen.sha256hex(token),
      new Date(now.getTime() + VERIFY_TTL_MS),
    );
    await this.email.send({
      to: user.email,
      subject: 'Verifique su cuenta de LexAgent',
      text: `Su token de verificación (válido 24h). Envíelo a POST /auth/verify-email como {"token": "..."}:\n${token}`,
    });
    return { message };
  }
}

@Injectable()
export class RequestPasswordReset {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(ONE_TIME_TOKEN_REPOSITORY) private readonly tokens: OneTimeTokenRepository,
    @Inject(SECURITY_EVENT_REPOSITORY) private readonly events: SecurityEventRepository,
    @Inject(TOKEN_GENERATOR) private readonly gen: TokenGenerator,
    @Inject(EMAIL_SENDER) private readonly email: EmailSender,
    @Inject(RATE_LIMITER) private readonly limiter: RateLimiter,
  ) {}

  async execute(email: string, meta: RequestMeta): Promise<{ message: string }> {
    const rl = await this.limiter.consume(`forgot:${meta.ip ?? 'sin-ip'}`, 5, 3600);
    if (!rl.allowed) throw limiteExcedido(rl.retryAfterSec);
    const message = 'si existe una cuenta con ese correo, se envió un enlace';
    let user = null;
    try {
      user = await this.users.findByEmail(parseEmail(email));
    } catch {
      return { message };
    }
    if (!user || !user.canAuthenticate()) return { message };
    const now = new Date();
    await this.tokens.deleteForUser(user.id, 'password_reset');
    const token = this.gen.randomToken();
    await this.tokens.issue(
      user.id,
      'password_reset',
      this.gen.sha256hex(token),
      new Date(now.getTime() + RESET_TTL_MS),
    );
    await this.email.send({
      to: user.email,
      subject: 'Recupere su contraseña de LexAgent',
      text: `Su token de recuperación (válido 1h). Envíelo a POST /auth/reset-password junto a la nueva contraseña:\n${token}`,
    });
    await this.events.record({
      userId: user.id,
      type: 'reset_solicitado',
      success: true,
      ip: meta.ip,
      userAgent: meta.userAgent,
      meta: {},
    });
    return { message };
  }
}

@Injectable()
export class ResetPassword {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(ONE_TIME_TOKEN_REPOSITORY) private readonly tokens: OneTimeTokenRepository,
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(SECURITY_EVENT_REPOSITORY) private readonly events: SecurityEventRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(TOKEN_GENERATOR) private readonly gen: TokenGenerator,
    @Inject(RATE_LIMITER) private readonly limiter: RateLimiter,
  ) {}

  async execute(
    input: { token: string; password: string },
    meta: RequestMeta,
  ): Promise<{ message: string }> {
    const rl = await this.limiter.consume(`reset:${meta.ip ?? 'sin-ip'}`, 20, 3600);
    if (!rl.allowed) throw limiteExcedido(rl.retryAfterSec);
    const password = parsePassword(input.password);
    const now = new Date();
    const t = await this.tokens.findByHash('password_reset', this.gen.sha256hex(input.token));
    if (!t || t.consumedAt || t.expiresAt.getTime() <= now.getTime()) {
      throw tokenInvalido();
    }
    const user = await this.users.findById(t.userId);
    if (!user || !user.canAuthenticate()) throw tokenInvalido();
    user.setPasswordHash(await this.hasher.hash(password), now);
    await this.users.update(user);
    await this.tokens.consume(t.id, now);
    await this.tokens.deleteForUser(user.id, 'password_reset');
    await this.sessions.revokeAllForUser(user.id, now, 'reset_password');
    await this.events.record({
      userId: user.id,
      type: 'password_reset_ok',
      success: true,
      ip: meta.ip,
      userAgent: meta.userAgent,
      meta: {},
    });
    return { message: 'contraseña actualizada; inicie sesión de nuevo' };
  }
}

@Injectable()
export class ChangePassword {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(SECURITY_EVENT_REPOSITORY) private readonly events: SecurityEventRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
  ) {}

  /** Cambio con reautenticación (contraseña actual). Revoca las demás sesiones. */
  async execute(
    userId: string,
    sessionId: string,
    input: { current: string; next: string },
    meta: RequestMeta,
  ): Promise<{ message: string }> {
    const user = await this.users.findById(userId);
    if (!user || !user.canAuthenticate()) throw credencialesInvalidas();
    const ok =
      typeof input.current === 'string' &&
      (await this.hasher.verify(input.current, user.snapshot.passwordHash));
    if (!ok) {
      await this.events.record({
        userId,
        type: 'password_change_fail',
        success: false,
        ip: meta.ip,
        userAgent: meta.userAgent,
        meta: {},
      });
      throw new AuthError(401, 'password_actual_incorrecta', 'la contraseña actual es incorrecta');
    }
    const now = new Date();
    user.setPasswordHash(await this.hasher.hash(parsePassword(input.next)), now);
    await this.users.update(user);
    await this.sessions.revokeAllForUserExcept(userId, sessionId, now, 'cambio_password');
    await this.events.record({
      userId,
      type: 'password_change_ok',
      success: true,
      ip: meta.ip,
      userAgent: meta.userAgent,
      meta: {},
    });
    return { message: 'contraseña actualizada' };
  }
}
