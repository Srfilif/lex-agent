// B8: compactación de hilo (puro, unit-testeable).
// Los mensajes antiguos fuera de la ventana reciente se resumen una vez;
// el resumen rodante + mensajes recientes alimentan al agente.

export type CompactRole = 'user' | 'assistant';

/** Recientes que se conservan verbatim al compactar. */
export const SUMMARY_KEEP_CHARS = 16000;
/** Desborde mínimo para disparar una compactación (evita resumir de a poco). */
export const SUMMARY_BATCH_MIN_CHARS = 4000;
/** Tope del resumen rodante persistido. */
export const SUMMARY_MAX_CHARS = 4000;
/** Entrada máxima por llamada de resumen (converge en varias pasadas). */
export const SUMMARY_BATCH_CHARS = 12000;

/**
 * Toma los mensajes más antiguos hasta el tope (enteros). El resto queda
 * descubierto y se resume en siguientes pasadas (convergencia honesta).
 */
export function takeSummaryBatch(
  toSummarize: Array<{ role: CompactRole; content: string }>,
): Array<{ role: CompactRole; content: string }> {
  const out: Array<{ role: CompactRole; content: string }> = [];
  let used = 0;
  for (const m of toSummarize) {
    if (out.length > 0 && used + m.content.length > SUMMARY_BATCH_CHARS) break;
    used += m.content.length;
    out.push(m);
  }
  return out;
}

export interface CompactionPlan {
  /** Mensajes antiguos a resumir (vacío = no compactar). */
  toSummarize: Array<{ role: CompactRole; content: string }>;
  /** Recientes que se conservan verbatim. */
  keep: Array<{ role: CompactRole; content: string }>;
  /** Índice en `prev` donde empieza `keep` (= summaryCount nuevo). */
  keepStart: number;
}

/**
 * Planifica la compactación: ignora los `summaryCount` primeros (ya
 * resumidos); de los restantes conserva verbatim los últimos que quepan
 * en SUMMARY_KEEP_CHARS; el resto solo se resume si suma >= BATCH_MIN.
 */
export function planCompaction(
  prev: Array<{ role: CompactRole; content: string }>,
  summaryCount: number,
): CompactionPlan {
  const start = Math.min(Math.max(summaryCount, 0), prev.length);
  const uncovered = prev.slice(start);
  let used = 0;
  let kept = 0;
  for (let i = uncovered.length - 1; i >= 0; i--) {
    const len = (uncovered[i] as { content: string }).content.length;
    if (used + len > SUMMARY_KEEP_CHARS && kept > 0) break;
    used += len;
    kept++;
  }
  const keep = uncovered.slice(uncovered.length - kept);
  const overflow = uncovered.slice(0, uncovered.length - kept);
  const overflowChars = overflow.reduce((n, m) => n + m.content.length, 0);
  if (overflowChars < SUMMARY_BATCH_MIN_CHARS) {
    return { toSummarize: [], keep: uncovered, keepStart: start };
  }
  return { toSummarize: overflow, keep, keepStart: start + overflow.length };
}
