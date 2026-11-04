// Carga KEY=valor de .env (raíz del repo) sin pisar el entorno real.
// Usado por la config de Nest y por los CLIs host-side.
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export function loadDotenv(root: string): void {
  const p = join(root, '.env');
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, 'utf-8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const i = t.indexOf('=');
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim().replace(/^['"]|['"]$/g, '');
    if (k && v && !process.env[k]) process.env[k] = v;
  }
}
