// Extrae el primer objeto {...} balanceado (tolera texto antes/después).
// Deduplicado de agent.service + verifier.service (H8).
export function balancedJson(s: string): string | null {
  const i = s.indexOf('{');
  if (i < 0) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let j = i; j < s.length; j++) {
    const ch = s[j];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') {
      inStr = true;
    } else if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) return s.slice(i, j + 1);
    }
  }
  return null;
}
