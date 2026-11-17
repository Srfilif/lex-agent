import { Inject, Injectable } from '@nestjs/common';
import { AGENT_BILLING, AgentBillingPort } from '../../billing';
import {
  INVESTIGATION_REPOSITORY,
  InvestigationRepository,
} from '../domain/investigation';
import { VerificationResult } from '../domain/verdict';
import { InvestigationNotFoundError } from './errors';
import { VERIFICATION_PORT, VerificarInvestigacion } from './ports';

// Caso de uso: informe Markdown de una investigación.
// Compone respuesta, verificación, fuentes y traza; no consulta tablas.
@Injectable()
export class BuildReport {
  constructor(
    @Inject(INVESTIGATION_REPOSITORY) private readonly repo: InvestigationRepository,
    @Inject(VERIFICATION_PORT) private readonly verifier: VerificarInvestigacion,
    @Inject(AGENT_BILLING) private readonly billing: AgentBillingPort,
  ) {}

  async execute(id: string, userId: string | null = null): Promise<Record<string, unknown>> {
    const inv = await this.repo.findById(id);
    if (!inv) throw new InvestigationNotFoundError();
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
    L.push(`**Pregunta:** ${inv.question}`);
    L.push(`**Fecha:** ${inv.createdAt.toISOString()} · **ID:** ${id}`);
    L.push(``);
    L.push(`## Resumen`);
    L.push(`${inv.answer.resumen ?? '(sin resumen)'}`);
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
    const fuentes = await this.repo.findChunkSources(ids);
    if (fuentes.length) {
      L.push(`## Fuentes`);
      for (const f of fuentes) {
        L.push(`- **${f.ruta}** — ${f.titulo} ([origen](${f.url_original}))`);
      }
      L.push(``);
    }
    const srefs = [...new Set(v.afirmaciones.flatMap((a) => a.secop_refs))];
    const contratos = await this.repo.findSecopSources(srefs);
    if (contratos.length) {
      L.push(`## Contratos citados`);
      for (const c of contratos) {
        L.push(
          `- **${c.id_contrato}** — ${c.nombre_entidad} → ${c.proveedor_adjudicado} ($${c.valor_del_contrato ?? ''}) ([SECOP](${c.urlproceso || 'https://www.datos.gov.co'}))`,
        );
      }
      L.push(``);
    }
    L.push(`## Traza`);
    const traza = Array.isArray(inv.trace)
      ? (inv.trace as Array<{ paso: number; tool_calls: Array<{ name: string }> }>)
      : [];
    for (const p of traza) {
      L.push(`- Paso ${p.paso}: ${p.tool_calls.map((t) => `\`${t.name}\``).join(', ')}`);
    }
    L.push(``);
    L.push(`## Ficha técnica`);
    L.push(
      `- Tokens: ${inv.usage.total} (in ${inv.usage.prompt} / out ${inv.usage.completion}) · Costo ≈ $${inv.costUsd} USD`,
    );
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
      verificacion: v as VerificationResult,
      fuentes,
      contratos,
      pregunta: inv.question,
      resumen: inv.answer.resumen ?? '',
      traza,
      costo_usd: String(inv.costUsd),
    };
  }
}
