// Reglas de recuperación híbrida (ver RAG_DESIGN.md). Dominio puro.

export interface SearchFiltros {
  tipo?: string;
  emisor?: string;
  numero?: string;
  /** D1: jurisdicción ('CO' nacional, códigos de territorio). */
  jurisdiccion?: string;
  tema?: string;
  topK?: number;
}

export interface SearchHit {
  chunk_id: string;
  ruta: string;
  texto: string;
  texto_contexto: string;
  score: number;
  metodo: 'estructurado' | 'hibrido';
  doc: {
    titulo: string;
    numero: string;
    tipo: string;
    url: string;
    /** D2: estado de vigencia tal cual está registrado (sin inventar). */
    vigencia: string;
    autoridad: string;
    /** Fecha de consulta de la fuente (YYYY-MM-DD) o null. */
    fecha_consulta: string | null;
  };
}

export interface ReferenciaNorma {
  articulo?: string;
  numero?: string;
}

export const RRF_K = 60;

/** D3: pesos del rerank determinista (suman 1). Sin dependencias, sin modelo. */
export interface RerankPesos {
  base: number;
  cobertura: number;
  proximidad: number;
  frase: number;
  ruta: number;
  autoridad: number;
}
export const RERANK_PESOS: RerankPesos = {
  base: 0.4,
  cobertura: 0.25,
  proximidad: 0.15,
  frase: 0.08,
  ruta: 0.07,
  autoridad: 0.05,
};

const STOP_ES = new Set(
  'el la los las un una unos unas de del en y o que se su sus por para con como más mas pero este esta estos estas ese esa eso aquel aquello muy sin sobre entre cuando donde cual cuál qué quien quiénes cuanto cuánto haya son fue fueron ser está están estoy explica dime dame'.split(
    ' ',
  ),
);

function normTxt(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9ñ\s]/g, ' ');
}

/** Términos de contenido de la consulta (conserva números: importan los artículos). */
export function terminosConsulta(q: string): string[] {
  return normTxt(q)
    .split(/\s+/)
    .filter((t) => t && (/\d/.test(t) || t.length > 2) && !STOP_ES.has(t));
}

function pesoAutoridad(a: string): number {
  if (a === 'vinculante') return 1;
  if (a === 'interpretativa') return 0.6;
  if (a === 'opinion') return 0.3;
  return 0.5;
}

/**
 * Proximidad: 1 cuando los términos aparecen juntos, →0 dispersos.
 * Ventana mínima que cubre una ocurrencia de cada término distinto:
 * score = nTerms / span. Falta algún término (o <2) → 0 (o 1 si 1 solo).
 */
export function proximidad(terms: string[], tokens: string[]): number {
  const uniq = [...new Set(terms)];
  if (uniq.length < 2) return uniq.length === 1 && tokens.includes(uniq[0]) ? 1 : 0;
  const idx = new Map(uniq.map((t, i) => [t, i]));
  const occ: Array<[number, number]> = [];
  for (let p = 0; p < tokens.length; p++) {
    const ti = idx.get(tokens[p]);
    if (ti !== undefined) occ.push([p, ti]);
  }
  const have = new Set(occ.map(([, ti]) => ti));
  if (have.size < uniq.length) return 0;
  const count = new Array<number>(uniq.length).fill(0);
  let covered = 0;
  let best = Number.POSITIVE_INFINITY;
  let left = 0;
  for (let right = 0; right < occ.length; right++) {
    const ti = occ[right][1];
    if (count[ti] === 0) covered++;
    count[ti]++;
    while (covered === uniq.length && left <= right) {
      const span = occ[right][0] - occ[left][0] + 1;
      if (span < best) best = span;
      const lt = occ[left][1];
      count[lt]--;
      if (count[lt] === 0) covered--;
      left++;
    }
  }
  return best === Number.POSITIVE_INFINITY ? 0 : uniq.length / best;
}

/**
 * D3: reordena candidatos híbridos con señales léxicas + autoridad.
 * Puro y determinista: mismo input → mismo orden. No toca `metodo`.
 */
export function rerank(
  q: string,
  hits: SearchHit[],
  pesos: RerankPesos = RERANK_PESOS,
): SearchHit[] {
  if (hits.length < 2) return hits;
  const terms = terminosConsulta(q);
  const maxBase = Math.max(...hits.map((h) => h.score), 1e-9);
  const nq = normTxt(q).replace(/\s+/g, ' ').trim();
  return hits
    .map((h) => {
      const txt = normTxt(`${h.texto} ${h.texto_contexto ?? ''}`);
      const toks = txt.split(/\s+/).filter(Boolean);
      const words = new Set(toks);
      const cobertura = terms.length ? terms.filter((t) => words.has(t)).length / terms.length : 0;
      const frase = nq.length > 12 && txt.replace(/\s+/g, ' ').includes(nq) ? 1 : 0;
      const rutaW = new Set(normTxt(h.ruta).split(/\s+/));
      const ruta = terms.length ? terms.filter((t) => rutaW.has(t)).length / terms.length : 0;
      const score =
        pesos.base * (h.score / maxBase) +
        pesos.cobertura * cobertura +
        pesos.proximidad * proximidad(terms, toks) +
        pesos.frase * frase +
        pesos.ruta * ruta +
        pesos.autoridad * pesoAutoridad(h.doc.autoridad);
      return { h, score };
    })
    .sort((a, b) => b.score - a.score)
    .map(({ h, score }) => ({ ...h, score: Math.round(score * 10000) / 10000 }));
}

// Detecta identificadores (artículo, ley) para el filtro estructurado primero.
export function detectarRef(q: string): ReferenciaNorma {
  const out: ReferenciaNorma = {};
  const art = q.match(/art[íi]culo\s+(\d+)/i);
  if (art) out.articulo = art[1];
  const ley = q.match(/ley\s+(\d+)(?:\s+de\s+(\d{4}))?/i);
  if (ley) out.numero = ley[2] ? `${ley[1]}/${ley[2]}` : `${ley[1]}%`;
  else if (/constituci[óo]n/i.test(q)) out.numero = 'CP/1991';
  return out;
}

// Fusión RRF sobre dos rankings (listas ordenadas de ids).
export function fuseRrf(
  ftsIds: string[],
  vecIds: string[],
  exclude: Set<string>,
  limit: number,
): Array<{ id: string; score: number }> {
  const rrf = new Map<string, number>();
  ftsIds.forEach((id, i) => rrf.set(id, (rrf.get(id) ?? 0) + 1 / (RRF_K + i + 1)));
  vecIds.forEach((id, i) => rrf.set(id, (rrf.get(id) ?? 0) + 1 / (RRF_K + i + 1)));
  return [...rrf.entries()]
    .sort((a, b) => b[1] - a[1])
    .filter(([id]) => !exclude.has(id))
    .slice(0, limit)
    .map(([id, score]) => ({ id, score }));
}
