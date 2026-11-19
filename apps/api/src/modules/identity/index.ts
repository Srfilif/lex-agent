// Interfaz pública del módulo identity (regla 7: otros módulos solo por aquí).
export * from './identity.module';
export { AuthGuard, AuthUser } from './presentation/http/auth.guard';
export { OptionalAuthGuard } from './presentation/http/optional-auth.guard';
export { CurrentUser } from './presentation/http/current-user.decorator';
export { OptionalUser } from './presentation/http/optional-user.decorator';
export { Roles, RolesGuard } from './presentation/http/roles.guard';
export { AuthErrorFilter } from './presentation/http/auth-error.filter';
export {
  AuthError,
  credencialesInvalidas,
  cuentaNoDisponible,
  tokenInvalido,
  sesionRevocada,
  reusoDetectado,
  noAutenticado,
  prohibido,
  limiteExcedido,
  noEncontrado,
  codigoInvalido,
  totpNoConfigurado,
  totpSinPendiente,
  totpYaActivo,
  operacionNoPermitida,
  registroCerrado,
  correoNoAutorizado,
  codigoAccesoInvalido,
  mantenimiento,
} from './application/errors';
export { TOKEN_GENERATOR, TokenGenerator } from './application/ports';
export { USER_REPOSITORY, UserRepository } from './domain/repositories';
export { SECURITY_EVENT_REPOSITORY, SecurityEventRepository } from './domain/repositories';
export { ONE_TIME_TOKEN_REPOSITORY, OneTimeTokenRepository, OneTimeTokenKind } from './domain/repositories';
export { SESSION_REPOSITORY, SessionRepository } from './domain/repositories';
export { RequestMeta, PASSWORD_HASHER, PasswordHasher, EMAIL_SENDER, EmailSender } from './application/ports';
export { RATE_LIMITER, RateLimiter } from './application/ports';
export { parseEmail, parseDisplayName } from './domain/value-objects';
export { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION } from './domain/consent-versions';
