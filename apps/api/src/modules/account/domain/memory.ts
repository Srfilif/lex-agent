// B8: reglas de memoria cruzada (puro, unit-testeable). Dueño: account.
// chat las consume vía puerto MemoryForAgent + estas reglas (igual que
// consume el dominio de billing); account nunca importa de chat.

/** Tope de hechos en user_memories (FIFO honesto). */
export const MAX_FACTS = 50;
/** Tope de caracteres por hecho (igual que el CHECK SQL). */
export const FACT_MAX_CHARS = 500;
/** Presupuesto de memoria cruzada dentro del system prompt. */
export const MEMORY_SYSTEM_CHARS = 2000;

/** Sanea un hecho (lanza Error; el llamador mapea a 400). */
export function cleanFact(raw: string): string {
  const t = raw.trim().replace(/\s+/g, ' ');
  if (!t) throw new Error('hecho vacío');
  if (t.length > FACT_MAX_CHARS) throw new Error('hecho demasiado largo (máx. 500)');
  return t;
}

/** Hechos → sufijo del system prompt (capado, numerado). */
export function renderFacts(facts: string[]): string {
  const lines = facts
    .map((f) => f.trim())
    .filter(Boolean)
    .slice(0, MAX_FACTS)
    .map((f, i) => `${i + 1}. ${f.slice(0, FACT_MAX_CHARS)}`);
  if (!lines.length) return '';
  const body = lines.join('\n').slice(0, MEMORY_SYSTEM_CHARS);
  return `\n\nMemoria del usuario (hechos guardados; úsalos cuando sean relevantes):\n${body}`;
}
