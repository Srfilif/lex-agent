// B8: memoria cruzada opt-in. CRUD de usuario + puerto para el agente.
// Sin ai.crossMemory=true no se lee ni se escribe memoria entre hilos.
import { Inject, Injectable } from '@nestjs/common';
import { USER_REPOSITORY, UserRepository, noEncontrado, operacionNoPermitida } from '../../identity';
import { cleanFact, MAX_FACTS } from '../domain/memory';
import { parsePreferences } from '../domain/preferences';
import {
  MEMORY_REPOSITORY,
  MemoryEntry,
  MemoryRepository,
  PREFERENCES_REPOSITORY,
  PreferencesRepository,
} from '../domain/repositories';

function pub(m: MemoryEntry): Record<string, unknown> {
  return { id: m.id, fact: m.fact, created_at: m.createdAt.toISOString() };
}

@Injectable()
export class Memories {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(MEMORY_REPOSITORY) private readonly mems: MemoryRepository,
  ) {}

  private async owned(userId: string): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user) throw noEncontrado('cuenta no encontrada');
  }

  async list(userId: string): Promise<Record<string, unknown>> {
    await this.owned(userId);
    const facts = await this.mems.list(userId);
    return { memories: facts.map(pub), max: MAX_FACTS };
  }

  async add(userId: string, fact: string): Promise<Record<string, unknown>> {
    await this.owned(userId);
    let clean: string;
    try {
      clean = cleanFact(fact);
    } catch {
      throw operacionNoPermitida('hecho inválido (1–500 caracteres)');
    }
    const saved = await this.mems.add(userId, clean);
    await this.mems.dropOldest(userId, MAX_FACTS);
    return { memory: pub(saved) };
  }

  async remove(userId: string, id: string): Promise<{ message: string }> {
    await this.owned(userId);
    const ok = await this.mems.remove(userId, id);
    if (!ok) throw noEncontrado('recuerdo no encontrado');
    return { message: 'recuerdo eliminado' };
  }
}

/** Puerto para el chat (mirror de BillingForAgent): respeta el opt-in. */
@Injectable()
export class MemoryForAgent {
  constructor(
    @Inject(MEMORY_REPOSITORY) private readonly mems: MemoryRepository,
    @Inject(PREFERENCES_REPOSITORY) private readonly prefs: PreferencesRepository,
  ) {}

  async enabled(userId: string): Promise<boolean> {
    return parsePreferences(await this.prefs.get(userId), {}).ai.crossMemory;
  }

  /** Hechos para inyectar al prompt ([] si opt-out). */
  async getFacts(userId: string): Promise<string[]> {
    if (!(await this.enabled(userId))) return [];
    return (await this.mems.list(userId)).map((m) => m.fact);
  }

  /**
   * Guarda hechos extraídos (0 si opt-out). Sanea, dedup exacto
   * insensible a mayúsculas y aplica el tope FIFO. Devuelve guardados.
   */
  async addFacts(userId: string, facts: string[]): Promise<number> {
    if (!(await this.enabled(userId))) return 0;
    const seen = new Set((await this.mems.list(userId)).map((m) => m.fact.toLowerCase()));
    let saved = 0;
    for (const raw of facts.slice(0, 10)) {
      let clean: string;
      try {
        clean = cleanFact(raw);
      } catch {
        continue;
      }
      if (seen.has(clean.toLowerCase())) continue;
      seen.add(clean.toLowerCase());
      await this.mems.add(userId, clean);
      saved++;
    }
    if (saved) await this.mems.dropOldest(userId, MAX_FACTS);
    return saved;
  }
}
