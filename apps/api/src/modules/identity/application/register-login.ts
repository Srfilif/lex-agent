// Casos de uso: registro e inicio de sesión.
// Anti-enumeración: registro duplicado y login fallido responden igual que el éxito.
import { Inject, Injectable } from '@nestjs/common';
import { AppConfig, CONFIG } from '../../../shared/config';
import {
  ONE_TIME_TOKEN_REPOSITORY,
  OneTimeTokenRepository,
  SECURITY_EVENT_REPOSITORY,
  SecurityEventRepository,
  TOTP_REPOSITORY,
  TotpRepository,
  USER_REPOSITORY,
  UserRepository,
} from '../domain/repositories';
import { User } from '../domain/user';
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION } from '../domain/consent-versions';
import { parseDisplayName, parseEmail, parsePassword } from '../domain/value-objects';
import {
  cuentaNoDisponible,
  credencialesInvalidas,
  limiteExcedido,
  operacionNoPermitida,
} from './errors';
import { AccessPolicy } from './access';
import { IssueSession } from './issue-session';
import {
  EMAIL_SENDER,
  EmailSender,
  MFA_TOKENS,
  MfaTokens,
  PASSWORD_HASHER,
  PasswordHasher,
  RATE_LIMITER,
  RateLimiter,
  RequestMeta,
  TOKEN_GENERATOR,
  TokenGenerator,
} from './ports';
import { publicUser } from './profile';

const VERIFY_TTL_MS = 24 * 3600 * 1000;

@Injectable()
export class RegisterUser {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(ONE_TIME_TOKEN_REPOSITORY) private readonly tokens: OneTimeTokenRepository,
    @Inject(SECURITY_EVENT_REPOSITORY) private readonly events: SecurityEventRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(TOKEN_GENERATOR) private readonly gen: TokenGenerator,
    @Inject(EMAIL_SENDER) private readonly email: EmailSender,
    @Inject(RATE_LIMITER) private readonly limiter: RateLimiter,
    private readonly access: AccessPolicy,
  ) {}

  async execute(
    input: {
      email: string;
      password: string;
      displayName?: string;
      termsAccepted: boolean;
      privacyAccepted: boolean;
      accessCode?: string | null;
    },
    meta: RequestMeta,
  ): Promise<{ message: string }> {
    if (input.termsAccepted !== true || input.privacyAccepted !== true) {
      throw operacionNoPermitida('debe aceptar los términos y autorizar el tratamiento de datos');
    }
    const rl = await this.limiter.consume(`register:${meta.ip ?? 'sin-ip'}`, 5, 3600);
    if (!rl.allowed) throw limiteExcedido(rl.retryAfterSec);
    const email = parseEmail(input.email);
    const password = parsePassword(input.password);
    const displayName = parseDisplayName(input.displayName);
    await this.access.checkRegistration(email, input.accessCode ?? null, meta);
    const existing = await this.users.findByEmail(email);
    const message = 'cuenta creada; revise su correo para verificarla';
    if (existing) {
      // Respuesta idéntica (anti-enumeración); se avisa al titular real.
      await this.events.record({
        userId: existing.id,
        type: 'register_duplicado',
        success: true,
        ip: meta.ip,
        userAgent: meta.userAgent,
        meta: {},
      });
      await this.email.send({
        to: email,
        subject: 'Intento de registro en Kelsyx',
        text: 'Alguien intentó crear una cuenta con este correo, que ya está registrado. Si fue usted, inicie sesión o recupere su contraseña.',
      });
      return { message };
    }
    const now = new Date();
    const user = await this.users.insert({
      id: this.gen.uuid(),
      email,
      displayName,
      passwordHash: await this.hasher.hash(password),
      now,
      consent: { termsVersion: CURRENT_TERMS_VERSION, privacyVersion: CURRENT_PRIVACY_VERSION },
    });
    const token = this.gen.randomToken();
    await this.tokens.issue(
      user.id,
      'email_verify',
      this.gen.sha256hex(token),
      new Date(now.getTime() + VERIFY_TTL_MS),
    );
    await this.email.send({
      to: email,
      subject: 'Verifique su cuenta de Kelsyx',
      text: `Su token de verificación (válido 24h). Envíelo a POST /auth/verify-email como {"token": "..."}:\n${token}`,
    });
    await this.events.record({
      userId: user.id,
      type: 'register_ok',
      success: true,
      ip: meta.ip,
      userAgent: meta.userAgent,
      meta: {},
    });
    return { message };
  }
}

