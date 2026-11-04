// Preferencias persistentes. El modelo IA se valida contra el plan
// (una preferencia jamás concede acceso): EffectivePlanResolver.
import { Inject, Injectable } from '@nestjs/common';
import {
  noEncontrado,
  operacionNoPermitida,
  USER_REPOSITORY,
  UserRepository,
} from '../../identity';
import { EffectivePlanResolver, modelosPermitidos } from '../../billing';
import { DEFAULT_PREFERENCES, parsePreferences, Preferences } from '../domain/preferences';
import { PREFERENCES_REPOSITORY, PreferencesRepository } from '../domain/repositories';

@Injectable()
export class GetPreferences {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PREFERENCES_REPOSITORY) private readonly prefs: PreferencesRepository,
  ) {}

  async execute(userId: string): Promise<Preferences> {
    const user = await this.users.findById(userId);
    if (!user) throw noEncontrado('cuenta no encontrada');
    return parsePreferences(await this.prefs.get(userId), {});
  }
}

@Injectable()
export class UpdatePreferences {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PREFERENCES_REPOSITORY) private readonly prefs: PreferencesRepository,
    private readonly effective: EffectivePlanResolver,
  ) {}

  async execute(userId: string, patch: Record<string, unknown>): Promise<Preferences> {
    const user = await this.users.findById(userId);
    if (!user) throw noEncontrado('cuenta no encontrada');
    const merged = parsePreferences(await this.prefs.get(userId), patch);
    if (merged.ai.model !== null) {
      const e = await this.effective.resolve(userId, new Date());
      if (!modelosPermitidos(e.entitlements).includes(merged.ai.model)) {
        throw operacionNoPermitida('modelo no permitido para su plan');
      }
    }
    await this.prefs.save(userId, merged as unknown as Record<string, unknown>);
    return merged;
  }
}

export { DEFAULT_PREFERENCES };
