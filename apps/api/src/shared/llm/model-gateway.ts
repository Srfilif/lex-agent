import { Inject, Injectable, Optional } from '@nestjs/common';
import { AppConfig, CONFIG, loadAppConfig } from '../config';
import type { ChatMsg, ChatOptions, ChatResult, LlmChatPort } from './ports';

export type { ChatMsg, ChatOptions, ChatResult, ToolCall, ToolDef } from './ports';

// Adaptador HTTP del puerto LLM (ver SYSTEM_ARCHITECTURE.md).
// Chat: Meta Model API (verificado Día 0).
// Embed según EMBED_PROVIDER (default ollama): meta (/embeddings, 404 hoy),
// ollama local (bge-m3, 1024 dims) o gemini dedicado (3072 dims).

const RETRIABLE = new Set([429, 500, 502, 503, 504]);
// B7: estados que prueban el siguiente modelo de la cadena (404 = el
// proveedor retiró el modelo). Otros 4xx (400/401/403) no sanan cambiando.
const FALLBACK_STATUS = new Set([404, 429, 500, 502, 503, 504]);

@Injectable()
export class ModelGateway implements LlmChatPort {
  private readonly base: string;
  private readonly key: string;
  private readonly model: string;
  private readonly ollamaHost: string;
  private readonly ollamaModel: string;
  private readonly embedProvider: 'meta' | 'ollama' | 'gemini';
  private readonly embedModel: string;
  private readonly geminiBaseUrl: string;
  private readonly geminiModel: string;
  private readonly geminiKey: string;
  private readonly timeoutMs: number;
  private readonly embedTimeoutMs: number;

  // La config llega por DI; el default mantiene `new ModelGateway()` en CLIs
  // hasta el Bloque E (CLIs al contenedor).
  constructor(@Optional() @Inject(CONFIG) cfg?: AppConfig) {
    const c = cfg ?? loadAppConfig();
    this.base = c.metaBaseUrl;
    this.key = c.metaApiKey;
    this.model = c.metaModel;
    this.ollamaHost = c.ollamaHost;
    this.ollamaModel = c.ollamaModel;
    // Los fakes de tests omiten la config: ?? replica los defaults reales.
    this.embedProvider = c.embedProvider ?? 'ollama';
    this.embedModel = c.metaEmbedModel || c.metaModel;
    this.geminiBaseUrl =
      c.embedBaseUrl || 'https://generativelanguage.googleapis.com/v1beta';
    this.geminiModel = c.embedModel || 'gemini-embedding-001';
    this.geminiKey = c.embedApiKey ?? '';
    // B10: timeouts (los fakes de tests omiten la config: defaults iguales).
    this.timeoutMs = c.metaTimeoutMs ?? 120000;
    this.embedTimeoutMs = c.ollamaTimeoutMs ?? 60000;
  }

  // Contadores en memoria (objetivo: medir costo por investigación, día 5)
  totals = { prompt: 0, completion: 0, requests: 0 };

  status(): Record<string, unknown> {
    return {
      provider: 'meta',
      model: this.model,
      keyConfigured: this.key.length > 0,
      embedProvider: this.embedProvider,
      embedModel:
        this.embedProvider === 'meta'
          ? this.embedModel
          : this.embedProvider === 'gemini'
            ? this.geminiModel
            : this.ollamaModel,
      totals: { ...this.totals },
    };
  }

