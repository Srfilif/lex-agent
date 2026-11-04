// Módulo identity: cableado de puertos → adaptadores (DIP con DI nativa).
import { createHmac } from 'crypto';
import { Module } from '@nestjs/common';
import { Redis } from 'ioredis';
import { SharedModule } from '../../shared/shared.module';
import { AppConfig, CONFIG } from '../../shared/config';
import {
  ONE_TIME_TOKEN_REPOSITORY,
  RECOVERY_CODE_REPOSITORY,
  SECURITY_EVENT_REPOSITORY,
  SESSION_REPOSITORY,
  TOTP_REPOSITORY,
  USER_REPOSITORY,
} from './domain/repositories';
import {
  ACCESS_TOKENS,
  EMAIL_SENDER,
  MFA_TOKENS,
  PASSWORD_HASHER,
  RATE_LIMITER,
  SECRET_CRYPTO,
  TOKEN_GENERATOR,
  TOTP_SERVICE,
} from './application/ports';
import {
  ChangePassword,
  RequestPasswordReset,
  ResendVerification,
  ResetPassword,
  VerifyEmail,
} from './application/email-password';
import { LoginUser, RegisterUser } from './application/register-login';
import {
  ListSessions,
  Logout,
  LogoutAll,
  RefreshSession,
  RevokeSession,
} from './application/sessions';
import {
  ConfirmTotp,
  DisableTotp,
  RegenerateRecoveryCodes,
  SetupTotp,
  TotpStatus,
  VerifyMfaLogin,
} from './application/totp';
import { IssueSession } from './application/issue-session';
import {
  AdminListUsers,
  AdminResetTotp,
  AdminSetUserRole,
  AdminSetUserStatus,
} from './application/admin';
import { GetProfile } from './application/profile';
import { Hs256AccessTokens } from './infrastructure/crypto/access-token.service';
import { Hs256MfaTokens } from './infrastructure/crypto/mfa-token.service';
import { MemoryRateLimiter } from './infrastructure/crypto/rate-limiter';
import { RedisRateLimiter } from './infrastructure/crypto/redis-rate-limiter';
import { ScryptPasswordHasher } from './infrastructure/crypto/scrypt-password-hasher';
import { AesGcmSecretCrypto } from './infrastructure/crypto/secret-crypto';
import { CryptoTokenGenerator } from './infrastructure/crypto/token-generator';
import { RfcTotpService } from './infrastructure/crypto/totp.service';
import { LogEmailSender } from './infrastructure/email/log-email.sender';
import { SmtpEmailSender } from './infrastructure/email/smtp-email.sender';
import {
  PgOneTimeTokenRepository,
  PgRecoveryCodeRepository,
  PgSecurityEventRepository,
  PgSessionRepository,
  PgTotpRepository,
  PgUserRepository,
} from './infrastructure/persistence/pg-identity.repositories';
import { AccountController } from './presentation/http/account.controller';
import { AdminController } from './presentation/http/admin.controller';
import { AuthController } from './presentation/http/auth.controller';
import { AuthGuard } from './presentation/http/auth.guard';
import { OptionalAuthGuard } from './presentation/http/optional-auth.guard';
import { RolesGuard } from './presentation/http/roles.guard';
import { TotpController } from './presentation/http/totp.controller';

@Module({
  imports: [SharedModule],
  controllers: [AuthController, AccountController, TotpController, AdminController],
  providers: [
    { provide: USER_REPOSITORY, useClass: PgUserRepository },
    { provide: SESSION_REPOSITORY, useClass: PgSessionRepository },
    { provide: ONE_TIME_TOKEN_REPOSITORY, useClass: PgOneTimeTokenRepository },
    { provide: SECURITY_EVENT_REPOSITORY, useClass: PgSecurityEventRepository },
    { provide: TOTP_REPOSITORY, useClass: PgTotpRepository },
    { provide: RECOVERY_CODE_REPOSITORY, useClass: PgRecoveryCodeRepository },
    { provide: PASSWORD_HASHER, useClass: ScryptPasswordHasher },
    { provide: TOKEN_GENERATOR, useClass: CryptoTokenGenerator },
    {
      // I1: SMTP_URL → correo real; vacío → log (dev).
      provide: EMAIL_SENDER,
      inject: [CONFIG],
      useFactory: (cfg: AppConfig) =>
        cfg.smtpUrl ? new SmtpEmailSender(cfg.smtpUrl, cfg.smtpFrom) : new LogEmailSender(),
    },
    {
      // I1: REDIS_URL → ventana distribuida; vacío → memoria (1 réplica).
      provide: RATE_LIMITER,
      inject: [CONFIG],
      useFactory: (cfg: AppConfig) =>
        cfg.redisUrl
          ? new RedisRateLimiter(
              new Redis(cfg.redisUrl, { maxRetriesPerRequest: 2, enableReadyCheck: true }),
            )
          : new MemoryRateLimiter(),
    },
    {
      provide: ACCESS_TOKENS,
      inject: [CONFIG],
      useFactory: (cfg: AppConfig) =>
        new Hs256AccessTokens(cfg.auth.jwtSecret, cfg.auth.accessTtlMin),
    },
    {
      provide: TOTP_SERVICE,
      inject: [CONFIG],
      useFactory: (cfg: AppConfig) => new RfcTotpService(cfg.totp.stepSec, cfg.totp.windowSteps),
    },
    {
      provide: SECRET_CRYPTO,
      inject: [CONFIG],
      useFactory: (cfg: AppConfig) => new AesGcmSecretCrypto(cfg.totp.encryptionKeyHex),
    },
    {
      // Clave separada de la de access (§14): derivación HMAC con dominio propio.
      provide: MFA_TOKENS,
      inject: [CONFIG],
      useFactory: (cfg: AppConfig) =>
        new Hs256MfaTokens(
          createHmac('sha256', cfg.auth.jwtSecret).update('lex-mfa-v1').digest('hex'),
          cfg.totp.mfaTtlMin,
        ),
    },
    RegisterUser,
    LoginUser,
    RefreshSession,
    Logout,
    LogoutAll,
    VerifyEmail,
    ResendVerification,
    RequestPasswordReset,
    ResetPassword,
    ChangePassword,
    ListSessions,
    RevokeSession,
    GetProfile,
    IssueSession,
    SetupTotp,
    ConfirmTotp,
    TotpStatus,
    DisableTotp,
    RegenerateRecoveryCodes,
    VerifyMfaLogin,
    AdminListUsers,
    AdminSetUserStatus,
    AdminSetUserRole,
    AdminResetTotp,
    AuthGuard,
    OptionalAuthGuard,
    RolesGuard,
  ],
  exports: [AuthGuard, OptionalAuthGuard, RolesGuard, USER_REPOSITORY, SESSION_REPOSITORY, SECURITY_EVENT_REPOSITORY, ONE_TIME_TOKEN_REPOSITORY, TOKEN_GENERATOR, PASSWORD_HASHER, EMAIL_SENDER, ACCESS_TOKENS, RATE_LIMITER],
})
export class IdentityModule {}
