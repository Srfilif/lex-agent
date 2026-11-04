// Humo TOTP punta a punta (node stdlib). Uso: node tests/smoke/smoke_totp.mjs
// Flujo: registro → login → setup → confirm → mfa_required → verify →
// recovery → disable → login directo. Sale 1 si algo falla.
import { createHmac } from 'crypto';

const API = 'http://localhost:3000';
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
let fails = 0;

function check(name, ok, extra = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ` ${extra}`}`);
  if (!ok) fails++;
}

function b32dec(s) {
  const bytes = [];
  let bits = 0;
  let acc = 0;
  for (const ch of s.toUpperCase()) {
    const v = B32.indexOf(ch);
    if (v < 0) continue;
    acc = (acc << 5) | v;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((acc >> bits) & 255);
    }
  }
  return Buffer.from(bytes);
}

function totp(secretB32, whenMs = Date.now()) {
  const c = Math.floor(whenMs / 1000 / 30);
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(c));
  const mac = createHmac('sha1', b32dec(secretB32)).update(msg).digest();
  const o = mac[mac.length - 1] & 0x0f;
  const code = (((mac[o] & 0x7f) << 24) | (mac[o + 1] << 16) | (mac[o + 2] << 8) | mac[o + 3]) % 1e6;
  return String(code).padStart(6, '0');
}

async function call(method, path, body, token) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

const email = `totp${Date.now()}@lex.co`;
const pass = 'clave-totp-1';

// 1. registro + login directo (sin 2FA)
await call('POST', '/auth/register', { email, password: pass });
const l1 = await call('POST', '/auth/login', { email, password: pass });
check('login directo sin 2FA', l1.status === 201 && !!l1.json.access_token, l1.status);
const at1 = l1.json.access_token;

// 2. status disabled → setup → confirm
const st0 = await call('GET', '/account/security/totp/status', null, at1);
check('status disabled', st0.json?.status === 'disabled', JSON.stringify(st0.json));
const setup = await call('POST', '/account/security/totp/setup', {}, at1);
const url = setup.json?.otpauth_url ?? '';
check('setup otpauth', setup.status === 201 && url.startsWith('otpauth://totp/'), setup.status);
check('setup no filtra secreto', !('secret_b32' in (setup.json ?? {}) || 'secret' in (setup.json ?? {})));
const secret = new URL(url).searchParams.get('secret');
const bad = await call('POST', '/account/security/totp/confirm', { code: '000000' }, at1);
check('confirm rechaza malo', bad.status === 401, bad.status);
const codeConfirm = totp(secret);
const conf = await call('POST', '/account/security/totp/confirm', { code: codeConfirm }, at1);
const codes = conf.json?.recovery_codes ?? [];
check('confirm activa + 10 códigos', conf.status === 201 && codes.length === 10, conf.status);
// Anti-replay estricto: un código vale para una sola operación; esperar ventana nueva.
const t0 = Date.now();
while (totp(secret) === codeConfirm && Date.now() - t0 < 35000) {
  await new Promise((r) => setTimeout(r, 1000));
}
check('ventana nueva tras confirm', totp(secret) !== codeConfirm);
const st1 = await call('GET', '/account/security/totp/status', null, at1);
check('status active + 10 left', st1.json?.status === 'active' && st1.json?.recovery_codes_left === 10, JSON.stringify(st1.json));

// 3. login exige MFA; pre-token no sirve como sesión
const l2 = await call('POST', '/auth/login', { email, password: pass });
check('login pide mfa', l2.json?.mfa_required === true && !!l2.json?.mfa_token, JSON.stringify(l2.json));
const abuse = await call('GET', '/account/me', null, l2.json.mfa_token);
check('mfa_token no es sesión', abuse.status === 401, abuse.status);
const mfaBad = await call('POST', '/auth/mfa/verify', { mfa_token: l2.json.mfa_token, code: '000000' });
check('mfa rechaza malo', mfaBad.status === 401, mfaBad.status);
const code3 = totp(secret);
const mfa = await call('POST', '/auth/mfa/verify', { mfa_token: l2.json.mfa_token, code: code3 });
check('mfa totp ok', mfa.status === 201 && !!mfa.json.access_token, mfa.status);

// 4. replay del mismo código TOTP debe fallar (400 replay o 401 ventana movida)
const l3 = await call('POST', '/auth/login', { email, password: pass });
const replay = await call('POST', '/auth/mfa/verify', { mfa_token: l3.json.mfa_token, code: code3 });
check('mfa replay rechazado', replay.status !== 201, replay.status);

// 5. login por recovery code (un uso)
const l4 = await call('POST', '/auth/login', { email, password: pass });
const rec = await call('POST', '/auth/mfa/verify', { mfa_token: l4.json.mfa_token, code: codes[0] });
check('mfa recovery ok + 9 left', rec.status === 201 && rec.json?.recovery_codes_left === 9, rec.status);
const l5 = await call('POST', '/auth/login', { email, password: pass });
const rec2 = await call('POST', '/auth/mfa/verify', { mfa_token: l5.json.mfa_token, code: codes[0] });
check('recovery un solo uso', rec2.status === 401, rec2.status);

// 6. disable exige password + factor (vía recovery: escape hatch); luego login directo
const at3 = rec.json.access_token;
const disBad = await call('POST', '/account/security/totp/disable', { password: 'mala', code: codes[1] }, at3);
check('disable rechaza pass mala', disBad.status === 401, disBad.status);
const dis = await call('POST', '/account/security/totp/disable', { password: pass, code: codes[1] }, at3);
check('disable ok', dis.status === 201, dis.status);
const l6 = await call('POST', '/auth/login', { email, password: pass });
check('login directo tras disable', l6.status === 201 && !l6.json?.mfa_required, l6.status);

if (fails) {
  console.log(`${fails} humo(s) TOTP rotos(s)`);
  process.exit(1);
}
console.log('humo TOTP verde');
