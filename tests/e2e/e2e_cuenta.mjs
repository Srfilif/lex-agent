// Pase E2E cuenta (desechable). Sin costo LLM.
import { chromium } from 'playwright-core';
const browser = await chromium.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await (await browser.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
let fails = 0;
const check = (n, ok, x = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${n}${ok ? '' : ` ${x}`}`);
  if (!ok) fails++;
};
const errors = [];
page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
const E = `cta-${Date.now()}@lex.co`;
await (await fetch('http://localhost:3000/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: E, password: 'clave-cta-123' }) }));
await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
await page.getByPlaceholder('tucorreo@ejemplo.co').fill(E);
await page.getByPlaceholder('Mínimo 8 caracteres').fill('clave-cta-123');
await page.getByRole('button', { name: 'Entrar' }).click();
await page.getByRole('button', { name: 'Cuenta', exact: true }).click();
await page.getByText('Cambiar correo').waitFor({ timeout: 20000 });
check('tab perfil', true);
await page.getByRole('tab', { name: 'Preferencias' }).click();
await page.getByText('Recuerdos').first().waitFor({ timeout: 20000 });
check('tab preferencias+recuerdos', true);
await page.getByRole('tab', { name: 'Seguridad' }).click();
await page.getByText('Verificación en dos pasos (TOTP)').waitFor({ timeout: 20000 });
check('tab seguridad', true);
await page.getByRole('tab', { name: 'Sesiones' }).click();
await page.getByText('Sesiones activas').first().waitFor({ timeout: 20000 });
check('tab sesiones', true);
await page.screenshot({ path: 'shots/c01-cuenta.png' });
check('sin pageerrors', errors.length === 0, errors.slice(0, 2).join(' | '));
await browser.close();
if (fails) process.exit(1);
console.log('e2e cuenta verde');