  async chat(messages: ChatMsg[], opts: ChatOptions = {}): Promise<ChatResult> {
    if (!this.key) throw new Error('META_API_KEY no configurada');
    // B7: cadena primario + fallbacks (orden del plan). El primario reintenta
    // una vez; cada fallback un intento. Solo sanan red/5xx/429/404.
    const chain = [opts.model ?? this.model, ...(opts.fallbacks ?? [])];
    let lastErr = '';
    for (const [i, model] of chain.entries()) {
      // Nota Día 0: usar max_tokens generoso (el razonamiento consume ~250+ tokens).
      const body: Record<string, unknown> = {
        model,
        messages,
        max_tokens: opts.maxTokens ?? 1000,
      };
      if (opts.tools?.length) {
        body.tools = opts.tools;
        body.tool_choice = 'auto'; // único valor soportado (Día 0)
      }
      const attempts = i === 0 ? 2 : 1;
      for (let attempt = 0; attempt < attempts; attempt++) {
        let res: Response;
        try {
          res = await fetch(`${this.base}/chat/completions`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${this.key}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(this.timeoutMs),
          });
        } catch (e) {
          const aborted =
            e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError');
          lastErr = aborted ? `timeout ${this.timeoutMs}ms` : `red: ${(e as Error).message}`.slice(0, 120);
          break; // red/timeout: probar siguiente modelo sin reintentar
        }
        if (RETRIABLE.has(res.status) && attempt + 1 < attempts) {
          lastErr = `HTTP ${res.status}`;
          await new Promise((r) => setTimeout(r, 1500));
          continue;
        }
        if (!res.ok) {
          lastErr = `HTTP ${res.status}`;
          if (!FALLBACK_STATUS.has(res.status)) {
            const t = (await res.text()).slice(0, 500);
            throw new Error(`Model API ${res.status}: ${t}`);
          }
          break; // probar siguiente modelo de la cadena
        }
        const j = (await res.json()) as {
          choices?: Array<{
            message?: {
              content?: string | null;
              tool_calls?: Array<{
                id: string;
                function: { name: string; arguments: string };
              }>;
            };
          }>;
          usage?: {
            prompt_tokens: number;
            completion_tokens: number;
            total_tokens: number;
          };
        };
        const msg = j.choices?.[0]?.message ?? {};
        const usage = {
          prompt: j.usage?.prompt_tokens ?? 0,
          completion: j.usage?.completion_tokens ?? 0,
          total: j.usage?.total_tokens ?? 0,
        };
        this.totals.prompt += usage.prompt;
        this.totals.completion += usage.completion;
        this.totals.requests += 1;
        if (i > 0) {
          // eslint-disable-next-line no-console
          console.warn(`[gateway] fallback a ${model} (${lastErr})`);
        }
        return {
          content: msg.content ?? '',
          toolCalls: (msg.tool_calls ?? []).map((t) => ({
            id: t.id,
            name: t.function.name,
            args: t.function.arguments,
          })),
          usage,
          model,
        };
      }
    }
    throw new Error(`Model API cadena agotada (${lastErr})`);
  }

  /**
   * Chat con streaming SSE (verificado: text/event-stream + data: [DONE]).
   * Sin tools (las rondas tool usan chat()): emite deltas de texto y al final
   * devuelve el contenido completo + uso (si el proveedor lo envía).
   */
  async chatStream(
    messages: ChatMsg[],
    onDelta: (delta: string) => void,
    opts: { maxTokens?: number; model?: string } = {},
  ): Promise<{ content: string; usage: { prompt: number; completion: number; total: number } }> {
    if (!this.key) throw new Error('META_API_KEY no configurada');
    const res = await fetch(`${this.base}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: opts.model ?? this.model,
        messages,
        max_tokens: opts.maxTokens ?? 2000,
        stream: true,
        stream_options: { include_usage: true },
      }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok || !res.body) {
      const t = res.body ? '' : await res.text().catch(() => '');
      throw new Error(`Model API stream ${res.status}: ${t.slice(0, 300)}`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    let content = '';
    const usage = { prompt: 0, completion: 0, total: 0 };
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith('data:')) continue;
        const payload = t.slice(5).trim();
        if (payload === '[DONE]') continue;
        let j: {
          choices?: Array<{ delta?: { content?: string | null } }>;
          usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
        };
        try {
          j = JSON.parse(payload) as typeof j;
        } catch {
          continue;
        }
        const d = j.choices?.[0]?.delta?.content;
        if (d) {
          content += d;
          onDelta(d);
        }
        if (j.usage) {
          usage.prompt = j.usage.prompt_tokens ?? 0;
          usage.completion = j.usage.completion_tokens ?? 0;
          usage.total = j.usage.total_tokens ?? usage.prompt + usage.completion;
        }
      }
    }
    this.totals.prompt += usage.prompt;
    this.totals.completion += usage.completion;
    this.totals.requests += 1;
    return { content, usage };
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (this.embedProvider === 'meta') return this.embedMeta(texts);
    if (this.embedProvider === 'gemini') return this.embedGemini(texts);
    return this.embedOllama(texts);
  }

  /** Embeddings vía proveedor dedicado (Gemini: batchEmbedContents, 3072 dims). */
  private async embedGemini(texts: string[]): Promise<number[][]> {
    if (!this.geminiKey) throw new Error('EMBED_API_KEY no configurada');
    const model = this.geminiModel.startsWith('models/')
      ? this.geminiModel
      : `models/${this.geminiModel}`;
    const short = model.replace(/^models\//, '');
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += 16) {
      const batch = texts.slice(i, i + 16);
      const res = await fetch(`${this.geminiBaseUrl}/models/${short}:batchEmbedContents`, {
        method: 'POST',
        headers: {
          'x-goog-api-key': this.geminiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: batch.map((t) => ({ model, content: { parts: [{ text: t }] } })),
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!res.ok) {
        throw new Error(`Gemini embeddings ${res.status}: ${(await res.text()).slice(0, 300)}`);
      }
      const j = (await res.json()) as { embeddings?: Array<{ values?: number[] }> };
      const rows = j.embeddings ?? [];
      if (rows.length !== batch.length) throw new Error('Gemini embeddings: respuesta incompleta');
      for (const r of rows) {
        if (!r.values?.length) throw new Error('Gemini embeddings: respuesta incompleta');
        out.push(r.values);
      }
    }
    return out;
  }

  /** Embeddings vía Meta Model API (OpenAI-compatible: POST /embeddings). */
  private async embedMeta(texts: string[]): Promise<number[][]> {
    if (!this.key) throw new Error('META_API_KEY no configurada');
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += 16) {
      const batch = texts.slice(i, i + 16);
      const res = await fetch(`${this.base}/embeddings`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model: this.embedModel, input: batch }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!res.ok) {
        const t = (await res.text()).slice(0, 300);
        const pista =
          res.status === 404 ? ' (¿/embeddings no habilitado? prueba EMBED_PROVIDER=ollama)' : '';
        throw new Error(`Meta embeddings ${res.status}: ${t}${pista}`);
      }
      const j = (await res.json()) as {
        data?: Array<{ embedding?: number[]; index?: number }>;
      };
      const rows = (j.data ?? [])
        .map((d, at) => ({ vec: d.embedding, idx: d.index ?? at }))
        .sort((a, b) => a.idx - b.idx);
      if (rows.length !== batch.length) throw new Error('Meta embeddings: respuesta incompleta');
      for (const r of rows) {
        if (!r.vec?.length) throw new Error('Meta embeddings: respuesta incompleta');
        out.push(r.vec);
      }
    }
    return out;
  }

  /** Embeddings vía Ollama local (/api/embed). */
  private async embedOllama(texts: string[]): Promise<number[][]> {
    const out: number[][] = [];
    // En lotes pequeños: bge-m3 acepta 8k tokens, los chunks son cortos.
    for (let i = 0; i < texts.length; i += 16) {
      const batch = texts.slice(i, i + 16);
      const res = await fetch(`${this.ollamaHost}/api/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.ollamaModel, input: batch }),
        signal: AbortSignal.timeout(this.embedTimeoutMs),
      });
      if (!res.ok) {
        throw new Error(`Ollama ${res.status}: ${(await res.text()).slice(0, 300)}`);
      }
      const j = (await res.json()) as { embeddings?: number[][] };
      if (!j.embeddings?.length) throw new Error('Ollama sin embeddings');
      out.push(...j.embeddings);
    }
    return out;
  }

  async rerank(query: string, docs: string[]): Promise<number[]> {
    // Sin reranker (Q1): orden identidad = solo RRF. Se sustituye sin cambiar llamadas.
    void query;
    return docs.map((_, i) => i);
  }
}
