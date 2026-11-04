// Fragmentación estructural de normas: por artículo (ver RAG_DESIGN.md).
// Fallback: párrafos agrupados para textos sin artículos.
// Dominio puro: sin Nest, sin pg, sin HTTP.

export interface Chunk {
  ruta: string;
  texto: string;
  texto_contexto: string;
  offset_inicio: number;
  offset_fin: number;
}

// Solo mayúsculas: continuaciones en minúscula ("artículo 29, el numeral...")
// no son encabezados. Si un texto no trae encabezados, se usa chunkParrafos.
const ART_RE =
  /^ART[ÍI]CULO\s+(\d+[°ºoO]?)\s*[.\-—:–]?\s*(.*)$/gm;

export function chunkNorma(fullText: string, corto: string): Chunk[] {
  const heads: Array<{ num: string; titulo: string; idx: number }> = [];
  let m: RegExpExecArray | null;
  ART_RE.lastIndex = 0;
  while ((m = ART_RE.exec(fullText)) !== null) {
    heads.push({ num: m[1], titulo: (m[2] ?? '').trim(), idx: m.index });
    if (heads.length > 5000) break;
  }
  if (heads.length === 0) return chunkParrafos(fullText, corto);

  // Filtra encabezados falsos: artículos de otras normas citados en notas
  // (p. ej. "ARTÍCULO 38..." del Decreto 2150 citado en la Ley 80).
  // Solo se aceptan números dentro de [max-2, max+1]: cubre duplicados
  // original+vigente y rechaza saltos grandes o retrocesos citados.
  const numInt = (s: string) => parseInt(s.replace(/\D/g, ''), 10);
  const ok: typeof heads = [];
  let max = -1;
  for (const h of heads) {
    const v = numInt(h.num);
    if (Number.isNaN(v)) continue;
    if (max < 0 || (v <= max + 1 && v >= max - 2)) {
      ok.push(h);
      if (v > max) max = v;
    }
  }
  heads.length = 0;
  heads.push(...ok);
  if (heads.length === 0) return chunkParrafos(fullText, corto);

  const chunks: Chunk[] = [];
  // Encabezado: todo lo previo al primer artículo (título, considerandos).
  if (heads[0].idx > 0) {
    const texto = fullText.slice(0, heads[0].idx).trim();
    if (texto.length > 0) {
      const ruta = `${corto} > Encabezado`;
      if (texto.length <= 6000) {
        chunks.push({ ruta, texto, texto_contexto: corto, offset_inicio: 0, offset_fin: heads[0].idx });
      } else {
        for (const p of chunkParrafos(texto, ruta)) {
          chunks.push({ ...p, texto_contexto: corto });
        }
      }
    }
  }
  for (let i = 0; i < heads.length; i++) {
    const start = heads[i].idx;
    const end = i + 1 < heads.length ? heads[i + 1].idx : fullText.length;
    const base = `${corto} > Art. ${heads[i].num}`;
    const headerLine = fullText.slice(start, fullText.indexOf('\n', start)).trim();
    for (const sub of splitNumerales(fullText.slice(start, end), base)) {
      chunks.push({
        ruta: sub.ruta,
        texto: sub.texto,
        texto_contexto: `${base} — ${headerLine.slice(0, 200)}`,
        offset_inicio: start + sub.relStart,
        offset_fin: start + sub.relEnd,
      });
    }
  }
  return chunks;
}

// Subdivide un artículo por numerales/parágrafos (RAG_DESIGN: Art. > num.).
// Si no hay numerales, devuelve el artículo entero.
const NUM_RE = /^(\d+\s*[oº°]?[.)]\s|PAR[ÁA]GRAFO\b).*$/gm;

