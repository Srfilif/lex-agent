import { Inject, Injectable } from '@nestjs/common';
import { LLM_CHAT, ChatMsg, LlmChatPort } from '../../../shared/llm';
import { balancedJson } from '../../../shared/json/balanced';
import { costoTokens } from '../../../shared/pricing';
import {
  INVESTIGATION_REPOSITORY,
  InvestigationRepository,
} from '../domain/investigation';
import {
  Juicio,
  VeredictoAfirm,
  VerificationResult,
  dictaminar,
} from '../domain/verdict';
import { InvestigationNotFoundError } from './errors';
import { VerificarInvestigacion } from './ports';

const JUEZ = `Eres juez de soporte de citas. Para cada afirmación con sus fragmentos, decide si el/los fragmentos respaldan lo afirmado.
Responde SOLO JSON: {"juicios": [{"idx": N, "soporte": "si|parcial|no", "motivo": "..."}]}
- "si": el fragmento afirma o implica directamente el contenido.
- "parcial": respalda una parte; el resto no aparece.
- "no": no lo respalda o lo contradice.`;

// Caso de uso: verifica existencia de citas + soporte con juez LLM por lotes.
@Injectable()
export class VerifyInvestigation implements VerificarInvestigacion {
  constructor(
    @Inject(INVESTIGATION_REPOSITORY) private readonly repo: InvestigationRepository,
    @Inject(LLM_CHAT) private readonly gateway: LlmChatPort,
  ) {}

  async verificar(investigacionId: string): Promise<VerificationResult> {
    const inv = await this.repo.findById(investigacionId);
    if (!inv) throw new InvestigationNotFoundError();
    const afirms = inv.answer.afirmaciones ?? [];
    const out: VeredictoAfirm[] = [];
    // Soporte en una sola llamada juez (lote).
    const judgeInput: Array<{ idx: number; texto: string; fragmentos: string[] }> = [];
    for (let i = 0; i < afirms.length; i++) {
      const a = afirms[i];
      const ids = (a.chunk_ids ?? []).filter(Boolean);
      const sources = await this.repo.findChunkSources(ids);
      const frags = sources.map((x) => `[${x.ruta}]\n${x.texto.slice(0, 1500)}`);
      if (ids.length && frags.length) {
        judgeInput.push({ idx: i, texto: a.texto ?? '', fragmentos: frags });
      }
      out.push({
        idx: i,
        texto: a.texto ?? '',
        chunk_ids: ids,
        secop_refs: (a.secop_refs ?? []).filter(Boolean),
        existencia: ids.length > 0 && sources.length === ids.length,
        secop_ok: true, // se completa abajo
        soporte: 'na',
        motivo_soporte: '',
        veredicto: 'sin_respaldo',
      });
    }
    // Secop refs.
    for (const v of out) {
      if (!v.secop_refs.length) continue;
      const sources = await this.repo.findSecopSources(v.secop_refs);
      v.secop_ok = sources.length === v.secop_refs.length;
    }
    // Juez (con un reintento si la salida no parsea).
    const juezUsage = { prompt: 0, completion: 0, total: 0 };
    if (judgeInput.length) {
      const prompt: ChatMsg[] = [
        { role: 'system', content: JUEZ },
        { role: 'user', content: JSON.stringify(judgeInput).slice(0, 30000) },
      ];
      const llamar = async () => {
        const r = await this.gateway.chat(prompt, { maxTokens: 4000 });
        juezUsage.prompt += r.usage.prompt;
        juezUsage.completion += r.usage.completion;
        juezUsage.total += r.usage.total;
        return this.parseJuicios(r.content);
      };
      let juicios = await llamar();
      if (!juicios.length) {
        juicios = await llamar();
      }
      for (const j of juicios) {
        const v = out[j.idx];
        if (v && (j.soporte === 'si' || j.soporte === 'parcial' || j.soporte === 'no')) {
          v.soporte = j.soporte;
          v.motivo_soporte = (j.motivo || '').slice(0, 300);
        }
      }
      for (const v of out) {
        if (v.chunk_ids.length && v.soporte === 'na') {
          v.motivo_soporte = 'juez sin respuesta válida tras reintento (revisar a mano)';
        }
      }
    }
    // Veredictos.
    let inventadas = 0;
    for (const v of out) {
      const d = dictaminar(v);
      v.veredicto = d.veredicto;
      if (d.veredicto === 'cita_inventada') inventadas++;
      if (d.motivo) v.motivo_soporte = d.motivo;
    }
    const resumen: Record<string, number> = {};
    for (const v of out) resumen[v.veredicto] = (resumen[v.veredicto] ?? 0) + 1;
    return {
      afirmaciones: out,
      citas_inventadas: inventadas,
      resumen,
      juez: { usage: juezUsage, costo_usd: Math.round(costoTokens(juezUsage) * 1e6) / 1e6 },
    };
  }

  private parseJuicios(text: string): Juicio[] {
    const m = text.match(/```(?:json)?\s*([\s\S]*?)```/i) ?? [null, text];
    const cand = balancedJson((m[1] ?? '').trim()) ?? '';
    try {
      const j = JSON.parse(cand) as { juicios?: Juicio[] };
      return Array.isArray(j.juicios) ? j.juicios : [];
    } catch {
      return [];
    }
  }
}
