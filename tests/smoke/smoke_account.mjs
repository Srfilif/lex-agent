// Humo cuenta (node stdlib). Uso: node tests/smoke/smoke_account.mjs
// PATCH me (whitelist), preferencias get/set, modelo vs plan, export.
// Cambio de correo y borrado van por powershell (token en logs API).
const API = 'http://localhost:3000';
let fails = 0;

function check(name, ok, extra = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ` ${extra}`}`);
  if (!ok) fails++;
}

async function call(method, path, body, token) {
  const hasBody = body !== undefined && body !== null;
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: hasBody ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

const email = `acc${Date.now()}@lex.co`;
const pass = 'clave-acc-123';
await call('POST', '/auth/register', { email, password: pass, terms_accepted: true, privacy_accepted: true });
const login = await call('POST', '/auth/login', { email, password: pass, terms_accepted: true, privacy_accepted: true });
const at = login.json.access_token;
const uid = login.json.user.id;
check('login humo cuenta', !!at);
console.log(`UID=${uid} EMAIL=${email} PASS=${pass}`);

// 1. PATCH me whitelist
const me = await call('PATCH', '/account/me', { display_name: 'Ada', role: 'admin' }, at);
check('patch me', me.status === 200 && me.json?.display_name === 'Ada' && me.json?.role === 'user', me.status);
const meGet = await call('GET', '/account/me', null, at);
check('rol no escalado', meGet.json?.role === 'user', JSON.stringify(meGet.json));

// 2. preferencias
const p0 = await call('GET', '/account/preferences', null, at);
check('prefs defaults', p0.json?.theme === 'system' && p0.json?.ai?.model === null, p0.status);
const pBad = await call('PATCH', '/account/preferences', { theme: 'rosa' }, at);
check('theme inválido 400', pBad.status === 400, pBad.status);
const p1 = await call('PATCH', '/account/preferences', {
  theme: 'dark',
  language: 'en',
  timezone: 'Europe/Madrid',
  notifications: { emailSecurity: false },
  ai: { detail: 'breve', responseFormat: 'texto' },
}, at);
check('prefs set', p1.status === 200 && p1.json?.theme === 'dark' && p1.json?.ai?.detail === 'breve', p1.status);
const pModelBad = await call('PATCH', '/account/preferences', { ai: { model: 'gpt-x' } }, at);
check('modelo fuera de plan 400', pModelBad.status === 400, pModelBad.status);
const pModelOk = await call('PATCH', '/account/preferences', { ai: { model: 'muse-spark-1.3' } }, at);
check('modelo del plan ok', pModelOk.json?.ai?.model === 'muse-spark-1.3', pModelOk.status);

// 3. export
const exp = await call('GET', '/account/export', null, at);
const keys = Object.keys(exp.json ?? {}).sort().join(',');
check('export forma', exp.status === 200 && keys.includes('preferences') && keys.includes('sessions'), exp.status);
check('export sin hash', !JSON.stringify(exp.json).includes('scrypt'), 'filtra hash!');
check('export prefs', exp.json?.preferences?.theme === 'dark', JSON.stringify(exp.json?.preferences));

if (fails) {
  console.log(`${fails} humo(s) cuenta rotos(s)`);
  process.exit(1);
}
console.log('humo cuenta verde');
