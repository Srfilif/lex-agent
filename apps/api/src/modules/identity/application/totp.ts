// Casos de uso TOTP: enrolamiento, verificación, desactivación y login MFA.
import { Inject, Injectable } from '@nestjs/common';
import {
  RECOVERY_CODE_REPOSITORY,
  RecoveryCodeRepository,
  SECURITY_EVENT_REPOSITORY,
  SESSION_REPOSITORY,
  SecurityEventRepository,
  SessionRepository,
  TOTP_REPOSITORY,
  TotpRepository,
  USER_REPOSITORY,
  UserRepository,
} from '../domain/repositories';
import { TotpConfig, normalizeRecoveryCode } from '../domain/totp';
import { User } from '../domain/user';
import {
  AuthError,
  codigoInvalido,
  limiteExcedido,
  tokenInvalido,
  totpSinPendiente,
  totpYaActivo,
} from './errors';
import { IssueSession } from './issue-session';
import {
  MFA_TOKENS,
  MfaTokens,
  PASSWORD_HASHER,
  PasswordHasher,
  RATE_LIMITER,
  RateLimiter,
  RequestMeta,
  SECRET_CRYPTO,
  SecretCrypto,
  TOKEN_GENERATOR,
  TOTP_SERVICE,
  TokenGenerator,
  TotpService,
} from './ports';
import { publicUser } from './profile';

const ISSUER = 'LexAgent';
const RECOVERY_COUNT = 10;

@Injectable()
export class SetupTotp {
  constructor(
    @Inject(TOTP_REPOSITORY) private readonly totp: TotpRepository,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(SECURITY_EVENT_REPOSITORY) private readonly events: SecurityEventRepository,
    @Inject(TOTP_SERVICE) private readonly svc: TotpService,
    @Inject(SECRET_CRYPTO) private readonly crypto: SecretCrypto,
    @Inject(RATE_LIMITER) private readonly limiter: RateLimiter,
  ) {}

  /** Inicia enrolamiento (requiere sesión válida = re-autenticado). */
  async execute(userId: string, meta: RequestMeta): Promise<Record<string, unknown>> {
    const rl = await this.limiter.consume(`totp:${userId}`, 20, 3600);
    if (!rl.allowed) throw limiteExcedido(rl.retryAfterSec);
    const existing = await this.totp.findByUser(userId);
    if (existing?.isActive) throw totpYaActivo();
    const user = await this.users.findById(userId);
    if (!user) throw tokenInvalido();
    const secret = this.svc.generateSecret();
    const now = new Date();
    // Reiniciar invalida el pendiente anterior (savePending hace upsert).
    await this.totp.savePending(TotpConfig.startPending(userId, this.crypto.encrypt(secret), now));
    await this.events.record({
      userId,
      type: 'totp_setup_iniciado',
      success: true,
      ip: meta.ip,
      userAgent: meta.userAgent,
      meta: {},
    });
    return {
      otpauth_url: this.svc.otpauthUrl(secret, user.email, ISSUER),
      // El secreto se muestra UNA vez aquí; jamás en status/perfil.
      message: 'escanee el QR o copie el secreto en su app autenticadora, luego confirme con un código',
    };
  }
}

@Injectable()
export class ConfirmTotp {
  constructor(
    @Inject(TOTP_REPOSITORY) private readonly totp: TotpRepository,
    @Inject(RECOVERY_CODE_REPOSITORY) private readonly codes: RecoveryCodeRepository,
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(SECURITY_EVENT_REPOSITORY) private readonly events: SecurityEventRepository,
    @Inject(TOTP_SERVICE) private readonly svc: TotpService,
    @Inject(SECRET_CRYPTO) private readonly crypto: SecretCrypto,
    @Inject(TOKEN_GENERATOR) private readonly gen: TokenGenerator,
    @Inject(RATE_LIMITER) private readonly limiter: RateLimiter,
  ) {}

  /** Activa 2FA tras verificar un código; emite los recovery codes (única vez). */
  async execute(
    userId: string,
    sessionId: string,
    code: string,
    meta: RequestMeta,
  ): Promise<Record<string, unknown>> {
    const rl = await this.limiter.consume(`totp:${userId}`, 20, 3600);
    if (!rl.allowed) throw limiteExcedido(rl.retryAfterSec);
    const t = await this.totp.findByUser(userId);
    if (!t || t.isActive) throw totpSinPendiente();
    const counter = this.svc.verify(this.crypto.decrypt(t.snapshot.secretEnc), code.trim());
    if (counter === null) {
      await this.events.record({
        userId,
        type: 'totp_confirm_fail',
        success: false,
        ip: meta.ip,
        userAgent: meta.userAgent,
        meta: {},
      });
      throw codigoInvalido();
    }
    const now = new Date();
    t.confirm(counter, now); // anti-replay (DomainError → 400 si se reutiliza)
    await this.totp.save(t);
    const plain = Array.from({ length: RECOVERY_COUNT }, () => this.svc.randomRecoveryCode());
    await this.codes.replaceAll(
      userId,
      plain.map((c) => this.gen.sha256hex(c.replace(/[^A-Z0-9]/g, ''))),
    );
    await this.sessions.revokeAllForUserExcept(userId, sessionId, now, 'totp_activado');
    await this.events.record({
      userId,
      type: 'totp_activado',
      success: true,
      ip: meta.ip,
      userAgent: meta.userAgent,
      meta: {},
    });
    return {
      message: '2FA activado; guarde estos códigos (se muestran una sola vez)',
      recovery_codes: plain,
    };
  }
}

