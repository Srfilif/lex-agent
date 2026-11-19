// Control de acceso a la plataforma: puerta de registro + administración.
// Modo activo en ACCESS_MODE (.env, requiere reinicio). Login y sesiones de
// cuentas existentes no se restringen: solo el registro de cuentas nuevas.
import { randomBytes } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { AppConfig, CONFIG } from '../../../shared/config';
import { AccessMode } from '../../../shared/config/access-mode';
import {
  ACCESS_CODE_REPOSITORY,
  AccessCodeRepository,
  SECURITY_EVENT_REPOSITORY,
  SecurityEventRepository,
  WHITELIST_REPOSITORY,
  WhitelistRepository,
} from '../domain/repositories';
import {
  formatAccessCode,
  matchWhitelist,
  normalizeAccessCode,
  parseWhitelistPattern,
} from '../domain/access';
import { User } from '../domain/user';
import {
  codigoAccesoInvalido,
  correoNoAutorizado,
  mantenimiento,
  noEncontrado,
  operacionNoPermitida,
  registroCerrado,
} from './errors';
import { RequestMeta, TOKEN_GENERATOR, TokenGenerator } from './ports';

export interface AccessModeState {
  mode: AccessMode;
  registration: AccessMode;
  code_required: boolean;
  whitelist_required: boolean;
}

@Injectable()
export class AccessPolicy {
  constructor(
    @Inject(CONFIG) private readonly cfg: AppConfig,
    @Inject(WHITELIST_REPOSITORY) private readonly whitelist: WhitelistRepository,
    @Inject(ACCESS_CODE_REPOSITORY) private readonly codes: AccessCodeRepository,
    @Inject(TOKEN_GENERATOR) private readonly gen: TokenGenerator,
    @Inject(SECURITY_EVENT_REPOSITORY) private readonly events: SecurityEventRepository,
  ) {}

  mode(): AccessMode {
    return this.cfg.access.mode;
  }

  state(): AccessModeState {
    const mode = this.cfg.access.mode;
    return {
      mode,
      registration: mode,
      code_required: mode === 'code',
      whitelist_required: mode === 'whitelist',
    };
  }

  /** Puerta del registro: lanza si el modo no admite este registro. */
  async checkRegistration(email: string, accessCode: string | null, meta: RequestMeta): Promise<void> {
    const mode = this.cfg.access.mode;
    if (mode === 'public') return;
    if (mode === 'maintenance') throw mantenimiento();
    if (mode === 'closed') throw registroCerrado();
    if (mode === 'whitelist') {
      const patterns = [...this.cfg.access.whitelist, ...(await this.whitelist.patterns())];
      if (!matchWhitelist(email, patterns)) {
        await this.events.record({
          userId: null,
          type: 'registro_no_autorizado',
          success: false,
          ip: meta.ip,
          userAgent: meta.userAgent,
          meta: { mode },
        });
        throw correoNoAutorizado();
      }
      return;
    }
    // mode === 'code'
    const code = normalizeAccessCode(accessCode);
    if (!code) throw codigoAccesoInvalido();
    const staticCode = normalizeAccessCode(this.cfg.access.staticCode);
    if (staticCode && code === staticCode) return; // código único del .env
    const found = await this.codes.findByHash(this.gen.sha256hex(code));
    const now = Date.now();
    const usable =
      found !== null &&
      found.revokedAt === null &&
      (found.expiresAt === null || found.expiresAt.getTime() > now) &&
      found.usedCount < found.maxUses;
    if (!usable || found === null || !(await this.codes.consume(found.id))) {
      await this.events.record({
        userId: null,
        type: 'registro_codigo_invalido',
        success: false,
        ip: meta.ip,
        userAgent: meta.userAgent,
        meta: { mode },
      });
      throw codigoAccesoInvalido();
    }
  }

  /**
   * Puerta de sesiones (login y refresh): lanza si el modo no admite que esta
   * cuenta inicie o renueve sesión. Los admins pasan siempre (operación).
   */
  async checkSession(user: User, meta: RequestMeta): Promise<void> {
    if (user.role === 'admin') return;
    const mode = this.cfg.access.mode;
    if (mode === 'maintenance') {
      await this.events.record({
        userId: user.id,
        type: 'sesion_mantenimiento_denegada',
        success: false,
        ip: meta.ip,
        userAgent: meta.userAgent,
        meta: { mode },
      });
      throw mantenimiento();
    }
    if (mode === 'whitelist') {
      const patterns = [...this.cfg.access.whitelist, ...(await this.whitelist.patterns())];
      if (!matchWhitelist(user.email, patterns)) {
        await this.events.record({
          userId: user.id,
          type: 'sesion_whitelist_denegada',
          success: false,
          ip: meta.ip,
          userAgent: meta.userAgent,
          meta: { mode },
        });
        throw correoNoAutorizado();
      }
    }
  }
}

export interface CodeCreated {
  id: string;
  code: string;
  label: string | null;
  max_uses: number;
  expires_at: string | null;
}

