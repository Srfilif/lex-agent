// Paso visual rediseño (desechable). Sin costo LLM.
import { chromium } from 'playwright-core';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const browser = await chromium.launch({ executablePath: EDGE, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });

// Desktop claro: welcome.
{
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const E = `vis-${Date.now()}@lex.co`;
  await (await fetch('http://localhost:3000/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: E, password: 'clave-vis-123', terms_accepted: true, privacy_accepted: true }) }));
  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
  await page.getByPlaceholder('tucorreo@ejemplo.co').fill(E);
  await page.getByPlaceholder('Mínimo 8 caracteres').fill('clave-vis-123');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.getByRole('button', { name: 'Chat', exact: true }).waitFor({ timeout: 20000 });
  await page.getByText('¿En qué te ayudo hoy?').waitFor({ timeout: 20000 });
  await page.screenshot({ path: 'shots/r01-welcome.png' });
  // Colapsar sidebar.
  await page.getByRole('button', { name: 'Contraer panel de chats' }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'shots/r02-colapsado.png' });
  await page.close();
}
// Móvil: drawer.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const E = `vism-${Date.now()}@lex.co`;
  await (await fetch('http://localhost:3000/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: E, password: 'clave-vis-123', terms_accepted: true, privacy_accepted: true }) }));
  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
  await page.getByPlaceholder('tucorreo@ejemplo.co').fill(E);
  await page.getByPlaceholder('Mínimo 8 caracteres').fill('clave-vis-123');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.getByRole('button', { name: 'Chat', exact: true }).waitFor({ timeout: 20000 });
  await page.screenshot({ path: 'shots/r03-movil.png' });
  await page.mouse.click(400, 400); // fuera del drawer (320px) → overlay
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'shots/r04-movil-cerrado.png' });
  await page.close();
}
// Oscuro: vía API prefs + reload.
{
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const E = `visd-${Date.now()}@lex.co`;
  await (await fetch('http://localhost:3000/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: E, password: 'clave-vis-123', terms_accepted: true, privacy_accepted: true }) }));
  const l = await (await fetch('http://localhost:3000/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: E, password: 'clave-vis-123' }) })).json();
  await fetch('http://localhost:3000/account/preferences', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${l.access_token}` }, body: JSON.stringify({ theme: 'dark' }) });
  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
  await page.getByPlaceholder('tucorreo@ejemplo.co').fill(E);
  await page.getByPlaceholder('Mínimo 8 caracteres').fill('clave-vis-123');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.getByRole('button', { name: 'Chat', exact: true }).waitFor({ timeout: 20000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'shots/r05-dark.png' });
  await page.close();
}
await browser.close();
console.log('visual ok');