@Injectable()
export class TotpStatus {
  constructor(
    @Inject(TOTP_REPOSITORY) private readonly totp: TotpRepository,
    @Inject(RECOVERY_CODE_REPOSITORY) private readonly codes: RecoveryCodeRepository,
  ) {}

  async execute(userId: string): Promise<Record<string, unknown>> {
    const t = await this.totp.findByUser(userId);
    const status = !t ? 'disabled' : t.isActive ? 'active' : 'pending';
    const left = status === 'active' ? await this.codes.countLeft(userId) : 0;
    return { status, recovery_codes_left: left };
  }
}

async function consumeSecondFactor(
  deps: {
    totp: TotpRepository;
    codes: RecoveryCodeRepository;
    svc: TotpService;
    crypto: SecretCrypto;
    gen: TokenGenerator;
  },
  user: User,
  code: string,
  now: Date,
): Promise<'totp' | 'recovery'> {
  const t = await deps.totp.findByUser(user.id);
  const trimmed = code.trim();
  // TOTP primero (6-8 dígitos); si hay config activa y casa, consume contador.
  if (t?.isActive && /^\d{6,8}$/.test(trimmed)) {
    const counter = deps.svc.verify(deps.crypto.decrypt(t.snapshot.secretEnc), trimmed);
    if (counter !== null) {
      t.consumeCounter(counter);
      await deps.totp.save(t);
      return 'totp';
    }
    // 6 dígitos con forma TOTP que no casa: 401 (no 400 de formato recovery).
    if (trimmed.length === 6) throw codigoInvalido();
    // 8 dígitos: podría ser recovery (base32 admite 2-7) → sigue abajo.
  }
  // Escape hatch: código de recuperación (un uso).
  const normalized = normalizeRecoveryCode(trimmed);
  const row = await deps.codes.findByHash(deps.gen.sha256hex(normalized));
  if (!row || row.userId !== user.id || row.usedAt) throw codigoInvalido();
  if (!(await deps.codes.markUsed(row.id, now))) throw codigoInvalido();
  return 'recovery';
}

@Injectable()
export class VerifyMfaLogin {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(TOTP_REPOSITORY) private readonly totp: TotpRepository,
    @Inject(RECOVERY_CODE_REPOSITORY) private readonly codes: RecoveryCodeRepository,
    @Inject(SECURITY_EVENT_REPOSITORY) private readonly events: SecurityEventRepository,
    @Inject(TOTP_SERVICE) private readonly svc: TotpService,
    @Inject(SECRET_CRYPTO) private readonly crypto: SecretCrypto,
    @Inject(TOKEN_GENERATOR) private readonly gen: TokenGenerator,
    @Inject(MFA_TOKENS) private readonly mfa: MfaTokens,
    @Inject(RATE_LIMITER) private readonly limiter: RateLimiter,
    private readonly issue: IssueSession,
  ) {}

  /** Segunda fase del login: mfa_token + TOTP/recovery → sesión completa. */
  async execute(
    input: { mfaToken: string; code: string; deviceLabel?: string },
    meta: RequestMeta,
  ): Promise<Record<string, unknown>> {
    const rl = await this.limiter.consume(`mfa:${meta.ip ?? 'sin-ip'}`, 10, 300);
    if (!rl.allowed) throw limiteExcedido(rl.retryAfterSec);
    const userId = this.mfa.verify(input.mfaToken);
    if (!userId) throw tokenInvalido();
    const user = await this.users.findById(userId);
    if (!user || !user.canAuthenticate()) throw tokenInvalido();
    const t = await this.totp.findByUser(user.id);
    if (!t?.isActive) throw tokenInvalido(); // se desactivó tras emitir el pre-token
    const now = new Date();
    let via: 'totp' | 'recovery';
    try {
      via = await consumeSecondFactor(
        { totp: this.totp, codes: this.codes, svc: this.svc, crypto: this.crypto, gen: this.gen },
        user,
        input.code,
        now,
      );
    } catch (e) {
      await this.events.record({
        userId: user.id,
        type: 'mfa_fail',
        success: false,
        ip: meta.ip,
        userAgent: meta.userAgent,
        meta: {},
      });
      throw e;
    }
    const issued = await this.issue.execute(user, meta, input.deviceLabel, true);
    await this.events.record({
      userId: user.id,
      type: 'login_ok',
      success: true,
      ip: meta.ip,
      userAgent: meta.userAgent,
      meta: { mfa: via },
    });
    const out: Record<string, unknown> = { ...issued, user: publicUser(user), mfa_via: via };
    if (via === 'recovery') out['recovery_codes_left'] = await this.codes.countLeft(user.id);
    return out;
  }
}

