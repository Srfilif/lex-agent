// Test de límites arquitectónicos (sin dependencias externas).
// Falla si el dominio/aplicación vuelven a acoplarse a infraestructura o si
// un módulo importa las tripas de otro en lugar de su interfaz pública.
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { dirname, join, relative, resolve } from 'path';

const SRC = resolve(__dirname, '..');
const failures: string[] = [];

function files(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...files(p));
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}

function imports(file: string): Array<{ spec: string; line: number }> {
  const text = readFileSync(file, 'utf-8');
  const out: Array<{ spec: string; line: number }> = [];
  const re = /from\s+['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const line = text.slice(0, m.index).split('\n').length;
    out.push({ spec: m[1], line });
  }
  return out;
}

function fail(file: string, line: number, message: string): void {
  failures.push(`${relative(SRC, file)}:${line} — ${message}`);
}

function isForbidden(spec: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(spec));
}

const MODULES = join(SRC, 'modules');
for (const moduleName of existsSync(MODULES) ? readdirSync(MODULES) : []) {
  const base = join(MODULES, moduleName);
  if (!statSync(base).isDirectory()) continue;
  const layers = ['domain', 'application', 'infrastructure', 'presentation'] as const;
  for (const layer of layers) {
    for (const file of files(join(base, layer))) {
      const imps = imports(file);
      for (const { spec, line } of imps) {
        if (layer === 'domain') {
          if (
            isForbidden(spec, [
              /^@nestjs/,
              /\/application\//,
              /\/infrastructure\//,
              /\/presentation\//,
              /(^|\/)shared\//,
              /(^|\/)db$/,
              /(^|\/)gateway\//,
              /^pg$/,
            ])
          ) {
            fail(file, line, `dominio importa una dependencia externa prohibida: ${spec}`);
          }
        }
        if (layer === 'application') {
          if (
            isForbidden(spec, [
              /\/infrastructure\//,
              /\/presentation\//,
              /(^|\/)db$/,
              /\/gateway\/model-gateway/,
              /^@nestjs\/platform-/,
              /^pg$/,
              /shared\/db\//,
            ])
          ) {
            fail(file, line, `aplicación importa infraestructura concreta: ${spec}`);
          }
        }
        if (layer === 'infrastructure' && /\/presentation\//.test(spec)) {
          fail(file, line, `infraestructura importa presentación: ${spec}`);
        }
        if (layer === 'presentation' && /\/infrastructure\//.test(spec)) {
          fail(file, line, `presentación importa infraestructura concreta: ${spec}`);
        }

        // Regla de límites entre bounded contexts: solo la interfaz pública.
        const resolved = resolve(dirname(file), spec);
        const rel = relative(SRC, resolved).replace(/\\/g, '/');
        const match = /^modules\/([^/]+)(?:\/(.+))?$/.exec(rel);
        if (match && match[1] !== moduleName && match[2] && match[2] !== 'index') {
          fail(
            file,
            line,
            `importa las tripas del módulo ${match[1]}; usa su index público (${spec})`,
          );
        }
      }
    }
  }
}

for (const legacy of ['agent', 'report', 'secop', 'verify']) {
  if (existsSync(join(SRC, legacy))) {
    failures.push(`src/${legacy}/ — carpeta legacy fuera de modules/`);
  }
}

if (failures.length) {
  console.error(`Arquitectura: ${failures.length} violación(es)`);
  for (const f of failures) console.error(`- ${f}`);
  process.exitCode = 1;
} else {
  console.log('Arquitectura OK: dominio puro, aplicación sin infraestructura y límites entre módulos.');
}
