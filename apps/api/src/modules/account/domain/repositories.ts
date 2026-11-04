// Puertos propios del módulo account (export/agregación y borrado).
export const PREFERENCES_REPOSITORY = Symbol('PREFERENCES_REPOSITORY');
export const ACCOUNT_PRIVACY_REPOSITORY = Symbol('ACCOUNT_PRIVACY_REPOSITORY');
export const MEMORY_REPOSITORY = Symbol('MEMORY_REPOSITORY');

export interface PreferencesRepository {
  get(userId: string): Promise<Record<string, unknown>>;
  save(userId: string, data: Record<string, unknown>): Promise<void>;
}

export interface MemoryEntry {
  id: string;
  fact: string;
  createdAt: Date;
}

/** B8: hechos de memoria cruzada por usuario (orden de creación). */
export interface MemoryRepository {
  list(userId: string): Promise<MemoryEntry[]>;
  add(userId: string, fact: string): Promise<MemoryEntry>;
  remove(userId: string, id: string): Promise<boolean>;
  count(userId: string): Promise<number>;
  dropOldest(userId: string, keep: number): Promise<number>;
}

export interface DeletionSummary {
  sessionsRevoked: number;
  subscriptionCanceled: boolean;
  eventsAnonymized: number;
  webhooksStripped: number;
  investigationsDetached: number;
}

export interface AccountPrivacyRepository {
  /** Borrado lógico + anonimización en una transacción (ver doc retención). */
  deleteAccount(userId: string, now: Date): Promise<DeletionSummary>;
  markDeletionRequested(userId: string, now: Date): Promise<void>;
  getDeletionRequested(userId: string): Promise<Date | null>;
  clearDeletionRequested(userId: string): Promise<void>;
  /** Agregado de exportación (lectura, sin PII ajena). */
  exportData(userId: string): Promise<Record<string, unknown>>;
}
