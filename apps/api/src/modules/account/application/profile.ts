// Perfil: display_name (whitelist estricta) y cambio de correo verificado.
import { Inject, Injectable } from '@nestjs/common';
import {
  AuthError,
  EMAIL_SENDER,
  EmailSender,
  noEncontrado,
  ONE_TIME_TOKEN_REPOSITORY,
  OneTimeTokenRepository,
  operacionNoPermitida,
  parseDisplayName,
  parseEmail,
  PASSWORD_HASHER,
  PasswordHasher,
  RequestMeta,
  SECURITY_EVENT_REPOSITORY,
  SecurityEventRepository,
  SESSION_REPOSITORY,
  SessionRepository,
  TOKEN_GENERATOR,
  TokenGenerator,
  USER_REPOSITORY,
  UserRepository,
} from '../../identity';

const EMAIL_CHANGE_TTL_MS = 24 * 3600 * 1000;

@Injectable()
export class UpdateProfile {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(SECURITY_EVENT_REPOSITORY) private readonly events: SecurityEventRepository,
  ) {}

  /** Solo display_name. Rol/plan/estado/verificación no son escribibles aquí. */
  async execute(
    userId: string,
    input: { displayName: string },
    meta: RequestMeta,
  ): Promise<Record<string, unknown>> {
    const user = await this.users.findById(userId);
    if (!user) throw noEncontrado('cuenta no encontrada');
    user.setDisplayName(parseDisplayName(input.displayName), new Date());
    await this.users.update(user);
    const p = user.snapshot;
    await this.events.record({
      userId,
      type: 'perfil_actualizado',
      success: true,
      ip: meta.ip,
      userAgent: meta.userAgent,
      meta: {},
    });
    return {
      id: p.id,
      email: p.email,
      display_name: p.displayName,
      email_verified: p.emailVerifiedAt !== null,
      role: p.role,
      created_at: p.createdAt.toISOString(),
    };
  }
}

@Injectable()
export class RequestEmailChange {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(ONE_TIME_TOKEN_REPOSITORY) private readonly tokens: OneTimeTokenRepository,
    @Inject(SECURITY_EVENT_REPOSITORY) private readonly events: SecurityEventRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(TOKEN_GENERATOR) private readonly gen: TokenGenerator,
    @Inject(EMAIL_SENDER) private readonly email: EmailSender,
  ) {}

  /** Re-autentica con contraseña y envía verificación a la NUEVA dirección. */
  async execute(
    userId: string,
    input: { password: string; newEmail: string },
    meta: RequestMeta,
  ): Promise<{ message: string }> {
    const user = await this.users.findById(userId);
    if (!user) throw noEncontrado('cuenta no encontrada');
    const ok = await this.hasher.verify(input.password, user.snapshot.passwordHash);
    if (!ok) throw new AuthError(401, 'password_actual_incorrecta', 'la contraseña actual es incorrecta');
    const next = parseEmail(input.newEmail);
    if (next === user.email) throw operacionNoPermitida('es su correo actual');
    const taken = await this.users.findByEmail(next);
    // 409 revela existencia, pero es cuenta autenticada cambiando a dirección
    // concreta (estándar; documentado en ACCOUNT_AND_PREFERENCES.md).
    if (taken) throw new AuthError(409, 'email_en_uso', 'ese correo ya está registrado');
    const now = new Date();
    await this.tokens.deleteForUser(userId, 'email_change');
    const token = this.gen.randomToken();
    await this.tokens.issue(
      userId,
      'email_change',
      this.gen.sha256hex(token),
      new Date(now.getTime() + EMAIL_CHANGE_TTL_MS),
      next,
    );
    await this.email.send({
      to: next,
      subject: 'Confirme su nuevo correo de LexAgent',
      text: `Su token de confirmación (válido 24h). Envíelo a POST /account/email/confirm como {"token": "..."}:\n${token}`,
    });
    await this.events.record({
      userId,
      type: 'email_change_solicitado',
      success: true,
      ip: meta.ip,
      userAgent: meta.userAgent,
      meta: {},
    });
    return { message: 'revise su nuevo correo para confirmar el cambio' };
  }
}

@Injectable()
export class ConfirmEmailChange {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(ONE_TIME_TOKEN_REPOSITORY) private readonly tokens: OneTimeTokenRepository,
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(SECURITY_EVENT_REPOSITORY) private readonly events: SecurityEventRepository,
    @Inject(TOKEN_GENERATOR) private readonly gen: TokenGenerator,
  ) {}

  async execute(
    userId: string,
    sessionId: string,
    token: string,
    meta: RequestMeta,
  ): Promise<Record<string, unknown>> {
    const now = new Date();
    const t = await this.tokens.findByHash('email_change', this.gen.sha256hex(token));
    if (!t || t.consumedAt || t.expiresAt.getTime() <= now.getTime() || t.userId !== userId) {
      throw operacionNoPermitida('token inválido o expirado');
    }
    if (!t.newEmail) throw operacionNoPermitida('token inválido o expirado');
    const user = await this.users.findById(userId);
    if (!user) throw noEncontrado('cuenta no encontrada');
    const taken = await this.users.findByEmail(t.newEmail);
    if (taken && taken.id !== userId) {
      throw new AuthError(409, 'email_en_uso', 'ese correo ya está registrado');
    }
    await this.tokens.consume(t.id, now);
    user.setEmail(t.newEmail, now);
    await this.users.update(user);
    // Cambio de correo invalida las demás sesiones (conserva la actual).
    await this.sessions.revokeAllForUserExcept(userId, sessionId, now, 'cambio_email');
    await this.events.record({
      userId,
      type: 'email_change_ok',
      success: true,
      ip: meta.ip,
      userAgent: meta.userAgent,
      meta: {},
    });
    return { message: 'correo actualizado', email: user.email };
  }
}
