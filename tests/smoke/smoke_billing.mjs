// Humo billing sandbox (node stdlib). Uso: node tests/smoke/smoke_billing.mjs
// Checkout → approve → webhook firmado → suscripción activa; duplicado,
// firma mala, decline→failed, cancel/resume, change-plan, historial.
// Sin gasto LLM ni cobros reales. Sale 1 si algo falla.
const API = 'http://localhost:3000';
let fails = 0;

function check(name, ok, extra = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ` ${extra}`}`);
  if (!ok) fails++;
}

async function call(method, path, body, token, headers = {}) {
  const hasBody = body !== undefined && body !== null;
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: hasBody ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

const email = `pay${Date.now()}@lex.co`;
const pass = 'clave-pay-123';
await call('POST', '/auth/register', { email, password: pass, terms_accepted: true, privacy_accepted: true });
const login = await call('POST', '/auth/login', { email, password: pass, terms_accepted: true, privacy_accepted: true });
const at = login.json.access_token;
check('login humo billing', !!at);

// 1. checkout plus
const plans = await call('GET', '/billing/plans');
check('planes con precio', plans.json?.plans?.find((p) => p.code === 'plus')?.price_minor === 29900);
const freeCo = await call('POST', '/billing/checkout', { plan: 'free' }, at);
check('checkout free rechazado', freeCo.status === 400, freeCo.status);
const co = await call('POST', '/billing/checkout', { plan: 'plus' }, at);
check('checkout plus', co.status === 201 && !!co.json?.checkout_id, co.status);
const cid = co.json.checkout_id;

// 2. aprobar vía simulador y entregar webhook firmado
const sim = await call('POST', `/billing/sandbox/checkouts/${cid}/approve`);
check('simulador emite', sim.status === 201 && !!sim.json?.signature, sim.status);
const raw = JSON.stringify(sim.json.payload);
const wh1 = await call('POST', '/billing/webhooks/sandbox', raw, null, {
  'x-sandbox-signature': sim.json.signature,
});
check('webhook ok → suscripción', wh1.status === 201 && wh1.json?.plan === 'plus', `${wh1.status} ${JSON.stringify(wh1.json)}`);
const sub = await call('GET', '/billing/subscription', null, at);
check('subscription activa', sub.json?.plan === 'plus' && sub.json?.status === 'active', JSON.stringify(sub.json));
const usage = await call('GET', '/billing/usage', null, at);
check('límites plus', usage.json?.investigaciones?.limit === 200, JSON.stringify(usage.json?.investigaciones));

// 3. duplicado y firma mala
const whDup = await call('POST', '/billing/webhooks/sandbox', raw, null, {
  'x-sandbox-signature': sim.json.signature,
});
check('webhook duplicado', whDup.json?.status === 'duplicado', whDup.status);
const whBad = await call('POST', '/billing/webhooks/sandbox', raw, null, {
  'x-sandbox-signature': '0'.repeat(64),
});
check('firma mala 401', whBad.status === 401, whBad.status);
const tampered = raw.replace('29900', '100');
const whTam = await call('POST', '/billing/webhooks/sandbox', tampered, null, {
  'x-sandbox-signature': sim.json.signature,
});
check('cuerpo manipulado 401', whTam.status === 401, whTam.status);

// 4. decline → failed (sin tocar la suscripción viva)
const co2 = await call('POST', '/billing/checkout', { plan: 'pro' }, at);
const sim2 = await call('POST', `/billing/sandbox/checkouts/${co2.json.checkout_id}/decline`);
const raw2 = JSON.stringify(sim2.json.payload);
const whFail = await call('POST', '/billing/webhooks/sandbox', raw2, null, {
  'x-sandbox-signature': sim2.json.signature,
});
check('webhook failed ok', whFail.json?.status === 'ok', whFail.status);
const subAfterFail = await call('GET', '/billing/subscription', null, at);
check('failed no mata suscripción (→past_due)', subAfterFail.json?.status === 'past_due', JSON.stringify(subAfterFail.json));
const pays = await call('GET', '/billing/payments', null, at);
const statuses = (pays.json?.payments ?? []).map((p) => p.status).sort().join(',');
check('historial pagos', statuses === 'failed,succeeded', statuses);

// 5. failed tardío tras succeeded → ignorado (fuera de orden)
const whStale = await call('POST', '/billing/webhooks/sandbox', raw2, null, {
  'x-sandbox-signature': sim2.json.signature,
});
check('reintento failed duplicado', whStale.json?.status === 'duplicado', whStale.status);

// 6. cancel / resume / change-plan / historial
const cancel = await call('POST', '/billing/subscription/cancel', {}, at);
check('cancel fin de periodo', cancel.json?.cancel_at_period_end === true, cancel.status);
const resume = await call('POST', '/billing/subscription/resume', {}, at);
check('resume', resume.json?.cancel_at_period_end === false, resume.status);
const change = await call('POST', '/billing/subscription/change-plan', { plan: 'pro' }, at);
check('change-plan pro', change.json?.plan === 'pro', `${change.status} ${JSON.stringify(change.json)}`);
const hist = await call('GET', '/billing/subscription/history', null, at);
check('historial eventos', (hist.json?.events?.length ?? 0) >= 1, hist.status);

if (fails) {
  console.log(`${fails} humo(s) billing rotos(s)`);
  process.exit(1);
}
console.log('humo billing verde');
