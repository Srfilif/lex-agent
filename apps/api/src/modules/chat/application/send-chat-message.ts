import { Inject, Injectable } from '@nestjs/common';
import { AppConfig, CONFIG } from '../../../shared/config';
import { costoTokens } from '../../../shared/pricing';
import { limiteExcedido, RATE_LIMITER, RateLimiter } from '../../identity';
import { AGENT_BILLING, AgentBillingPort } from '../../billing';
import { MEMORY_FOR_AGENT, MemoryForAgentPort, renderFacts } from '../../account';
import { buildHistory, Conversation, MessageRole } from '../domain/conversation';
import {
  CONVERSATION_REPOSITORY,
  ConversationRepository,
  MESSAGE_REPOSITORY,
  MessageRepository,
  PROJECT_REPOSITORY,
  ProjectRepository,
} from '../domain/repositories';
import {
  apoyoCrisis,
  contenidoNoPermitido,
  conversacionNoEncontrada,
  mensajeInvalido,
  modeloNoPermitido,
  noRegenerable,
  proyectoNoEncontrado,
} from './errors';
import { AgentEvents, ChatAgent } from './chat-agent';
import { SYSTEM_JURIDICO, withProjectInstructions } from './chat-prompt';
import { ThreadSummarizer } from './thread-summarizer';
import { resolveModel } from '../domain/model-selection';
import { esAbstencion, estimateTokens, moderate } from '../domain/guardrails';

const HISTORY_CHARS = 24000;

@Injectable()
export class SendChatMessage {
  constructor(
    private readonly agent: ChatAgent,
    @Inject(AGENT_BILLING) private readonly billing: AgentBillingPort,
    @Inject(CONVERSATION_REPOSITORY) private readonly convs: ConversationRepository,
    @Inject(MESSAGE_REPOSITORY) private readonly msgs: MessageRepository,
    @Inject(PROJECT_REPOSITORY) private readonly projects: ProjectRepository,
    @Inject(RATE_LIMITER) private readonly limiter: RateLimiter,
    @Inject(CONFIG) private readonly cfg: AppConfig,
    private readonly summarizer: ThreadSummarizer,
    @Inject(MEMORY_FOR_AGENT) private readonly memory: MemoryForAgentPort,
  ) {}

  /** B7: modelo pedido → plan → catálogo; falla 400 si no hay intersección. */
  private select(requested: string | undefined, permitidos: string[]): {
    model: string;
    fallbacks: string[];
  } {
    const r = resolveModel(requested ?? null, permitidos, this.cfg.chatModels);
    if (!r.ok) throw modeloNoPermitido();
    return r.selection;
  }

  private async systemFor(conversationId: string): Promise<string> {
    const row = await this.convs.findById(conversationId);
    if (!row?.projectId) return SYSTEM_JURIDICO;
    const p = await this.projects.findById(row.projectId);
    return withProjectInstructions(SYSTEM_JURIDICO, p);
  }

  private async answerAndPersist(
    userId: string,
    convId: string,
    prev: Array<{ role: MessageRole; content: string }>,
    model: string,
    fallbacks: string[],
    events: AgentEvents,
    projectId: string | null,
  ): Promise<Record<string, unknown>> {
    // B8: compactación best-effort (si falla, truncado clásico) + memoria
    // cruzada opt-in. El costo del resumen se atribuye a esta respuesta.
    let summary: string | null = null;
    let summaryCount = 0;
    const extra = { prompt: 0, completion: 0, total: 0 };
    try {
      const c = await this.summarizer.maybeCompact(userId, convId, prev);
      summary = c.summary;
      summaryCount = c.summaryCount;
      extra.prompt += c.usage.prompt;
      extra.completion += c.usage.completion;
      extra.total += c.usage.total;
    } catch {
      // degradación honesta: sin resumen, solo truncado
    }
    const facts = await this.memory.getFacts(userId).catch((): string[] => []);
    const base = await this.systemFor(convId);
    const history = buildHistory(
      base + renderFacts(facts),
      prev.slice(summaryCount),
      HISTORY_CHARS,
      summary,
    );
    // B10: presupuesto estimado del prompt por mensaje (honesto, configurable).
    const promptChars = history.reduce((n, m) => n + m.content.length, 0);
    const promptTokens = estimateTokens(promptChars);
    if (promptTokens > this.cfg.chatMaxPromptTokens) {
      throw mensajeInvalido(
        `contexto demasiado largo para un mensaje (${promptTokens} tokens estimados, tope ${this.cfg.chatMaxPromptTokens}); abra un hilo nuevo`,
      );
    }
    const ans = await this.agent.run(history, model, events, { userId, projectId }, fallbacks);
    const usage = {
      prompt: ans.usage.prompt + extra.prompt,
      completion: ans.usage.completion + extra.completion,
      total: ans.usage.total + extra.total,
    };
    const cost = costoTokens(usage, ans.model);
    const saved = await this.msgs.append({
      conversationId: convId,
      role: 'assistant',
      content: ans.content,
      citations: ans.citations,
      usage,
      costUsd: cost,
      model: ans.model,
    });
    await this.billing.recordChat(userId, saved.id, usage.prompt, usage.completion, cost);
    if (esAbstencion(ans.content)) {
      await this.billing.recordAbstencion(userId, saved.id).catch(() => undefined);
    }
    const conv = await this.convs.findById(convId);
    if (conv) {
      await this.convs.save({ ...conv, updatedAt: new Date() });
    }
    return {
      conversation_id: convId,
      message: {
        id: saved.id,
        role: 'assistant',
        content: ans.content,
        citations: ans.citations,
        model: ans.model,
        created_at: saved.createdAt.toISOString(),
      },
      usage,
      costo_usd: Math.round(cost * 1e6) / 1e6,
    };
  }