function splitNumerales(
  artText: string,
  base: string,
): Array<{ ruta: string; texto: string; relStart: number; relEnd: number }> {
  const marks: Array<{ idx: number; label: string }> = [];
  let m: RegExpExecArray | null;
  NUM_RE.lastIndex = 0;
  while ((m = NUM_RE.exec(artText)) !== null) {
    const line = m[1].trim();
    const par = line.match(/^PAR[ÁA]GRAFO\s*(\d*\s*[oº°]?)?/);
    const num = line.match(/^(\d+\s*[oº°]?)[.)]/);
    const label = par ? `Par.${par[1] ? ' ' + par[1].trim() : ''}` : `num. ${num?.[1].replace(/\s+/g, '')}`;
    marks.push({ idx: m.index, label });
    if (marks.length > 500) break;
  }
  // Sin numerales → artículo entero, o por párrafos si es muy largo.
  if (marks.length === 0) {
    if (artText.length <= 6000) {
      return [{ ruta: base, texto: artText.trim(), relStart: 0, relEnd: artText.length }];
    }
    return chunkParrafos(artText, base).map((c) => ({
      ruta: c.ruta,
      texto: c.texto,
      relStart: c.offset_inicio,
      relEnd: c.offset_fin,
    }));
  }
  const out: Array<{ ruta: string; texto: string; relStart: number; relEnd: number }> = [];
  // Preámbulo del artículo antes del primer numeral (normalmente el encabezado).
  if (marks[0].idx > 0) {
    const pre = artText.slice(0, marks[0].idx).trim();
    if (pre.length > 50) {
      out.push({ ruta: `${base} > encabezado`, texto: pre, relStart: 0, relEnd: marks[0].idx });
    }
  }
  for (let i = 0; i < marks.length; i++) {
    const s = marks[i].idx;
    const e = i + 1 < marks.length ? marks[i + 1].idx : artText.length;
    out.push({
      ruta: `${base} > ${marks[i].label}`,
      texto: artText.slice(s, e).trim(),
      relStart: s,
      relEnd: e,
    });
  }
  // Tope: ningún fragmento supera ~6000 caracteres (notas larguísimas se parten).
  const capped: typeof out = [];
  for (const c of out) {
    if (c.texto.length <= 6000) {
      capped.push(c);
      continue;
    }
    for (const p of chunkParrafos(c.texto, c.ruta)) {
      capped.push({
        ruta: p.ruta,
        texto: p.texto,
        relStart: c.relStart + p.offset_inicio,
        relEnd: c.relStart + p.offset_fin,
      });
    }
  }
  return capped;
}

export function chunkParrafos(fullText: string, corto: string): Chunk[] {
  // Agrupa líneas hasta ~2000 caracteres (las notas usan \n simple).
  // Las líneas anormalmente largas se cortan por palabras.
  const segs: Array<{ text: string; start: number }> = [];
  let off = 0;
  for (const line of fullText.split('\n')) {
    if (line.length <= 2000) {
      segs.push({ text: line, start: off });
    } else {
      let cur = '';
      let curStart = off;
      for (const w of line.split(' ')) {
        if (cur && cur.length + 1 + w.length > 2000) {
          segs.push({ text: cur, start: curStart });
          curStart += cur.length + 1;
          cur = w;
        } else {
          cur = cur ? cur + ' ' + w : w;
        }
      }
      if (cur) segs.push({ text: cur, start: curStart });
    }
    off += line.length + 1;
  }
  const chunks: Chunk[] = [];
  let buf: string[] = [];
  let bufStart = 0;
  let bufLen = 0;
  const flush = (end: number) => {
    const texto = buf.join('\n').trim();
    if (texto) {
      chunks.push({
        ruta: `${corto} > parte ${chunks.length + 1}`,
        texto,
        texto_contexto: corto,
        offset_inicio: bufStart,
        offset_fin: end,
      });
    }
    buf = [];
    bufLen = 0;
  };
  for (const s of segs) {
    if (buf.length === 0) bufStart = s.start;
    if (bufLen + s.text.length + 1 > 2000 && bufLen > 0) {
      flush(s.start);
      bufStart = s.start;
    }
    buf.push(s.text);
    bufLen += s.text.length + 1;
  }
  flush(fullText.length);
  return chunks;
}
