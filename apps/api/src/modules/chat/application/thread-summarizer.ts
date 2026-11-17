// B8: resumen rodante de hilo + extracción de hechos (opt-in).
// Se dispara cuando el desborde supera el mínimo; el fallo degrada al
// truncado clásico (el siguiente mensaje reintenta). Sin fallbacks de
// modelo: el resumen nunca debe romper un chat (B11: llamadas baratas).
import { Inject, Injectable } from '@nestjs/common';
import { ChatMsg, LLM_CHAT, LlmChatPort } from '../../../shared/llm';
import { balancedJson } from '../../../shared/json/balanced';
import { MEMORY_FOR_AGENT, MemoryForAgentPort } from '../../account';
import { Conversation } from '../domain/conversation';
import { planCompaction, SUMMARY_MAX_CHARS, takeSummaryBatch } from '../domain/memory';
import { CONVERSATION_REPOSITORY, ConversationRepository } from '../domain/repositories';

const SUMMARY_TOKENS = 2500;

export interface ParsedSummary {
  resumen: string;
  hechos: string[];
}

/**
 * Parseo defensivo de la respuesta del resumidor (puro, unit-testeable):
 * JSON {resumen, hechos[]} si hay; si no, todo el texto es el resumen.
 * null = vacío inutilizable (el llamador degrada a truncado).
 */
export function parseSummaryResponse(text: string): ParsedSummary | null {
  const t = text.trim();
  if (!t) return null;
  const bal = balancedJson(t);
  if (bal) {
    try {
      const j = JSON.parse(bal) as { resumen?: unknown; hechos?: unknown };
      const resumen = typeof j.resumen === 'string' ? j.resumen.trim().slice(0, SUMMARY_MAX_CHARS) : '';
      const hechos = Array.isArray(j.hechos)
        ? j.hechos.filter((h): h is string => typeof h === 'string' && !!h.trim()).map((h) => h.trim())
        : [];
      if (resumen) return { resumen, hechos: hechos.slice(0, 10) };
    } catch {
      // cae al texto plano
    }
  }
  return { resumen: t.slice(0, SUMMARY_MAX_CHARS), hechos: [] };
}

function numbered(ms: Array<{ role: string; content: string }>): string {
  return ms
    .map((m, i) => `[${i + 1}:${m.role}]\n${m.content.slice(0, 6000)}`)
    .join('\n\n');
}

export interface CompactionResult {
  summary: string | null;
  summaryCount: number;
  usage: { prompt: number; completion: number; total: number };
}

const USO_CERO = { prompt: 0, completion: 0, total: 0 };

@Injectable()
export class ThreadSummarizer {
  constructor(
    @Inject(LLM_CHAT) private readonly gateway: LlmChatPort,
    @Inject(CONVERSATION_REPOSITORY) private readonly convs: ConversationRepository,
    @Inject(MEMORY_FOR_AGENT) private readonly memory: MemoryForAgentPort,
  ) {}

  /**
   * Compacta si hay desborde; si no, devuelve el resumen vigente.
   * Lanza si el proveedor falla (el llamador degrada a truncado).
   */
  async maybeCompact(
    userId: string,
    convId: string,
    prev: Array<{ role: 'user' | 'assistant'; content: string }>,
  ): Promise<CompactionResult> {
    const row = await this.convs.findById(convId);
    if (!row || row.userId !== userId || !prev.length) {
      return { summary: null, summaryCount: 0, usage: { ...USO_CERO } };
    }
    const plan = planCompaction(prev, row.summaryCount);
    if (!plan.toSummarize.length) {
      return { summary: row.summary, summaryCount: row.summaryCount, usage: { ...USO_CERO } };
    }
    const batch = takeSummaryBatch(plan.toSummarize);
    const msgs: ChatMsg[] = [
      {
        role: 'system',
        content:
          'Resume conversaciones para dar contexto a un asistente jurídico. ' +
          'Responde SOLO JSON: {"resumen": "...", "hechos": ["..."]}. ' +
          '"resumen": hechos y decisiones del hilo en español, ≤1500 caracteres, ' +
          (row.summary ? 'fusionando el resumen previo con los mensajes nuevos. ' : 'sin inventar. ') +
          '"hechos": hasta 5 datos duraderos del usuario (área, preferencias, contexto estable); ' +
          '[] si no hay ninguno claro. Nada fuera del JSON.',
      },
      {
        role: 'user',
        content:
          (row.summary ? `Resumen previo:\n${row.summary}\n\n` : '') +
          `Mensajes a resumir:\n${numbered(batch)}`,
      },
    ];
    const r = await this.gateway.chat(msgs, { maxTokens: SUMMARY_TOKENS });
    const parsed = parseSummaryResponse(r.content);
    if (!parsed) throw new Error('resumen vacío del modelo');
    const c = Conversation.rehydrate(row);
    c.applySummary(parsed.resumen, row.summaryCount + batch.length, new Date());
    await this.convs.save(c.snapshot);
    // Hechos solo con opt-in (MemoryForAgent lo exige; 0 si opt-out).
    await this.memory.addFacts(userId, parsed.hechos);
    return {
      summary: parsed.resumen,
      summaryCount: row.summaryCount + batch.length,
      usage: { ...r.usage },
    };
  }
}
