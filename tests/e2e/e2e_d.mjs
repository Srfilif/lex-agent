// Pase E2E D corpus/cobertura/vigencia (desechable). Uso: node e2e_d.mjs
// Footer vivo + vigencia en Fragmento (modo chat). Gasta 1 chat (~$0.03).
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

// 1. Footer vivo en login (público, sin auth)
await page.goto(WEB, { waitUntil: 'networkidle' });
await page.getByText(/Corpus: 3 documentos/).waitFor({ timeout: 20000 });
check('footer login vivo', true);
const footLogin = await page.locator('footer p').first().textContent();
check('footer conteos live', /3 documentos.*1407 fragmentos/.test(footLogin ?? ''), footLogin ?? '');
await page.screenshot({ path: 'shots/d01-footer-login.png' });

// 2. Registro + login
const email = `d-${Date.now()}@lex.co`;
await page.getByRole('button', { name: 'Regístrate' }).click();
await page.getByPlaceholder('tucorreo@ejemplo.co').fill(email);
await page.getByPlaceholder('Mínimo 8 caracteres').fill('clave-d-1234');
await page.getByRole('button', { name: 'Registrarme' }).click();
await page.getByText('Ahora inicia sesión').waitFor({ timeout: 20000 });
await page.getByPlaceholder('Mínimo 8 caracteres').fill('clave-d-1234');
await page.getByRole('button', { name: 'Entrar' }).click();
await page.getByRole('button', { name: 'Chat', exact: true }).waitFor({ timeout: 20000 });
check('login', true);
await page.getByText(/Corpus: 3 documentos/).waitFor({ timeout: 20000 });
const footChat = await page.locator('footer p').first().textContent();
check('footer chat vivo', /3 documentos.*1407 fragmentos/.test(footChat ?? ''), footChat ?? '');

// 3. RAG + cita → Fragmento con vigencia
await page.locator('button[title="Nueva conversación"]').click();
await page.getByPlaceholder(/pregunta jurídica/).fill('¿Qué dice el artículo 24 de la Ley 80? Una frase.');
await page.getByRole('button', { name: 'Enviar' }).click();
await page.getByRole('button', { name: /Regenerar respuesta/ }).waitFor({ timeout: 240000 });
const citas = page.locator('div.citas button.cita');
await citas.first().waitFor({ timeout: 30000 });
check('citas render', (await citas.count()) > 0);
await citas.first().click();
await page.getByText(/Vigencia:/).first().waitFor({ timeout: 20000 });
const vig = await page.locator('aside.fragmento').textContent();
check('fragmento vigencia', /Vigencia: .* · Autoridad: vinculante/.test(vig ?? ''), (vig ?? '').slice(0, 160));
await page.screenshot({ path: 'shots/d02-fragmento-vigencia.png' });

check('sin pageerrors/console.errors', errors.length === 0, errors.slice(0, 3).join(' | '));
check('sin 4xx/5xx', httpFallos.length === 0, httpFallos.join(' | '));
await browser.close();
if (fails) {
  console.log(`${fails} e2e-d roto(s)`);
  process.exit(1);
}
console.log('e2e d verde');
