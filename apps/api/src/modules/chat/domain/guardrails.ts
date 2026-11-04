// B10: guardarraíles del chat (puros, unit-testeables).
// Moderación por instrucciones (no por temas: una pregunta jurídica sobre
// "porte de armas" es legítima; pedir cómo fabricarlas no). Sin ML: patrones
// explícitos ES/EN, insensibles a mayúsculas y tildes.

export type ModerationHit = 'crisis' | 'ilícito';

function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// Autolesión: manifestaciones directas de intención (ES/EN).
const CRISIS: RegExp[] = [
  /quiero\s+(suicidarme|matarme|quitarme\s+la\s+vida|hacerme\s+dan+o)/,
  /voy\s+a\s+(suicidarme|matarme|quitarme\s+la\s+vida)/,
  /pensando\s+en\s+(suicidarme|matarme|quitarme\s+la\s+vida)/,
  /\bi\s+want\s+to\s+(kill\s+myself|commit\s+suicide|hurt\s+myself)/,
  /\bhow\s+(can|do)\s+i\s+(kill\s+myself|commit\s+suicide)/,
  /como\s+puedo\s+(suicidarme|matarme)/,
];

// Ilícito: búsqueda de instrucciones para daño (no la mera mención del tema).
// Cada patrón exige verbo de fabricación/obtención/ataque + objeto sensible.
const ILICITO: RegExp[] = [
  /como\s+(fabrico|fabricar|hago|hacer|construyo|construir|preparo|preparar|consigo|conseguir)\s+[^.]{0,60}(bomba|explosivo|arma\s+de\s+fuego|silenciador|veneno|droga)/,
  /how\s+to\s+(make|build|cook|synthesize|obtain)\s+[^.]{0,60}(bomb|explosive|gun|silencer|poison|meth|fentanyl)/,
  /para\s+(hackear|atacar|tumbar|clonar)\s+[^.]{0,60}(cuenta|servidor|sitio|tarjeta|whatsapp|correo|banco)/,
  /como\s+robo\s+[^.]{0,60}(identidad|tarjeta|cuenta|banco)/,
  /genera\s+una\s+amenaza\s+de\s+muerte/,
  /escribe\s+una\s+extorsion/,
];

/**
 * Modera el mensaje del usuario. null = admitido. Devuelve la categoría
 * (el llamador mapea a error HTTP sin revelar el patrón).
 */
export function moderate(text: string): ModerationHit | null {
  const t = fold(text);
  if (CRISIS.some((r) => r.test(t))) return 'crisis';
  if (ILICITO.some((r) => r.test(t))) return 'ilícito';
  return null;
}

/** Estimación barata de tokens (~4 chars/token en ES). */
export function estimateTokens(chars: number): number {
  return Math.ceil(Math.max(chars, 0) / 4);
}

export const DISCLAIMER_ABOGADO = 'Verifica con un abogado antes de actuar.';

/**
 * Garantiza el disclaimer en respuestas sustantivas (con herramientas o
 * largas). No duplica si el modelo ya lo incluyó (insensible a
 * mayúsculas/tildes/punto final).
 */
export function ensureDisclaimer(content: string, usedTools: boolean): string {
  const t = content.trimEnd();
  if (!t) return t;
  if (!usedTools && t.length < 500) return content;
  if (fold(t).includes(fold(DISCLAIMER_ABOGADO).replace(/\.$/, ''))) return content;
  return `${t}\n\n${DISCLAIMER_ABOGADO}`;
}

// Inyección indirecta en documentos: instrucciones típicas de jailbreak
// (ES/EN). No bloquea (un texto jurídico puede citarlas): marca aviso.
const INYECCION: RegExp[] = [
  /ignora\s+(tus|las|todas\s+las)\s+(instrucciones|reglas|ordenes)/,
  /ignore\s+(all\s+)?(your|previous|above)\s+(instructions|rules)/,
  /eres\s+ahora\s+un\s+(nuevo\s+)?asistente/,
  /you\s+are\s+now\s+a\s+new\s+assistant/,
  /\[system\]|\bsystem\s*:\s*eres\b/,
  /revela\s+(tu|el)\s+(prompt|system\s+prompt|secreto)/,
  /reveal\s+your\s+(system\s+)?prompt/,
  /haz\s+caso\s+omiso\s+de\s+lo\s+anterior/,
  /disregard\s+all\s+prior/,
];

/** true = el texto contiene marcadores de inyección (aviso, no bloqueo). */
export function scanInjection(text: string): boolean {
  return INYECCION.some((r) => r.test(fold(text.slice(0, 20000))));
}

const ABSTENCION = [
  /evidencia (no|insuficiente)/,
  /no (encontre|tengo|hay|existe).{0,60}(evidencia|informacion|fuentes|soporte)/,
  // "afirmar/confirmar" se excluyen a propósito: suelen venir en respuestas
  // parciales con contenido genuino ("no puedo confirmar X, pero...").
  /no (puedo|es posible) (responder|dar|proporcionar|indicar|ofrecer)/,
  /no (devolvio|arrojo|produjo).{0,40}(resultados?|fragmentos?|ningun|coincidencias?)/,
  /fuera del (corpus|alcance)/,
];

/** true = el modelo declara que la evidencia no alcanza (abstención honesta). */
export function esAbstencion(text: string): boolean {
  return ABSTENCION.some((r) => r.test(fold(text.slice(0, 4000))));
}
