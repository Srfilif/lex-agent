// Dev local sin Docker: API + web con el .env de la raíz.
// Uso: npm run dev   (desde la raíz del repo)
// El entorno real manda; el .env solo rellena huecos (igual que dotenv.ts del API).
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const env = { ...process.env };

const dotEnv = join(ROOT, '.env');
if (!existsSync(dotEnv)) {
  console.warn('[dev] sin .env en la raíz: copia .env.example a .env (se sigue con defaults)');
} else {
  for (const line of readFileSync(dotEnv, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const i = t.indexOf('=');
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim().replace(/^['"]|['"]$/g, '');
    if (k && v && !env[k]) env[k] = v;
  }
}

const port = env.PORT ?? '3000';
if (!env.VITE_API_URL) env.VITE_API_URL = `http://localhost:${port}`;
if (!env.PROJECT_FILES_DIR) env.PROJECT_FILES_DIR = join(ROOT, 'data', 'project-files');
if (!env.META_API_KEY) {
  console.warn('[dev] META_API_KEY ausente: el API arranca pero el chat/RAG no funcionará');
}

const procs = [];
let shuttingDown = false;

function killTree(p) {
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(p.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      p.kill('SIGTERM');
    }
  } catch {
    // ya terminó
  }
}

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const p of procs) killTree(p);
  setTimeout(() => process.exit(code), 2000);
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

function run(name, command) {
  const p = spawn(command, { cwd: ROOT, env, shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
  procs.push(p);
  p.stdout.on('data', (d) => process.stdout.write(`[${name}] ${d}`));
  p.stderr.on('data', (d) => process.stderr.write(`[${name}] ${d}`));
  p.on('exit', (code, signal) => {
    if (shuttingDown) return;
    console.error(`[dev] ${name} terminó (${signal ?? `código ${code}`}): deteniendo todo`);
    shutdown(1);
  });
}

console.log(`[dev] API → http://localhost:${port} · web → http://localhost:5173`);
run('api', 'npm --prefix apps/api run start:dev');
run('web', 'npm --prefix apps/web run dev');