@Injectable()
export class DisableTotp {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(TOTP_REPOSITORY) private readonly totp: TotpRepository,
    @Inject(RECOVERY_CODE_REPOSITORY) private readonly codes: RecoveryCodeRepository,
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(SECURITY_EVENT_REPOSITORY) private readonly events: SecurityEventRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(TOTP_SERVICE) private readonly svc: TotpService,
    @Inject(SECRET_CRYPTO) private readonly crypto: SecretCrypto,
    @Inject(TOKEN_GENERATOR) private readonly gen: TokenGenerator,
    @Inject(RATE_LIMITER) private readonly limiter: RateLimiter,
  ) {}

  /** Desactivar exige contraseña (re-auth) + factor actual (TOTP o recovery). */
  async execute(
    userId: string,
    sessionId: string,
    input: { password: string; code: string },
    meta: RequestMeta,
  ): Promise<{ message: string }> {
    const rl = await this.limiter.consume(`totp:${userId}`, 20, 3600);
    if (!rl.allowed) throw limiteExcedido(rl.retryAfterSec);
    const user = await this.users.findById(userId);
    if (!user) throw tokenInvalido();
    const t = await this.totp.findByUser(userId);
    if (!t?.isActive) throw totpSinPendiente();
    const ok = await this.hasher.verify(input.password, user.snapshot.passwordHash);
    if (!ok) {
      await this.events.record({
        userId,
        type: 'totp_disable_fail',
        success: false,
        ip: meta.ip,
        userAgent: meta.userAgent,
        meta: {},
      });
      throw new AuthError(401, 'password_actual_incorrecta', 'la contraseña actual es incorrecta');
    }
    await consumeSecondFactor(
      { totp: this.totp, codes: this.codes, svc: this.svc, crypto: this.crypto, gen: this.gen },
      user,
      input.code,
      new Date(),
    );
    await this.totp.delete(userId);
    await this.codes.replaceAll(userId, []);
    await this.sessions.revokeAllForUserExcept(userId, sessionId, new Date(), 'totp_desactivado');
    await this.events.record({
      userId,
      type: 'totp_desactivado',
      success: true,
      ip: meta.ip,
      userAgent: meta.userAgent,
      meta: {},
    });
    return { message: '2FA desactivado' };
  }
}

@Injectable()
export class RegenerateRecoveryCodes {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(TOTP_REPOSITORY) private readonly totp: TotpRepository,
    @Inject(RECOVERY_CODE_REPOSITORY) private readonly codes: RecoveryCodeRepository,
    @Inject(SECURITY_EVENT_REPOSITORY) private readonly events: SecurityEventRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(TOTP_SERVICE) private readonly svc: TotpService,
    @Inject(SECRET_CRYPTO) private readonly crypto: SecretCrypto,
    @Inject(TOKEN_GENERATOR) private readonly gen: TokenGenerator,
    @Inject(RATE_LIMITER) private readonly limiter: RateLimiter,
  ) {}

  /** Regenerar exige contraseña + factor; invalida los códigos anteriores. */
  async execute(
    userId: string,
    input: { password: string; code: string },
    meta: RequestMeta,
  ): Promise<Record<string, unknown>> {
    const rl = await this.limiter.consume(`totp:${userId}`, 20, 3600);
    if (!rl.allowed) throw limiteExcedido(rl.retryAfterSec);
    const user = await this.users.findById(userId);
    if (!user) throw tokenInvalido();
    const t = await this.totp.findByUser(userId);
    if (!t?.isActive) throw totpSinPendiente();
    const ok = await this.hasher.verify(input.password, user.snapshot.passwordHash);
    if (!ok) throw new AuthError(401, 'password_actual_incorrecta', 'la contraseña actual es incorrecta');
    await consumeSecondFactor(
      { totp: this.totp, codes: this.codes, svc: this.svc, crypto: this.crypto, gen: this.gen },
      user,
      input.code,
      new Date(),
    );
    const plain = Array.from({ length: RECOVERY_COUNT }, () => this.svc.randomRecoveryCode());
    await this.codes.replaceAll(
      userId,
      plain.map((c) => this.gen.sha256hex(c.replace(/[^A-Z0-9]/g, ''))),
    );
    await this.events.record({
      userId,
      type: 'recovery_regenerados',
      success: true,
      ip: meta.ip,
      userAgent: meta.userAgent,
      meta: {},
    });
    return {
      message: 'códigos regenerados; los anteriores quedan invalidados (única muestra)',
      recovery_codes: plain,
    };
  }
}
