// Pase E2E B11 títulos/sugerencias/temas (desechable). Uso: node e2e_b11.mjs
// Chips de seguimiento clicables + temas en el header (título async).
// Gasta 2 chats + 1-2 sugerencias + 1 título (~$0.05).
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

const email = `b11-${Date.now()}@lex.co`;
await page.goto(WEB, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Regístrate' }).click();
await page.getByPlaceholder('tucorreo@ejemplo.co').fill(email);
await page.getByPlaceholder('Mínimo 8 caracteres').fill('clave-b11-123');
await page.getByRole('button', { name: 'Registrarme' }).click();
await page.getByText('Ahora inicia sesión').waitFor({ timeout: 20000 });
await page.getByPlaceholder('Mínimo 8 caracteres').fill('clave-b11-123');
await page.getByRole('button', { name: 'Entrar' }).click();
await page.getByRole('button', { name: 'Chat', exact: true }).waitFor({ timeout: 20000 });
check('login', true);

await page.locator('button[title="Nueva conversación"]').click();
await page.getByPlaceholder(/pregunta jurídica/).fill('¿Qué dice el artículo 24 de la Ley 80? Una frase.');
await page.getByRole('button', { name: 'Enviar' }).click();
await page.getByRole('button', { name: /Regenerar respuesta/ }).waitFor({ timeout: 240000 });
check('respuesta 1', true);

// Chips de seguimiento (1 llamada barata async)
const chips = page.locator('div[aria-label="Preguntas sugeridas"] button');
await chips.first().waitFor({ timeout: 90000 });
const n = await chips.count();
check('chips 1-3', n >= 1 && n <= 3, `n=${n}`);
await page.screenshot({ path: 'shots/s01-chips.png' });

// Click en chip → envía y responde
await chips.first().click();
await page.locator('.burbuja.user').nth(1).waitFor({ timeout: 30000 });
await page.getByRole('button', { name: /Regenerar respuesta/ }).waitFor({ timeout: 240000 });
check('chip envía y responde', (await page.locator('.burbuja.assistant').count()) >= 2);

// Temas en el header (título async + refresh 6s/18s)
await page.getByText(/Temas:/).first().waitFor({ timeout: 120000 });
check('temas visibles', true);
await page.screenshot({ path: 'shots/s02-temas.png' });

check('sin pageerrors/console.errors', errors.length === 0, errors.slice(0, 3).join(' | '));
check('sin 4xx/5xx', httpFallos.length === 0, httpFallos.join(' | '));
await browser.close();
if (fails) {
  console.log(`${fails} e2e-b11 roto(s)`);
  process.exit(1);
}
console.log('e2e b11 verde');
