// Pase E2E storage (desechable). Uso: node e2e_storage.mjs. Sin costo LLM.
import { chromium } from 'playwright-core';

const WEB = 'http://localhost:4173';
const API = 'http://localhost:3000';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
let fails = 0;
function check(name, ok, extra = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ` ${extra}`}`);
  if (!ok) fails++;
}

// Siembra por API: usuario + proyecto + 2 archivos.
const email = `stor-${Date.now()}@lex.co`;
const pass = 'clave-stor-123';
const j = (m, u, b, t) =>
  fetch(API + u, {
    method: m,
    headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
    body: b ? JSON.stringify(b) : undefined,
  }).then(async (r) => ({ status: r.status, json: await r.json().catch(() => null) }));
await j('POST', '/auth/register', { email, password: pass, terms_accepted: true, privacy_accepted: true });
const l = await j('POST', '/auth/login', { email, password: pass, terms_accepted: true, privacy_accepted: true });
const at = l.json?.access_token;
if (!at) {
  console.log('FAIL siembra login ' + l.status);
  process.exit(1);
}
const pr = await j('POST', '/chat/projects', { name: 'Caso Storage' }, at);
const pid = pr.json?.id;
for (const [name, text] of [
  ['acta.txt', 'ACTA 001. El comité aprueba el pliego ZAFIRO para la licitación.'],
  ['nota.md', '# Nota\n\nSeguimiento al contrato **ZAFIRO** con póliza vigente.'],
]) {
  const fd = new FormData();
  fd.append('file', new Blob([text], { type: 'text/plain' }), name);
  const r = await fetch(`${API}/chat/projects/${pid}/files`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${at}` },
    body: fd,
  });
  if (r.status !== 201) {
    console.log(`FAIL siembra upload ${name} ${r.status}`);
    process.exit(1);
  }
}
check('siembra 2 archivos', true);

const browser = await chromium.launch({
  executablePath: EDGE,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) {
    errors.push(`console: ${m.text().slice(0, 200)}`);
  }
});
const httpFallos = [];
page.on('response', (r) => {
  if (r.status() >= 400) httpFallos.push(`${r.status()} ${new URL(r.url()).pathname}`);
});

await page.goto(WEB, { waitUntil: 'networkidle' });
await page.getByPlaceholder('tucorreo@ejemplo.co').fill(email);
await page.getByPlaceholder('Mínimo 8 caracteres').fill(pass);
await page.getByRole('button', { name: 'Entrar' }).click();
await page.getByRole('button', { name: 'Chat', exact: true }).waitFor({ timeout: 20000 });
check('login', true);

// Deep-link /storage.
await page.goto(`${WEB}/storage`, { waitUntil: 'networkidle' });
await page.getByText('acta.txt').waitFor({ timeout: 20000 });
check('lista acta', true);
check('lista nota', (await page.getByText('nota.md').count()) === 1);
check('totales', (await page.getByText(/2 archivo\(s\)/).count()) === 1);
check('proyecto visible', (await page.getByText('Caso Storage').count()) >= 1);
await page.screenshot({ path: 'shots/st01-storage.png' });

// Filtro por búsqueda.
await page.getByPlaceholder('Nombre o proyecto…').fill('acta');
check('filtro acta', (await page.getByText('nota.md').count()) === 0);
await page.getByPlaceholder('Nombre o proyecto…').fill('');
await page.getByText('nota.md').waitFor({ timeout: 10000 });
check('filtro limpio', true);

// Descarga real.
const [dl] = await Promise.all([
  page.waitForEvent('download', { timeout: 20000 }),
  page.locator('li', { hasText: 'acta.txt' }).getByRole('button', { name: /Descargar/ }).click(),
]);
const ruta = await dl.path();
check('descarga acta', (dl.suggestedFilename() ?? '').includes('acta.txt'), dl.suggestedFilename());
await page.screenshot({ path: 'shots/st02-descarga.png' });

// Borrado con confirmación.
await page.locator('li', { hasText: 'nota.md' }).getByRole('button', { name: /Borrar/ }).click();
await page.getByRole('button', { name: '¿Sí?' }).click();
await page.getByText('«nota.md» eliminado.').waitFor({ timeout: 20000 });
check('borrado aviso', true);
check('totales 1', (await page.getByText(/1 archivo\(s\)/).count()) === 1);

// Alias /settings/storage muestra lo mismo.
await page.goto(`${WEB}/settings/storage`, { waitUntil: 'networkidle' });
await page.getByText('acta.txt').waitFor({ timeout: 20000 });
check('alias settings/storage', true);

check('sin pageerrors/console.errors', errors.length === 0, errors.slice(0, 3).join(' | '));
check('sin 4xx/5xx', httpFallos.length === 0, httpFallos.join(' | '));
await browser.close();
if (fails) {
  console.log(`${fails} e2e-storage roto(s)`);
  process.exit(1);
}
console.log('e2e storage verde');