@Injectable()
export class AccessAdmin {
  constructor(
    @Inject(CONFIG) private readonly cfg: AppConfig,
    @Inject(WHITELIST_REPOSITORY) private readonly whitelist: WhitelistRepository,
    @Inject(ACCESS_CODE_REPOSITORY) private readonly codes: AccessCodeRepository,
    @Inject(TOKEN_GENERATOR) private readonly gen: TokenGenerator,
    @Inject(SECURITY_EVENT_REPOSITORY) private readonly events: SecurityEventRepository,
  ) {}

  async modeState(): Promise<Record<string, unknown>> {
    const [entries, all] = await Promise.all([this.whitelist.list(), this.codes.list()]);
    return {
      mode: this.cfg.access.mode,
      static_code_configured: this.cfg.access.staticCode !== '',
      env_whitelist_count: this.cfg.access.whitelist.length,
      db_whitelist_count: entries.length,
      db_codes_active: all.filter(
        (c) => c.revokedAt === null && c.usedCount < c.maxUses,
      ).length,
    };
  }

  async listWhitelist(): Promise<Record<string, unknown>> {
    const entries = await this.whitelist.list();
    return {
      entries: entries.map((e) => ({
        id: e.id,
        pattern: e.pattern,
        label: e.label,
        created_at: e.createdAt.toISOString(),
      })),
    };
  }

  async addWhitelist(
    adminId: string,
    input: { pattern: string; label?: string },
    meta: RequestMeta,
  ): Promise<Record<string, unknown>> {
    const pattern = parseWhitelistPattern(input.pattern);
    const label = (input.label ?? '').trim().slice(0, 80) || null;
    try {
      const e = await this.whitelist.add(this.gen.uuid(), pattern, label, adminId);
      await this.events.record({
        userId: adminId,
        type: 'whitelist_agregada',
        success: true,
        ip: meta.ip,
        userAgent: meta.userAgent,
        meta: { pattern },
      });
      return { id: e.id, pattern: e.pattern, label: e.label };
    } catch {
      throw operacionNoPermitida('ese patrón ya está en la whitelist');
    }
  }

  async removeWhitelist(adminId: string, id: string, meta: RequestMeta): Promise<{ message: string }> {
    const ok = await this.whitelist.remove(id);
    if (!ok) throw noEncontrado('entrada no encontrada');
    await this.events.record({
      userId: adminId,
      type: 'whitelist_eliminada',
      success: true,
      ip: meta.ip,
      userAgent: meta.userAgent,
      meta: { id },
    });
    return { message: 'entrada eliminada' };
  }

  async listCodes(): Promise<Record<string, unknown>> {
    const all = await this.codes.list();
    return {
      codes: all.map((c) => ({
        id: c.id,
        label: c.label,
        max_uses: c.maxUses,
        used_count: c.usedCount,
        expires_at: c.expiresAt ? c.expiresAt.toISOString() : null,
        revoked_at: c.revokedAt ? c.revokedAt.toISOString() : null,
        created_at: c.createdAt.toISOString(),
      })),
    };
  }

  async createCode(
    adminId: string,
    input: { label?: string; maxUses?: number; expiresInDays?: number | null },
    meta: RequestMeta,
  ): Promise<CodeCreated> {
    const maxUses = input.maxUses ?? 1;
    if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 10000) {
      throw operacionNoPermitida('maxUses debe estar entre 1 y 10000');
    }
    const days = input.expiresInDays ?? null;
    if (days !== null && (!Number.isInteger(days) || days < 1 || days > 3650)) {
      throw operacionNoPermitida('expiresInDays debe estar entre 1 y 3650');
    }
    const code = formatAccessCode(randomBytes(12));
    const c = await this.codes.insert({
      id: this.gen.uuid(),
      codeHash: this.gen.sha256hex(code),
      label: (input.label ?? '').trim().slice(0, 80) || null,
      maxUses,
      expiresAt: days === null ? null : new Date(Date.now() + days * 86400 * 1000),
      createdBy: adminId,
    });
    await this.events.record({
      userId: adminId,
      type: 'codigo_creado',
      success: true,
      ip: meta.ip,
      userAgent: meta.userAgent,
      meta: { id: c.id, maxUses },
    });
    return {
      id: c.id,
      code, // único momento en que existe en claro: no se almacena
      label: c.label,
      max_uses: c.maxUses,
      expires_at: c.expiresAt ? c.expiresAt.toISOString() : null,
    };
  }

  async revokeCode(adminId: string, id: string, meta: RequestMeta): Promise<{ message: string }> {
    const ok = await this.codes.revoke(id, new Date());
    if (!ok) throw noEncontrado('código no encontrado o ya revocado');
    await this.events.record({
      userId: adminId,
      type: 'codigo_revocado',
      success: true,
      ip: meta.ip,
      userAgent: meta.userAgent,
      meta: { id },
    });
    return { message: 'código revocado' };
  }
}
