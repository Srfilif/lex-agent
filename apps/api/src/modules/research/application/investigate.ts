import { Inject, Injectable } from '@nestjs/common';
import { AGENT_BILLING, AgentBillingPort } from '../../billing';
import { LLM_CHAT, ChatMsg, LlmChatPort } from '../../../shared/llm';
import { balancedJson } from '../../../shared/json/balanced';
import { costoTokens } from '../../../shared/pricing';
import {
  INVESTIGATION_REPOSITORY,
  InvestigationAnswer,
  InvestigationRepository,
  TokenUsage,
} from '../domain/investigation';
import { ResearchTools, TOOLS } from './tools';

const SYSTEM = `Eres un investigador jurídico colombiano. Investiga con las herramientas ANTES de responder.
Reglas:
1. Toda afirmación fáctica debe apoyarse en fragmentos (buscar_normas/jurisprudencia) o filas SECOP (consultar_secop) que hayas obtenido en esta conversación.
2. Verifica cada cita textual con verificar_cita antes de usarla.
3. Si la evidencia es insuficiente, dilo explícitamente ("evidencia insuficiente") y no inventes normas, artículos ni cifras.
4. Vigencia de normas: desconocida salvo que un fragmento indique lo contrario.
5. Las señales SECOP son indicios para revisar, no prueba de irregularidad; presenta siempre el enlace al origen.
6. Tu mensaje FINAL debe ser SOLO este JSON, sin texto fuera:
{"resumen": "...", "afirmaciones": [{"texto": "...", "tipo": "norma|hecho|interpretacion_judicial|doctrina|opinion", "chunk_ids": ["..."], "secop_refs": ["..."]}], "evidencia_insuficiente": false}
chunk_ids solo de fragmentos recibidos; secop_refs con id_contrato recibidos. Afirmación sin respaldo → arrays vacíos y acláralo en el texto.`;

export interface PasoTraza {
  paso: number;
  tool_calls: Array<{ name: string; args: string }>;
  resultados: Array<{ name: string; resumen: string }>;
}

// Caso de uso: bucle plan → herramientas → respuesta JSON con citas.
// Orquesta puertos; no conoce SQL, HTTP ni el proveedor del modelo.
@Injectable()
export class Investigate {
  constructor(
    @Inject(INVESTIGATION_REPOSITORY) private readonly repo: InvestigationRepository,
    @Inject(LLM_CHAT) private readonly gateway: LlmChatPort,
    private readonly tools: ResearchTools,
    @Inject(AGENT_BILLING) private readonly billing: AgentBillingPort,
  ) {}

  async execute(
    pregunta: string,
    maxPasos = 6,
    userId: string | null = null,
  ): Promise<Record<string, unknown>> {
    // Pre-vuelo: reserva de cuota solo para autenticados (429 si agotada).
    let quota: { maxPasos: number; restantes: number } | null = null;
    if (userId) {
      quota = await this.billing.reserveInvestigation(userId);
      maxPasos = Math.min(maxPasos, quota.maxPasos);
    }
    const traza: PasoTraza[] = [];
    const usage: TokenUsage = { prompt: 0, completion: 0, total: 0 };
    const msgs: ChatMsg[] = [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: pregunta },
    ];
    let final = '';
    const pasos = Math.min(Math.max(maxPasos, 1), 10);

    for (let p = 1; p <= pasos; p++) {
      // 8000: el final natural trae el JSON completo y el razonamiento consume miles.
      const r = await this.gateway.chat(msgs, { tools: TOOLS, maxTokens: 8000 });
      usage.prompt += r.usage.prompt;
      usage.completion += r.usage.completion;
      usage.total += r.usage.total;
      if (!r.toolCalls.length) {
        final = r.content;
        break;
      }
      const paso: PasoTraza = { paso: p, tool_calls: [], resultados: [] };
      for (const t of r.toolCalls.slice(0, 4)) {
        paso.tool_calls.push({ name: t.name, args: t.args.slice(0, 500) });
        const out = await this.tools.ejecutar(t.name, t.args);
        paso.resultados.push({ name: t.name, resumen: out.slice(0, 400) });
        msgs.push({
          role: 'assistant',
          content: '',
          tool_calls: [
            { id: t.id, type: 'function', function: { name: t.name, arguments: t.args } },
          ],
        });
        msgs.push({ role: 'tool', content: out.slice(0, 6000), tool_call_id: t.id });
      }
      traza.push(paso);
      if (p === pasos) {
        const r2 = await this.gateway.chat(
          [...msgs, { role: 'user', content: 'Con la evidencia reunida, emite ahora tu mensaje final JSON.' }],
          // Generoso: el razonamiento consume gran parte del presupuesto.
          { maxTokens: 4000 },
        );
        usage.prompt += r2.usage.prompt;
        usage.completion += r2.usage.completion;
        usage.total += r2.usage.total;
        final = r2.content;
      }
    }

    const respuesta = this.parseJson(final);
    const costo = costoTokens(usage);
    const saved = await this.repo.save({
      question: pregunta,
      trace: traza,
      answer: respuesta,
      usage,
      costUsd: costo,
      userId,
    });
    if (userId) {
      await this.billing.recordInvestigation(userId, saved.id, usage.prompt, usage.completion, costo);
    }
    return {
      id: saved.id,
      respuesta,
      traza,
      usage,
      costo_usd: Math.round(costo * 1e6) / 1e6,
      json_valido: respuesta._valido === true,
      ...(quota ? { quota: { investigaciones_restantes: quota.restantes } } : {}),
    };
  }

  async obtener(id: string): Promise<Record<string, unknown> | null> {
    const inv = await this.repo.findById(id);
    if (!inv) return null;
    return {
      id: inv.id,
      pregunta: inv.question,
      traza: inv.trace,
      respuesta: inv.answer,
      usage: inv.usage,
      costo_usd: inv.costUsd,
      user_id: inv.userId,
      created_at: inv.createdAt,
    };
  }

  private parseJson(text: string): InvestigationAnswer {
    const m = text.match(/```(?:json)?\s*([\s\S]*?)```/i) ?? [null, text];
    const raw = (m[1] ?? '').trim();
    const cand = balancedJson(raw) ?? raw;
    try {
      const j = JSON.parse(cand) as Record<string, unknown>;
      return { ...j, _valido: true };
    } catch {
      return {
        _valido: false,
        resumen: text.slice(0, 2000),
        afirmaciones: [],
        evidencia_insuficiente: true,
        nota: 'El modelo no devolvió JSON válido; respuesta sin estructura de citas.',
      };
    }
  }
}
