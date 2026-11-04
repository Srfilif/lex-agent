// Casos de uso administrativos (Fase D). Todo cambio queda auditado.
// Protecciones: nadie se deshabilita ni se cambia el rol a sí mismo.
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
import { UserRole, UserStatus } from '../domain/user';
import { noEncontrado, operacionNoPermitida } from './errors';
import { RequestMeta } from './ports';
import { publicUser } from './profile';

@Injectable()
export class AdminListUsers {
  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepository) {}

  async execute(q: { limit: number; offset: number; search: string }): Promise<Record<string, unknown>> {
    const [items, total] = await Promise.all([
      this.users.list(q),
      this.users.count(q.search),
    ]);
    return {
      total,
      limit: q.limit,
      offset: q.offset,
      users: items.map((u) => ({ ...publicUser(u), status: u.status })),
    };
  }
}

@Injectable()
export class AdminSetUserStatus {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(SECURITY_EVENT_REPOSITORY) private readonly events: SecurityEventRepository,
  ) {}

  async execute(
    adminId: string,
    userId: string,
    status: UserStatus,
    meta: RequestMeta,
  ): Promise<Record<string, unknown>> {
    if (adminId === userId) throw operacionNoPermitida('no puede cambiar su propia cuenta por aquí');
    if (status !== 'active' && status !== 'disabled') {
      throw operacionNoPermitida('estado debe ser active o disabled');
    }
    const user = await this.users.findById(userId);
    if (!user) throw noEncontrado('cuenta no encontrada');
    const now = new Date();
    if (status === 'disabled') {
      user.disable(now);
      await this.sessions.revokeAllForUser(userId, now, 'admin_bloqueo');
    } else {
      user.enable(now);
    }
    await this.users.update(user);
    await this.events.record({
      userId,
      type: status === 'disabled' ? 'admin_bloqueo' : 'admin_desbloqueo',
      success: true,
      ip: meta.ip,
      userAgent: meta.userAgent,
      meta: { admin: adminId },
    });
    return { ...publicUser(user), status: user.status };
  }
}

@Injectable()
export class AdminSetUserRole {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(SECURITY_EVENT_REPOSITORY) private readonly events: SecurityEventRepository,
  ) {}

  async execute(
    adminId: string,
    userId: string,
    role: UserRole,
    meta: RequestMeta,
  ): Promise<Record<string, unknown>> {
    if (adminId === userId) throw operacionNoPermitida('no puede cambiar su propio rol');
    if (role !== 'user' && role !== 'admin') throw operacionNoPermitida('rol debe ser user o admin');
    const user = await this.users.findById(userId);
    if (!user) throw noEncontrado('cuenta no encontrada');
    user.setRole(role, new Date());
    await this.users.update(user);
    await this.events.record({
      userId,
      type: 'admin_rol',
      success: true,
      ip: meta.ip,
      userAgent: meta.userAgent,
      meta: { admin: adminId, role },
    });
    return { ...publicUser(user), status: user.status };
  }
}

@Injectable()
export class AdminResetTotp {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(TOTP_REPOSITORY) private readonly totp: TotpRepository,
    @Inject(RECOVERY_CODE_REPOSITORY) private readonly codes: RecoveryCodeRepository,
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(SECURITY_EVENT_REPOSITORY) private readonly events: SecurityEventRepository,
  ) {}

  /** Escape hatch ante bloqueo 2FA: borra config+códigos y revoca sesiones. */
  async execute(adminId: string, userId: string, meta: RequestMeta): Promise<{ message: string }> {
    const user = await this.users.findById(userId);
    if (!user) throw noEncontrado('cuenta no encontrada');
    const now = new Date();
    await this.totp.delete(userId);
    await this.codes.replaceAll(userId, []);
    await this.sessions.revokeAllForUser(userId, now, 'admin_reset_totp');
    await this.events.record({
      userId,
      type: 'admin_reset_totp',
      success: true,
      ip: meta.ip,
      userAgent: meta.userAgent,
      meta: { admin: adminId },
    });
    return { message: '2FA restablecido; el usuario debe iniciar sesión y reconfigurarlo' };
  }
}