@Injectable()
export class LoginUser {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(TOTP_REPOSITORY) private readonly totp: TotpRepository,
    @Inject(SECURITY_EVENT_REPOSITORY) private readonly events: SecurityEventRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(MFA_TOKENS) private readonly mfa: MfaTokens,
    @Inject(RATE_LIMITER) private readonly limiter: RateLimiter,
    @Inject(CONFIG) private readonly cfg: AppConfig,
    private readonly issue: IssueSession,
    private readonly access: AccessPolicy,
  ) {}

  async execute(
    input: { email: string; password: string; deviceLabel?: string },
    meta: RequestMeta,
  ): Promise<Record<string, unknown>> {
    const rl = await this.limiter.consume(`login:${meta.ip ?? 'sin-ip'}`, 10, 60);
    if (!rl.allowed) throw limiteExcedido(rl.retryAfterSec);
    const email = parseEmail(input.email);
    const user = await this.users.findByEmail(email);
    if (!user) {
      // Costo similar al verify real para no filtrar existencia por tiempo.
      await this.hasher.hash(typeof input.password === 'string' ? input.password : 'x');
      await this.events.record({
        userId: null,
        type: 'login_fail',
        success: false,
        ip: meta.ip,
        userAgent: meta.userAgent,
        meta: {},
      });
      throw credencialesInvalidas();
    }
    await this.access.checkSession(user, meta);
    await this.failUnless(user, input.password, meta);
    // Segunda fase si hay 2FA activo: pre-token, NO sesión.
    const t = await this.totp.findByUser(user.id);
    if (t?.isActive) {
      await this.events.record({
        userId: user.id,
        type: 'login_mfa_pendiente',
        success: true,
        ip: meta.ip,
        userAgent: meta.userAgent,
        meta: {},
      });
      return {
        mfa_required: true,
        mfa_token: this.mfa.issue(user.id),
        expires_in: this.cfg.totp.mfaTtlMin * 60,
      };
    }
    const issued = await this.issue.execute(user, meta, input.deviceLabel);
    await this.events.record({
      userId: user.id,
      type: 'login_ok',
      success: true,
      ip: meta.ip,
      userAgent: meta.userAgent,
      meta: {},
    });
    return { ...issued, user: publicUser(user) };
  }

  private async failUnless(user: User, password: unknown, meta: RequestMeta): Promise<void> {
    if (!user.canAuthenticate()) {
      await this.events.record({
        userId: user.id,
        type: 'login_bloqueado',
        success: false,
        ip: meta.ip,
        userAgent: meta.userAgent,
        meta: {},
      });
      throw cuentaNoDisponible();
    }
    const ok =
      typeof password === 'string' &&
      (await this.hasher.verify(password, user.snapshot.passwordHash));
    if (!ok) {
      await this.events.record({
        userId: user.id,
        type: 'login_fail',
        success: false,
        ip: meta.ip,
        userAgent: meta.userAgent,
        meta: {},
      });
      throw credencialesInvalidas();
    }
    // Rehash transparente ante subida de parámetros.
    if (typeof password === 'string' && this.hasher.needsRehash(user.snapshot.passwordHash)) {
      user.setPasswordHash(await this.hasher.hash(password), new Date());
      await this.users.update(user);
    }
  }
}
