// Pase E2E modelos B7 (desechable). Uso: node e2e_models.mjs
// free sin selector → grant plus → selector → chat con wonder.
// Gasta 1 mensaje de chat (wonder).
import { execSync } from 'node:child_process';
import { chromium } from 'playwright-core';

const WEB = 'http://localhost:4173';
const API = 'http://localhost:3000';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
let fails = 0;
function check(name, ok, extra = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ` ${extra}`}`);
  if (!ok) fails++;
}
async function api(method, path, body, token) {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, json: await r.json().catch(() => null) };
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

const email = `b7-${Date.now()}@lex.co`;
const pass = 'clave-b7-123';
await page.goto(WEB, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Regístrate' }).click();
await page.getByPlaceholder('tucorreo@ejemplo.co').fill(email);
await page.getByPlaceholder('Mínimo 8 caracteres').fill(pass);
await page.getByRole('button', { name: 'Registrarme' }).click();
await page.getByText('Ahora inicia sesión').waitFor({ timeout: 20000 });
await page.getByPlaceholder('Mínimo 8 caracteres').fill(pass);
await page.getByRole('button', { name: 'Entrar' }).click();
await page.getByRole('button', { name: 'Chat', exact: true }).waitFor({ timeout: 20000 });
check('login', true);

// Free: sin selector, meta muestra el único modelo
await page.getByText(/Modelo efectivo/).waitFor({ timeout: 20000 });
check('free sin selector', (await page.getByLabel('Modelo de chat').count()) === 0);
check(
  'free meta spark',
  await page.getByText('Modelo efectivo: muse-spark-1.3').count().then((n) => n >= 1),
);
await page.screenshot({ path: 'shots/m01-free.png' });

// Promover a admin (mismo SQL que make:admin) + grant plus + re-login
execSync(
  `docker exec lexagent-db-1 psql -U lex -d lexdb -c "UPDATE users SET role='admin', status='active', email_verified_at=COALESCE(email_verified_at, now()) WHERE email='${email}'"`,
  { stdio: 'pipe' },
);
const login = await api('POST', '/auth/login', { email, password: pass });
const at = login.json.access_token;
check('re-login admin', !!at, login.status);
const userId = execSync(
  `docker exec lexagent-db-1 psql -U lex -d lexdb -t -c "SELECT id FROM users WHERE email='${email}'"`,
  { encoding: 'utf8' },
).trim();
const grant = await api(
  'POST',
  '/admin/billing/grant',
  { user_id: userId, plan: 'plus', days: 30 },
  at,
);
check('grant plus', grant.status === 201, `${grant.status} ${JSON.stringify(grant.json).slice(0, 150)}`);

// Recargar: aparece el selector con wonder
await page.reload({ waitUntil: 'networkidle' });
await page.getByLabel('Modelo de chat').waitFor({ timeout: 20000 });
const opciones = await page.getByLabel('Modelo de chat').locator('option').allInnerTexts();
check('selector con wonder', opciones.some((o) => o.includes('muse-wonder-1.0')), opciones.join('|'));
await page.screenshot({ path: 'shots/m02-plus-selector.png' });

// Chat con wonder
await page.getByLabel('Modelo de chat').selectOption('muse-wonder-1.0');
await page.locator('button[title="Nueva conversación"]').click();
await page.getByPlaceholder(/pregunta jurídica/).fill('¿Qué dice el artículo 24 de la Ley 80? Cita la fuente.');
await page.getByRole('button', { name: 'Enviar' }).click();
await page.getByRole('button', { name: /Regenerar respuesta/ }).waitFor({ timeout: 240000 });
check('responde con wonder', (await page.getByText('modelo muse-wonder-1.0').count()) >= 1);
check(
  'wonder cita fuente',
  (await page.locator('.burbuja.assistant .citas .cita').count()) >= 1,
);
await page.screenshot({ path: 'shots/m03-wonder.png' });

check('sin pageerrors/console.errors', errors.length === 0, errors.slice(0, 3).join(' | '));
check('sin 4xx/5xx', httpFallos.length === 0, httpFallos.join(' | '));
await browser.close();
if (fails) {
  console.log(`${fails} e2e-models roto(s)`);
  process.exit(1);
}
console.log('e2e models verde');
