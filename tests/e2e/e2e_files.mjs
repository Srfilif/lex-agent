// Pase E2E archivos B6 (desechable). Uso: node e2e_files.mjs
// Proyecto → upload txt → duplicado → pdf rechazado → chat cita archivo →
// visor proyecto → borrado. Gasta 1 mensaje de chat.
import { chromium } from 'playwright-core';

const WEB = 'http://localhost:4173';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
let fails = 0;
function check(name, ok, extra = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ` ${extra}`}`);
  if (!ok) fails++;
}
const TEXTO = `MEMORANDO INTERNO — PLIEGOS TIPO 2026

El comite aprobo el procedimiento TURMALINA para evaluar pliegos tipo: toda oferta
debe traer poliza de seriedad vigente y certificado bancario no mayor a 30 dias.

ARTICULO 1. DEL PROCEDIMIENTO TURMALINA. En virtud del procedimiento TURMALINA, la
entidad verificara la poliza de seriedad antes de abrir el sobre economico.
`;

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

const email = `b6-${Date.now()}@lex.co`;
await page.goto(WEB, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Regístrate' }).click();
await page.getByPlaceholder('tucorreo@ejemplo.co').fill(email);
await page.getByPlaceholder('Mínimo 8 caracteres').fill('clave-b6-123');
await page.getByRole('button', { name: 'Registrarme' }).click();
await page.getByText('Ahora inicia sesión').waitFor({ timeout: 20000 });
await page.getByPlaceholder('Mínimo 8 caracteres').fill('clave-b6-123');
await page.getByRole('button', { name: 'Entrar' }).click();
await page.getByRole('button', { name: 'Chat', exact: true }).waitFor({ timeout: 20000 });
check('login', true);

// Proyecto + filtro
await page.locator('section.side-proyectos button:has-text("+ Nuevo")').click();
await page.getByLabel('Nombre del proyecto').fill('Caso B6');
await page.getByLabel('Instrucciones del proyecto').fill('Prioriza mis archivos.');
await page.getByRole('button', { name: 'Crear proyecto' }).click();
await page.locator('section.side-proyectos .side-item:has-text("Caso B6")').waitFor({ timeout: 20000 });
await page.locator('section.side-proyectos .side-item:has-text("Caso B6")').click();
await page.getByLabel('Subir archivo .txt o .md').waitFor({ timeout: 20000 });
check('sección archivos visible', true);

// Upload válido
await page.getByLabel('Subir archivo .txt o .md').setInputFiles({
  name: 'memorando.txt',
  mimeType: 'text/plain',
  buffer: Buffer.from(TEXTO),
});
await page.getByText(/Archivo listo|fragmentos?\)/).first().waitFor({ timeout: 60000 });
check('upload + aviso', true);
await page.getByText('memorando.txt').first().waitFor({ timeout: 20000 });
check('lista muestra archivo', true);
await page.getByText(/1\/20 archivos/).waitFor({ timeout: 20000 });
check('cuota 1/20', true);
await page.screenshot({ path: 'shots/f01-archivos.png' });

// Duplicado + pdf
await page.getByLabel('Subir archivo .txt o .md').setInputFiles({
  name: 'copia.txt',
  mimeType: 'text/plain',
  buffer: Buffer.from(TEXTO),
});
await page.getByText(/duplicado/).first().waitFor({ timeout: 60000 });
check('aviso duplicado', true);
await page.getByLabel('Subir archivo .txt o .md').setInputFiles({
  name: 'ley.pdf',
  mimeType: 'application/pdf',
  buffer: Buffer.from('%PDF-1.4 falso'),
});
await page.getByText(/solo se aceptan/i).first().waitFor({ timeout: 30000 });
check('pdf rechazado honesto', true);

// Chat del proyecto cita el archivo
await page.locator('button[title="Nueva conversación"]').click();
await page.getByPlaceholder(/pregunta jurídica/).fill('¿Qué exige el procedimiento TURMALINA según mis archivos?');
await page.getByRole('button', { name: 'Enviar' }).click();
await page.getByRole('button', { name: /Regenerar respuesta/ }).waitFor({ timeout: 240000 });
const chip = page.locator('.burbuja.assistant .citas .cita:has-text("memorando.txt")');
check('respuesta cita archivo', (await chip.count()) >= 1, await chip.count());
await page.screenshot({ path: 'shots/f02-respuesta.png' });
await chip.first().click();
await page.locator('.fragmento blockquote').first().waitFor({ timeout: 20000 });
const frag = await page.locator('.fragmento').first().innerText();
check('visor proyecto', frag.includes('memorando.txt') && frag.includes('TURMALINA'), frag.slice(0, 120));
await page.screenshot({ path: 'shots/f03-fragmento.png' });

// Borrado
await page.locator('button[title="Borrar memorando.txt"]').click();
await page.getByRole('button', { name: '¿Sí?', exact: true }).click();
await page.getByText(/Sin archivos/).waitFor({ timeout: 20000 });
check('borrar actualiza', true);
await page.getByText(/0\/20 archivos/).waitFor({ timeout: 20000 });
check('cuota 0/20', true);

check('sin pageerrors/console.errors', errors.length === 0, errors.slice(0, 3).join(' | '));
const inesperados = httpFallos.filter((f) => f !== '400 /chat/projects' && !f.startsWith('400 /chat/projects/'));
check('solo 4xx esperados', inesperados.length === 0, inesperados.join(' | '));
await browser.close();
if (fails) {
  console.log(`${fails} e2e-files roto(s)`);
  process.exit(1);
}
console.log('e2e files verde');
