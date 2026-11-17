// Orquestador del agente conversacional con RAG jurídico.
// Flujo: historial → rondas tool (máx 3) → respuesta final sin tools.
// El modelo razona (~100-1200 tokens) y puede truncar con presupuestos cortos
// (finish=length, content=null): presupuestos amplios + reintento anti-truncado.
// La respuesta final es NO-stream y viaja como un solo evento token: el modelo
// llega a inventar tool_calls en streams sin tools, y esa vía lo evita.
// Sin tools: la respuesta directa también viaja como un solo evento token.
import { Inject, Injectable } from '@nestjs/common';
import { ChatMsg, LLM_CHAT, LlmChatPort } from '../../../shared/llm';
import { AppConfig, CONFIG } from '../../../shared/config';
import { Citation, HistoryMsg } from '../domain/conversation';
import { AgentContext, ChatToolRegistry, ToolHit } from './tools';
import { numberCitations } from './citations';
import { ensureDisclaimer, esAbstencion } from '../domain/guardrails';

const MAX_TOOL_ROUNDS = 3;
const MAX_CITATIONS = 8;
// Presupuestos amplios: el razonamiento del modelo consume ~100-1200 tokens;
// con 1200 se observó finish=length + content=null (respuesta vacía).
const TOOL_ROUND_TOKENS = 3000;
const RETRY_TOKENS = 6000;
const FINAL_TOKENS = 4000;
const MAX_FINAL_ATTEMPTS = 2;

const FALLBACK_VACIO =
  'No logré completar la respuesta en este intento. Intenta de nuevo con la misma pregunta.';

function warnVacio(fase: string): void {
  // eslint-disable-next-line no-console
  console.warn(`[chat] respuesta vacía del modelo (fase ${fase})`);
}

export interface AgentEvents {
  onTool(status: string): void;
  onToken(delta: string): void;
}

export interface AgentAnswer {
  content: string;
  citations: Citation[];
  usage: { prompt: number; completion: number; total: number };
  model: string;
}

@Injectable()
export class ChatAgent {
  constructor(
    @Inject(LLM_CHAT) private readonly gateway: LlmChatPort,
    private readonly tools: ChatToolRegistry,
    @Inject(CONFIG) private readonly cfg: AppConfig,
  ) {}

  async run(
    history: HistoryMsg[],
    model: string | null,
    events: AgentEvents,
    ctx: AgentContext | null = null,
    fallbacks: string[] = [],
  ): Promise<AgentAnswer> {
    const useModel = model ?? this.cfg.metaModel;
    // B7: el modelo real puede cambiar por fallback; gana la última llamada.
    let usedModel = useModel;
    const uso = { prompt: 0, completion: 0, total: 0 };
    const addUsage = (u: { prompt: number; completion: number; total: number }): void => {
      uso.prompt += u.prompt;
      uso.completion += u.completion;
      uso.total += u.total;
    };
    const conv: ChatMsg[] = history.map((m) => ({ role: m.role, content: m.content }));
    const found: ToolHit[] = [];
    // B10: el disclaimer se garantiza cuando hubo herramientas.
    let toolsUsed = false;

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      let r = await this.gateway.chat(conv, {
        tools: this.tools.definitions,
        maxTokens: TOOL_ROUND_TOKENS,
        model: useModel,
        fallbacks,
      });
      addUsage(r.usage);
      usedModel = r.model;
      if (!r.toolCalls.length && !r.content) {
        // Truncado por razonamiento (finish=length): un reintento amplio.
        r = await this.gateway.chat(conv, {
          tools: this.tools.definitions,
          maxTokens: RETRY_TOKENS,
          model: useModel,
          fallbacks,
        });
        addUsage(r.usage);
        usedModel = r.model;
      }
      if (!r.toolCalls.length) {
        // Respuesta directa: un solo evento token (sin re-gastar en stream).
        const content = r.content ? ensureDisclaimer(r.content, toolsUsed) : FALLBACK_VACIO;
        if (!r.content) warnVacio('directa');
        events.onToken(content);
        // Abstención: sin citas (las recuperadas serían ruido engañoso).
        const citas = esAbstencion(content) ? [] : numberCitations(found, MAX_CITATIONS);
        return { content, citations: citas, usage: uso, model: usedModel };
      }
      conv.push({
        role: 'assistant',
        content: r.content || '',
        tool_calls: r.toolCalls.map((t) => ({
          id: t.id,
          type: 'function' as const,
          function: { name: t.name, arguments: t.args },
        })),
      });
      for (const tc of r.toolCalls.slice(0, 4)) {
        events.onTool(tc.name);
        toolsUsed = true;
        const { text, hits } = await this.tools.execute(tc.name, tc.args, ctx);
        for (const h of hits) {
          if (found.length < MAX_CITATIONS * 2) found.push(h);
        }
        conv.push({ role: 'tool', content: text.slice(0, 4000), tool_call_id: tc.id });
      }
    }

    // Respuesta final SIN tools (no-stream): con fuentes numeradas y orden
    // explícita de responder solo texto (el modelo inventa tools si se lo pides
    // por stream). El texto viaja como un solo evento token.
    const citations = numberCitations(found, MAX_CITATIONS);
    const fuentes = citations.map((c) => `[${c.n}] ${c.ruta} — ${c.titulo}`).join('\n');
    conv.push({
      role: 'user',
      content:
        `Fuentes disponibles:\n${fuentes || '(sin fuentes: dilo explícitamente)'}\n\n` +
        `Responde la última pregunta SOLO con el texto final en español, con citas [n]. ` +
        `No llames herramientas, no anuncies acciones, no devuelvas JSON. ` +
        `Si la evidencia no alcanza, dilo explícitamente.`,
    });
    let final = '';
    for (let attempt = 0; attempt < MAX_FINAL_ATTEMPTS && !final; attempt++) {
      const fin = await this.gateway.chat(conv, {
        maxTokens: FINAL_TOKENS,
        model: useModel,
        fallbacks,
      });
      addUsage(fin.usage);
      usedModel = fin.model;
      if (!fin.toolCalls.length) {
        final = fin.content;
        break;
      }
      // Tool fantasma (el modelo inventa nombres): se rechaza y se reintenta.
      conv.push({
        role: 'assistant',
        content: fin.content || '',
        tool_calls: fin.toolCalls.map((t) => ({
          id: t.id,
          type: 'function' as const,
          function: { name: t.name, arguments: t.args },
        })),
      });
      for (const t of fin.toolCalls) {
        conv.push({
          role: 'tool',
          content: `herramienta no disponible en esta fase: ${t.name}. Responde con texto.`,
          tool_call_id: t.id,
        });
      }
    }
    if (!final) {
      warnVacio('final');
      final = FALLBACK_VACIO;
    } else {
      final = ensureDisclaimer(final, toolsUsed);
    }
    events.onToken(final);
    const finalCitas = esAbstencion(final) ? [] : citations;
    return { content: final, citations: finalCitas, usage: uso, model: usedModel };
  }

}
