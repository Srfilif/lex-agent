// Pase E2E stop (desechable). Uso: node e2e_stop.mjs. Gasta 1 turno parcial.
import { chromium } from 'playwright-core';

const WEB = 'http://localhost:4173';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
let fails = 0;
function check(name, ok, extra = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ` ${extra}`}`);
  if (!ok) fails++;
}

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

const email = `stop-${Date.now()}@lex.co`;
await page.goto(WEB, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Regístrate' }).click();
await page.getByPlaceholder('tucorreo@ejemplo.co').fill(email);
await page.getByPlaceholder('Mínimo 8 caracteres').fill('clave-stop-12');
await page.getByRole('button', { name: 'Registrarme' }).click();
await page.getByText('Ahora inicia sesión').waitFor({ timeout: 20000 });
await page.getByPlaceholder('Mínimo 8 caracteres').fill('clave-stop-12');
await page.getByRole('button', { name: 'Entrar' }).click();
await page.getByRole('button', { name: 'Chat', exact: true }).waitFor({ timeout: 20000 });
check('login', true);

await page.locator('button[title="Nueva conversación"]').click();
await page
  .getByPlaceholder(/pregunta jurídica/)
  .fill('Explica en detalle todos los principios de la contratación estatal con ejemplos extensos.');
await page.getByRole('button', { name: 'Enviar' }).click();
await page.getByRole('button', { name: 'Detener' }).waitFor({ timeout: 15000 });
check('botón Detener visible', true);
await page.screenshot({ path: 'shots/s01-detener.png' });
await page.getByRole('button', { name: 'Detener' }).click();
await page.getByRole('button', { name: 'Enviar' }).waitFor({ timeout: 15000 });
check('volver a Enviar tras stop', true);
const asistentes = await page.locator('.burbuja.assistant').count();
check('burbuja asistente existe', asistentes >= 1, `n=${asistentes}`);
await page.screenshot({ path: 'shots/s02-detenido.png' });

check('sin pageerrors/console.errors', errors.length === 0, errors.slice(0, 3).join(' | '));
check('sin 4xx/5xx', httpFallos.length === 0, httpFallos.join(' | '));
await browser.close();
if (fails) {
  console.log(`${fails} e2e-stop roto(s)`);
  process.exit(1);
}
console.log('e2e stop verde');
