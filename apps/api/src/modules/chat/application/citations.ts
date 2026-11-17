import { Citation } from '../domain/conversation';
import { ToolHit } from './tools';

/** Numera y deduplica fuentes recuperadas para el mensaje final. */
export function numberCitations(found: ToolHit[], max: number): Citation[] {
  const seen = new Set<string>();
  const out: Citation[] = [];
  for (const h of found) {
    const key = h.chunk_id ?? `secop:${h.secop_ref}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      n: out.length + 1,
      chunk_id: h.chunk_id,
      secop_ref: h.secop_ref,
      ruta: h.ruta,
      titulo: h.titulo,
    });
    if (out.length >= max) break;
  }
  return out;
}
