// Normalización de textos jurídicos (HTML o plano).
// Dominio puro: sin Nest, sin pg, sin HTTP.

export function looksLikeHtml(s: string): boolean {
  return /<(html|body|div|p|br|table|font|span)[\s>]/i.test(s);
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

export function stripHtml(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<\s*br\s*\/?>/gi, '\n')
      .replace(/<\s*\/(p|div|li|tr|h\d)\s*>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  );
}

// Normaliza preservando saltos de línea (la detección de artículos los usa).
export function normalizeText(input: string): string {
  let t = input.normalize('NFC');
  if (looksLikeHtml(t)) t = stripHtml(t);
  t = t.replace(/\r\n?/g, '\n');
  t = t
    .split('\n')
    .map((l) => l.replace(/[ \t]+/g, ' ').trim())
    .join('\n');
  t = t.replace(/\n{3,}/g, '\n\n').trim();
  return t;
}
