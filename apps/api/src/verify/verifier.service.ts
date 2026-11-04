import { Injectable } from '@nestjs/common';
import { Db } from '../db';
import { ModelGateway } from '../gateway/model-gateway';
import { balancedJson } from '../shared/json/balanced';
import { costoTokens } from '../shared/pricing';
import { dictaminar } from './veredictos';
import { VerificarInvestigacion } from '../report/verify.port';

// Verificador formal de citas (ver CITATION_VERIFICATION.md):
// existencia (chunk_id/secop en DB) + soporte (juez LLM por lotes).

export interface Juicio {
  idx: number;
  soporte: 'si' | 'parcial' | 'no' | 'na';
  motivo: string;
}

export interface VeredictoAfirm {
  idx: number;
  texto: string;
  chunk_ids: string[];
  secop_refs: string[];
  existencia: boolean;
  secop_ok: boolean;
  soporte: Juicio['soporte'];
  motivo_soporte: string;
  veredicto: 'verificada' | 'parcial' | 'no_verificada' | 'sin_respaldo' | 'cita_inventada';
}

const JUEZ = `Eres juez de soporte de citas. Para cada afirmación con sus fragmentos, decide si el/los fragmentos respaldan lo afirmado.
Responde SOLO JSON: {"juicios": [{"idx": N, "soporte": "si|parcial|no", "motivo": "..."}]}
- "si": el fragmento afirma o implica directamente el contenido.
- "parcial": respalda una parte; el resto no aparece.
- "no": no lo respalda o lo contradice.`;

@Injectable()
export class VerifierService implements VerificarInvestigacion {
  constructor(
    private readonly db: Db,
    private readonly gateway: ModelGateway,
  ) {}

  async verificar(investigacionId: string): Promise<{
    afirmaciones: VeredictoAfirm[];
    citas_inventadas: number;
    resumen: Record<string, number>;
    juez: { usage: { prompt: number; completion: number; total: number }; costo_usd: number };
  }> {
    const inv = await this.db.raw.query(
      'SELECT respuesta FROM investigaciones WHERE id = $1',
      [investigacionId],
    );
    if (!inv.rowCount) throw new Error('investigación no encontrada');
    const resp = inv.rows[0].respuesta as {
      afirmaciones?: Array<{
        texto?: string;
        chunk_ids?: string[];
        secop_refs?: string[];
      }>;
    };
    const afirms = resp.afirmaciones ?? [];
    const out: VeredictoAfirm[] = [];
    // Soporte en una sola llamada juez (lote).
    const judgeInput: Array<{ idx: number; texto: string; fragmentos: string[] }> = [];
    for (let i = 0; i < afirms.length; i++) {
      const a = afirms[i];
      const ids = (a.chunk_ids ?? []).filter(Boolean);
      let rows: Array<{ chunk_id: string; ruta: string; texto: string }> = [];
      if (ids.length) {
        const r = await this.db.raw.query(
          'SELECT chunk_id, ruta, texto FROM chunks WHERE chunk_id = ANY($1)',
          [ids],
        );
        rows = r.rows;
      }
      const frags = rows.map((x) => `[${x.ruta}]\n${x.texto.slice(0, 1500)}`);
      if (ids.length && frags.length) {
        judgeInput.push({ idx: i, texto: a.texto ?? '', fragmentos: frags });
      }
      out.push({
        idx: i,
        texto: a.texto ?? '',
        chunk_ids: ids,
        secop_refs: (a.secop_refs ?? []).filter(Boolean),
        existencia: ids.length > 0 && rows.length === ids.length,
        secop_ok: true, // se completa abajo
        soporte: 'na',
        motivo_soporte: '',
        veredicto: 'sin_respaldo',
      });
    }
    // Secop refs.
    for (const v of out) {
      if (!v.secop_refs.length) continue;
      const r = await this.db.raw.query(
        'SELECT id_contrato FROM secop_contratos WHERE id_contrato = ANY($1)',
        [v.secop_refs],
      );
      v.secop_ok = r.rowCount === v.secop_refs.length;
    }
    // Juez (con un reintento si la salida no parsea).
    const juezUsage = { prompt: 0, completion: 0, total: 0 };
    if (judgeInput.length) {
      const prompt: [{ role: 'system'; content: string }, { role: 'user'; content: string }] = [
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
