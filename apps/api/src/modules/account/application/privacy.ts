// Privacidad: exportación y borrado de cuenta.
// Borrado en 2 pasos (solicitud + confirmación con contraseña y token).
// Política: borrado lógico + anonimización; facturación íntegra por
// obligación legal; auditoría anonimizada 1 año (ver ACCOUNT_AND_PREFERENCES).
import { Inject, Injectable } from '@nestjs/common';
import {
  AuthError,
  EMAIL_SENDER,
  EmailSender,
  noEncontrado,
  ONE_TIME_TOKEN_REPOSITORY,
  OneTimeTokenRepository,
  operacionNoPermitida,
  PASSWORD_HASHER,
  PasswordHasher,
  RequestMeta,
  SECURITY_EVENT_REPOSITORY,
  SecurityEventRepository,
  TOKEN_GENERATOR,
  TokenGenerator,
  USER_REPOSITORY,
  UserRepository,
} from '../../identity';
import {
  ACCOUNT_PRIVACY_REPOSITORY,
  AccountPrivacyRepository,
} from '../domain/repositories';

const DELETE_TTL_MS = 24 * 3600 * 1000;

@Injectable()
export class ExportAccount {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(ACCOUNT_PRIVACY_REPOSITORY) private readonly privacy: AccountPrivacyRepository,
    @Inject(SECURITY_EVENT_REPOSITORY) private readonly events: SecurityEventRepository,
  ) {}

  async execute(userId: string, meta: RequestMeta): Promise<Record<string, unknown>> {
    const user = await this.users.findById(userId);
    if (!user) throw noEncontrado('cuenta no encontrada');
    const data = await this.privacy.exportData(userId);
    await this.events.record({
      userId,
      type: 'cuenta_exportada',
      success: true,
      ip: meta.ip,
      userAgent: meta.userAgent,
      meta: {},
    });
    return { exported_at: new Date().toISOString(), ...data };
  }
}

@Injectable()
export class RequestAccountDelete {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(ONE_TIME_TOKEN_REPOSITORY) private readonly tokens: OneTimeTokenRepository,
    @Inject(ACCOUNT_PRIVACY_REPOSITORY) private readonly privacy: AccountPrivacyRepository,
    @Inject(SECURITY_EVENT_REPOSITORY) private readonly events: SecurityEventRepository,
    @Inject(TOKEN_GENERATOR) private readonly gen: TokenGenerator,
    @Inject(EMAIL_SENDER) private readonly email: EmailSender,
  ) {}

  async execute(userId: string, meta: RequestMeta): Promise<{ message: string }> {
    const user = await this.users.findById(userId);
    if (!user) throw noEncontrado('cuenta no encontrada');
    const message = 'si confirma, su cuenta se eliminará; revise su correo';
    const now = new Date();
    // Sin reenvío dentro de 24h (antispam sin rate-limit extra).
    const prev = await this.privacy.getDeletionRequested(userId);
    if (prev && now.getTime() - prev.getTime() < DELETE_TTL_MS) return { message };
    await this.tokens.deleteForUser(userId, 'account_delete');
    const token = this.gen.randomToken();
    await this.tokens.issue(
      userId,
      'account_delete',
      this.gen.sha256hex(token),
      new Date(now.getTime() + DELETE_TTL_MS),
    );
    await this.privacy.markDeletionRequested(userId, now);
    await this.email.send({
      to: user.email,
      subject: 'Confirme la eliminación de su cuenta LexAgent',
      text: `Eliminar su cuenta es irreversible. Su token (válido 24h), junto a su contraseña, en POST /account/delete-confirm:\n${token}`,
    });
    await this.events.record({
      userId,
      type: 'borrado_solicitado',
      success: true,
      ip: meta.ip,
      userAgent: meta.userAgent,
      meta: {},
    });
    return { message };
  }
}

@Injectable()
export class ConfirmAccountDelete {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(ONE_TIME_TOKEN_REPOSITORY) private readonly tokens: OneTimeTokenRepository,
    @Inject(ACCOUNT_PRIVACY_REPOSITORY) private readonly privacy: AccountPrivacyRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(TOKEN_GENERATOR) private readonly gen: TokenGenerator,
  ) {}

  async execute(
    userId: string,
    input: { password: string; token: string },
  ): Promise<Record<string, unknown>> {
    const user = await this.users.findById(userId);
    if (!user || !user.canAuthenticate()) throw noEncontrado('cuenta no encontrada');
    const ok = await this.hasher.verify(input.password, user.snapshot.passwordHash);
    if (!ok) {
      throw new AuthError(401, 'password_actual_incorrecta', 'la contraseña actual es incorrecta');
    }
    const now = new Date();
    const t = await this.tokens.findByHash('account_delete', this.gen.sha256hex(input.token));
    if (!t || t.consumedAt || t.expiresAt.getTime() <= now.getTime() || t.userId !== userId) {
      throw operacionNoPermitida('token inválido o expirado');
    }
    await this.tokens.consume(t.id, now);
    const summary = await this.privacy.deleteAccount(userId, now);
    return { message: 'cuenta eliminada', ...summary };
  }
}
