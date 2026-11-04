// Pase E2E memoria B8 (desechable). Uso: node e2e_memory.mjs
// Opt-in + recuerdo manual + hilo largo (2×8000) → resumen + hilo sigue.
// Gasta 3 mensajes de chat + 1 resumen (~$0.05-0.15).
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
// Relleno jurídico (~7900 chars, bajo el tope 8000 del DTO).
const PARRAFO =
  'El principio de transparencia rige la contratación estatal: toda actuación debe ser pública, ' +
  'trazable y motivada. La Ley 80 de 1993 exige pliegos claros, criterios objetivos de selección y ' +
  'publicidad de cada etapa del proceso en el sistema electrónico de contratación. ';
function largo(cierre) {
  let t = '';
  while (t.length + PARRAFO.length + cierre.length < 7900) t += PARRAFO;
  return t + cierre;
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

const email = `b8-${Date.now()}@lex.co`;
const pass = 'clave-b8-123';
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

// Cuenta → opt-in memoria + recuerdo manual
await page.getByRole('button', { name: 'Cuenta' }).click();
await page.getByRole('tab', { name: 'Preferencias' }).click();
const toggle = page.getByRole('checkbox', { name: /Memoria entre chats/ });
await toggle.waitFor({ timeout: 20000 });
check('toggle default off', !(await toggle.isChecked()));
await toggle.click();
await page.getByText('Preferencias guardadas.').waitFor({ timeout: 20000 });
check('opt-in UI', true);
await page.getByPlaceholder('p. ej. Mi área es contratación estatal').fill('Mi área es contratación estatal');
await page.getByRole('button', { name: 'Agregar' }).click();
await page.getByText('1/50 recuerdos').waitFor({ timeout: 20000 });
check('recuerdo manual', true);
await page.screenshot({ path: 'shots/c01-memoria.png' });

// Hilo largo: 3 mensajes de ~7900 chars con respuesta corta pedida
await page.getByRole('button', { name: 'Chat', exact: true }).click();
await page.locator('button[title="Nueva conversación"]').click();
await page.getByPlaceholder(/pregunta jurídica/).fill(largo('Responde en una sola frase: ¿qué ley rige esto?'));
await page.getByRole('button', { name: 'Enviar' }).click();
await page.getByRole('button', { name: /Regenerar respuesta/ }).waitFor({ timeout: 240000 });
check('msg1 largo ok', true);
await page
  .getByPlaceholder(/pregunta jurídica/)
  .fill(
    largo(
      'Recuerda: mi área es contratación estatal y prefiero listas numeradas. Responde en una sola frase.',
    ),
  );
await page.getByRole('button', { name: 'Enviar' }).click();
await page.getByRole('button', { name: /Regenerar respuesta/ }).first().waitFor({ timeout: 240000 });
check('msg2 largo ok', true);
await page.getByPlaceholder(/pregunta jurídica/).fill(largo('Tercer bloque de contexto para forzar el resumen. Responde en una sola frase.'));
await page.getByRole('button', { name: 'Enviar' }).click();
await page.getByRole('button', { name: /Regenerar respuesta/ }).first().waitFor({ timeout: 240000 });
check('msg3 largo ok', true);

// El hilo compactó: resumen + avance persistidos
const login = await api('POST', '/auth/login', { email, password: pass });
const at = login.json.access_token;
const convs = await api('GET', '/chat/conversations', null, at);
const cid = convs.json.conversations[0].id;
const det = await api('GET', `/chat/conversations/${cid}`, null, at);
check('resumen texto', (det.json.conversation.summary?.length ?? 0) > 100, `len=${det.json.conversation.summary?.length ?? 0}`);
check('resumen avanza', (det.json.conversation.summary_count ?? 0) >= 1, `count=${det.json.conversation.summary_count}`);
const mems = await api('GET', '/account/memories', null, at);
console.log(`INFO recuerdos tras compactar: ${mems.json.memories.length} (manual + auto)`);
await page.screenshot({ path: 'shots/c02-hilo-largo.png' });

// El hilo sigue respondiendo tras compactar
await page.getByPlaceholder(/pregunta jurídica/).fill('¿Qué ley mencionamos al inicio? Una frase.');
await page.getByRole('button', { name: 'Enviar' }).click();
await page.getByRole('button', { name: /Regenerar respuesta/ }).first().waitFor({ timeout: 240000 });
check('msg4 post-compacto ok', true);

// Opt-out desde la UI
await page.getByRole('button', { name: 'Cuenta' }).click();
await page.getByRole('tab', { name: 'Preferencias' }).click();
await page.getByRole('checkbox', { name: /Memoria entre chats/ }).click();
await page.getByText('Preferencias guardadas.').last().waitFor({ timeout: 20000 });
check('opt-out UI', true);

check('sin pageerrors/console.errors', errors.length === 0, errors.slice(0, 3).join(' | '));
check('sin 4xx/5xx', httpFallos.length === 0, httpFallos.join(' | '));
await browser.close();
if (fails) {
  console.log(`${fails} e2e-memory roto(s)`);
  process.exit(1);
}
console.log('e2e memory verde');
