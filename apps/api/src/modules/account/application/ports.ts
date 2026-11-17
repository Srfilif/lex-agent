export const MEMORY_FOR_AGENT = Symbol('MEMORY_FOR_AGENT');

export interface MemoryForAgentPort {
  enabled(userId: string): Promise<boolean>;
  getFacts(userId: string): Promise<string[]>;
  addFacts(userId: string, facts: string[]): Promise<number>;
}
