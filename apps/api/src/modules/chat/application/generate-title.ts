import { Inject, Injectable } from '@nestjs/common';
import { LLM_CHAT, LlmChatPort } from '../../../shared/llm';
import { balancedJson } from '../../../shared/json/balanced';
import { costoTokens } from '../../../shared/pricing';
import { AGENT_BILLING, AgentBillingPort } from '../../billing';
import { Conversation } from '../domain/conversation';
import {
  CONVERSATION_REPOSITORY,
  ConversationRepository,
} from '../domain/repositories';

/**
 * B11: parseo defensivo de título+temas (puro, unit-testeable).
 * JSON {titulo, temas[]} si hay; si no, el texto plano es el título.
 */
export function parseTitleResponse(text: string): { title: string; topics: string[] } | null {
  const t = text.trim();
  if (!t) return null;
  const bal = balancedJson(t);
  if (bal) {
    try {
      const j = JSON.parse(bal) as { titulo?: unknown; temas?: unknown };
      const title =
        typeof j.titulo === 'string'
          ? j.titulo.trim().replace(/^["«]+|["»]+$/g, '').slice(0, 120)
          : '';
      const topics = Array.isArray(j.temas)
        ? j.temas.filter((x): x is string => typeof x === 'string' && !!x.trim()).map((x) => x.trim())
        : [];
      if (title) return { title, topics: topics.slice(0, 5) };
    } catch {
      // cae al texto plano
    }
  }
  const title = t.split('\n')[0]?.trim().replace(/^["«]+|["»]+$/g, '').slice(0, 120) ?? '';
  return title ? { title, topics: [] } : null;
}

@Injectable()
export class GenerateTitle {
  constructor(
    @Inject(LLM_CHAT) private readonly gateway: LlmChatPort,
    @Inject(CONVERSATION_REPOSITORY) private readonly convs: ConversationRepository,
    @Inject(AGENT_BILLING) private readonly billing: AgentBillingPort,
  ) {}

  /** Título+temas baratos best-effort tras el primer intercambio (nunca falla). */
  async execute(userId: string, conversationId: string, firstUserMsg: string): Promise<void> {
    try {
      const r = await this.gateway.chat(
        [
          {
            role: 'user',
            content: `Título de máximo 6 palabras para una conversación que empieza así, más hasta 4 temas cortos. Responde SOLO JSON {"titulo": "...", "temas": ["..."]}:\n${firstUserMsg.slice(0, 500)}`,
          },
        ],
        // 2000: el razonamiento (~400-600 aquí) trunca presupuestos cortos.
        { maxTokens: 2000 },
      );
      const parsed = parseTitleResponse(r.content);
      const row = await this.convs.findById(conversationId);
      if (!row || row.userId !== userId) return;
      // B11: la llamada se atribuye aunque el título ya no aplique (costó).
      await this.billing.recordAux(
        userId, 'titulo', `titulo:${conversationId}`, conversationId,
        r.usage.prompt, r.usage.completion, costoTokens(r.usage, r.model),
      );
      if (!parsed || row.title !== 'Nueva conversación') return;
      const c = Conversation.rehydrate(row);
      c.rename(parsed.title, new Date());
      c.setTopics(parsed.topics, new Date());
      await this.convs.save(c.snapshot);
    } catch {
      // best-effort
    }
  }
}
