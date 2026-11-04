// B11: preguntas de seguimiento baratas (una llamada sin tools por pedido).
import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ChatMsg, ModelGateway } from '../../../gateway/model-gateway';
import { balancedJson } from '../../../shared/json/balanced';
import { costoTokens } from '../../../shared/pricing';
import { limiteExcedido, RATE_LIMITER, RateLimiter } from '../../identity';
import { BillingForAgent } from '../../billing';
import { ConversationProps, MessageRole } from '../domain/conversation';
import {
  CONVERSATION_REPOSITORY,
  ConversationRepository,
  MESSAGE_REPOSITORY,
  MessageRepository,
} from '../domain/repositories';
import { conversacionNoEncontrada } from './errors';

const SUGGEST_TOKENS = 1500;
const SUGGEST_CHARS = 6000;
const MAX_ITEMS = 3;
const MAX_LEN = 140;

/**
 * Parseo defensivo de sugerencias (puro, unit-testeable): acepta
 * ["a",...], {sugerencias:[...]} o una por línea. Sanea, dedup, topa.
 */
export function parseSuggestions(text: string): string[] {
  const clean = (s: string): string | null => {
    const t = s.trim().replace(/^[-*\d.)\s]+/, '').replace(/\s+/g, ' ').slice(0, MAX_LEN);
    return t.length >= 8 ? t : null;
  };
  const pick = (j: unknown): string[] => {
    const arr = Array.isArray(j)
      ? j
      : typeof j === 'object' && j !== null && Array.isArray((j as Record<string, unknown>)['sugerencias'])
        ? ((j as Record<string, unknown>)['sugerencias'] as unknown[])
        : [];
    const out: string[] = [];
    for (const x of arr) {
      if (typeof x !== 'string') continue;
      const c = clean(x);
      if (c && !out.includes(c)) out.push(c);
      if (out.length >= MAX_ITEMS) break;
    }
    return out;
  };
  // JSON directo (cubre arrays top-level, que balancedJson no extrae).
  try {
    const direct = pick(JSON.parse(text.trim()) as unknown);
    if (direct.length) return direct;
  } catch {
    // sigue a balanceado
  }
  const bal = balancedJson(text.trim());
  if (bal) {
    try {
      const out = pick(JSON.parse(bal) as unknown);
      if (out.length) return out;
    } catch {
      // cae a líneas
    }
  }
  const out: string[] = [];
  for (const line of text.split('\n')) {
    const c = clean(line);
    if (c && !out.includes(c)) out.push(c);
    if (out.length >= MAX_ITEMS) break;
  }
  return out;
}

@Injectable()
export class ChatSuggestions {
  constructor(
    private readonly gateway: ModelGateway,
    private readonly billing: BillingForAgent,
    @Inject(CONVERSATION_REPOSITORY) private readonly convs: ConversationRepository,
    @Inject(MESSAGE_REPOSITORY) private readonly msgs: MessageRepository,
    @Inject(RATE_LIMITER) private readonly limiter: RateLimiter,
  ) {}

  async execute(userId: string, convId: string): Promise<Record<string, unknown>> {
    const rl = await this.limiter.consume(`sug:${userId}`, 10, 60);
    if (!rl.allowed) throw limiteExcedido(rl.retryAfterSec);
    const row: ConversationProps | null = await this.convs.findById(convId);
    if (!row || row.userId !== userId) throw conversacionNoEncontrada();
    const prev = await this.msgs.listByConversation(convId, { limit: 6 });
    const tail = prev.slice(-6);
    let used = 0;
    const kept: Array<{ role: MessageRole; content: string }> = [];
    for (let i = tail.length - 1; i >= 0; i--) {
      const m = tail[i] as { role: MessageRole; content: string };
      if (used + m.content.length > SUGGEST_CHARS && kept.length > 0) break;
      used += m.content.length;
      kept.unshift(m);
    }
    const msgs: ChatMsg[] = [
      {
        role: 'system',
        content:
          'Sugiere 3 preguntas de seguimiento jurídicas en español, cortas (máx. 140 caracteres), ' +
          'relacionadas con la conversación. Responde SOLO JSON: ["pregunta 1", "pregunta 2", "pregunta 3"].',
      },
      {
        role: 'user',
        content: kept.map((m) => `[${m.role}]\n${m.content.slice(0, 2000)}`).join('\n\n') || '(sin mensajes)',
      },
    ];
    const r = await this.gateway.chat(msgs, { maxTokens: SUGGEST_TOKENS });
    await this.billing.recordAux(
      userId, 'sugerencias', `sug:${randomUUID()}`, convId,
      r.usage.prompt, r.usage.completion, costoTokens(r.usage, r.model),
    );
    return { sugerencias: parseSuggestions(r.content) };
  }
}