  /** Envía y persiste; los eventos van al emisor (SSE o sumidero). */
  async execute(
    userId: string,
    input: { conversationId: string | null; content: string; model?: string; projectId?: string },
    events: AgentEvents,
  ): Promise<Record<string, unknown>> {
    const rl = await this.limiter.consume(`chat:${userId}`, 30, 60);
    if (!rl.allowed) throw limiteExcedido(rl.retryAfterSec);
    const content = input.content.trim();
    if (!content) throw mensajeInvalido('mensaje vacío');
    if (content.length > 8000) throw mensajeInvalido('mensaje demasiado largo (máx. 8000)');
    // B10: moderación pre-vuelo (antes de reservar/cobrar).
    const hit = moderate(content);
    if (hit === 'crisis') throw apoyoCrisis();
    if (hit === 'ilícito') throw contenidoNoPermitido();
    const reserve = await this.billing.reserveChat(userId);
    const sel = this.select(input.model, reserve.modelos);

    let convId = input.conversationId;
    let isNew = false;
    let projectId: string | null = null;
    if (convId) {
      const row = await this.convs.findById(convId);
      if (!row || row.userId !== userId) throw conversacionNoEncontrada();
      projectId = row.projectId;
    } else {
      const created = await this.convs.create(userId, 'Nueva conversación', new Date());
      convId = created.id;
      isNew = true;
      // B6: asignar el proyecto AL CREAR (no después): el primer mensaje ya
      // debe ver instrucciones y archivos; moverlo tras el meta es tarde.
      if (input.projectId) {
        const p = await this.projects.findById(input.projectId);
        if (!p || p.userId !== userId) throw proyectoNoEncontrado();
        const c = Conversation.rehydrate(created);
        c.moveToProject(p.id, new Date());
        await this.convs.save(c.snapshot);
        projectId = p.id;
      }
    }
    await this.msgs.append({ conversationId: convId, role: 'user', content });
    const prev = await this.msgs.listByConversation(convId, { limit: 50 });
    const out = await this.answerAndPersist(
      userId,
      convId,
      prev.map((m) => ({ role: m.role as MessageRole, content: m.content })),
      sel.model,
      sel.fallbacks,
      events,
      projectId,
    );
    return { ...out, is_new: isNew };
  }

  /** B9: regenera la última respuesta (no-stream): borra el assistant final y re-ejecuta. */
  async regenerate(
    userId: string,
    input: { conversationId: string; model?: string },
    events: AgentEvents,
  ): Promise<Record<string, unknown>> {
    const rl = await this.limiter.consume(`chat:${userId}`, 30, 60);
    if (!rl.allowed) throw limiteExcedido(rl.retryAfterSec);
    const row = await this.convs.findById(input.conversationId);
    if (!row || row.userId !== userId) throw conversacionNoEncontrada();
    const reserve = await this.billing.reserveChat(userId);
    const sel = this.select(input.model, reserve.modelos);

    const prev = await this.msgs.listByConversation(input.conversationId, { limit: 50 });
    const last = prev[prev.length - 1];
    if (!last || last.role !== 'assistant') {
      throw noRegenerable('la conversación no termina en una respuesta del asistente');
    }
    if (!prev.some((m) => m.role === 'user')) {
      throw noRegenerable('no hay pregunta del usuario para regenerar');
    }
    await this.msgs.deleteById(last.id);
    const rest = prev.slice(0, -1);
    const out = await this.answerAndPersist(
      userId,
      input.conversationId,
      rest.map((m) => ({ role: m.role as MessageRole, content: m.content })),
      sel.model,
      sel.fallbacks,
      events,
      row.projectId,
    );
    return { ...out, is_new: false, regenerated: true };
  }
}
