import { Inject, Injectable } from '@nestjs/common';
import { Db } from '../db';
import { VERIFICAR_INVESTIGACION, VerificarInvestigacion } from './verify.port';
import { BillingForAgent } from '../modules/billing';

// Informe Markdown de una investigación: respuesta + verificación + traza.
// Con userId atribuye el costo del juez (Fase E); anónimo = legacy.

@Injectable()
export class ReportService {
  constructor(
    private readonly db: Db,
    @Inject(VERIFICAR_INVESTIGACION) private readonly verifier: VerificarInvestigacion,
    private readonly billing: BillingForAgent,
  ) {}

  async informe(id: string, userId: string | null = null): Promise<Record<string, unknown>> {
    const r = await this.db.raw.query('SELECT * FROM investigaciones WHERE id = $1', [id]);
    if (!r.rowCount) throw new Error('investigación no encontrada');
    const inv = r.rows[0] as {
      pregunta: string;
      traza: Array<{ paso: number; tool_calls: Array<{ name: string }> }>;
      respuesta: { resumen?: string; afirmaciones?: Array<{ texto?: string; tipo?: string }> };
      usage: { prompt: number; completion: number; total: number };
      costo_usd: string;
      created_at: Date;
    };
    const v = await this.verifier.verificar(id);
    if (userId) {
      await this.billing.recordVerification(
        userId,
        id,
        v.juez.usage.prompt,
        v.juez.usage.completion,
        v.juez.costo_usd,
      );
    }
    const L: string[] = [];
    L.push(`# Informe de investigación`);
    L.push(``);
    L.push(`**Pregunta:** ${inv.pregunta}`);
    L.push(`**Fecha:** ${new Date(inv.created_at).toISOString()} · **ID:** ${id}`);
    L.push(``);
    L.push(`## Resumen`);
    L.push(`${inv.respuesta.resumen ?? '(sin resumen)'}`);
    L.push(``);
    L.push(`## Afirmaciones verificadas`);
    const marca: Record<string, string> = {
      verificada: '✓',
      parcial: '~',
      no_verificada: '✗',
      sin_respaldo: '○',
      cita_inventada: '⛔',
    };
    v.afirmaciones.forEach((a) => {
      L.push(`### ${marca[a.veredicto] ?? '?'} Afirmación ${a.idx + 1} — ${a.veredicto}`);
      L.push(`${a.texto}`);
      if (a.chunk_ids.length) L.push(`- Citas: ${a.chunk_ids.map((c) => `\`${c.slice(0, 8)}\``).join(', ')}`);
      if (a.secop_refs.length) L.push(`- SECOP: ${a.secop_refs.join(', ')}`);
      if (a.motivo_soporte) L.push(`- Juez: ${a.motivo_soporte}`);
      L.push(``);
    });
    // Fuentes con enlace.
    const ids = [...new Set(v.afirmaciones.flatMap((a) => a.chunk_ids))];
    let fuentes: unknown[] = [];
    if (ids.length) {
      const fr = await this.db.raw.query(
        `SELECT c.chunk_id, c.ruta, d.titulo, d.url_original FROM chunks c
         JOIN documents d ON d.id = c.doc_id WHERE c.chunk_id = ANY($1)`,
        [ids],
      );
      fuentes = fr.rows;
      L.push(`## Fuentes`);
      for (const f of fr.rows as Array<Record<string, string>>) {
        L.push(`- **${f.ruta}** — ${f.titulo} ([origen](${f.url_original}))`);
      }
      L.push(``);
    }
    const srefs = [...new Set(v.afirmaciones.flatMap((a) => a.secop_refs))];
    let contratos: unknown[] = [];
    if (srefs.length) {
      const sr = await this.db.raw.query(
        'SELECT id_contrato, nombre_entidad, proveedor_adjudicado, valor_del_contrato, urlproceso FROM secop_contratos WHERE id_contrato = ANY($1)',
        [srefs],
      );
      contratos = sr.rows.map((c) => ({
        ...c,
        valor_del_contrato: c.valor_del_contrato !== null ? Number(c.valor_del_contrato) : null,
      }));
      L.push(`## Contratos citados`);
      for (const c of sr.rows as Array<Record<string, string>>) {
        L.push(
          `- **${c.id_contrato}** — ${c.nombre_entidad} → ${c.proveedor_adjudicado} ($${c.valor_del_contrato}) ([SECOP](${c.urlproceso || 'https://www.datos.gov.co'}))`,
        );
      }
      L.push(``);
    }
    L.push(`## Traza`);
    for (const p of inv.traza) {
      L.push(`- Paso ${p.paso}: ${p.tool_calls.map((t) => `\`${t.name}\``).join(', ')}`);
    }
    L.push(``);
    L.push(`## Ficha técnica`);
    L.push(`- Tokens: ${inv.usage.total} (in ${inv.usage.prompt} / out ${inv.usage.completion}) · Costo ≈ $${inv.costo_usd} USD`);
    L.push(`- Juez: ${v.juez.usage.total} tokens · Costo ≈ $${v.juez.costo_usd} USD`);
    L.push(`- Citas inventadas: **${v.citas_inventadas}**`);
    L.push(``);
    L.push(`## Limitaciones`);
    L.push(`- Vigencia normativa no verificada salvo indicación en el fragmento.`);
    L.push(`- Corpus: 3 documentos (1407 chunks); sin sentencias todavía.`);
    L.push(`- Datos SECOP sincronizados (calidad variable); señales = indicios, no acusaciones.`);
    L.push(`- Esto no es asesoría jurídica; verifique las fuentes antes de actuar.`);
    return {
      markdown: L.join('\n'),
      verificacion: v,
      fuentes,
      contratos,
      pregunta: inv.pregunta,
      resumen: inv.respuesta.resumen ?? '',
      traza: inv.traza,
      costo_usd: inv.costo_usd,
    };
  }
}
