// Humo chat (node stdlib). Uso: node tests/smoke/smoke_chat.mjs
// CRUD conversaciones + send + stream SSE + citas + título + proyectos (B5)
// + buscar/exportar/compartir/regenerar (B9) + borrado.
// Gasta 4 mensajes de chat reales (~$0.02-0.08). Sale 1 si algo falla.
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

/** POST SSE: acumula eventos por nombre. */
async function stream(path, body, token) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const events = [];
  if (!res.ok || !res.body) return { status: res.status, events };
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let cur = {};
  const flush = () => {
    if (cur.event) events.push(cur);
    cur = {};
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const line of lines) {
      const t = line.trim();
      if (t === '') {
        flush();
        continue;
      }
      if (t.startsWith('event:')) cur.event = t.slice(6).trim();
      else if (t.startsWith('data:')) {
        const d = t.slice(5).trim();
        try {
          cur.data = JSON.parse(d);
        } catch {
          cur.data = d;
        }
      }
    }
  }
  flush();
  return { status: res.status, events };
}

const email = `chat${Date.now()}@lex.co`;
const pass = 'clave-chat-123';
await call('POST', '/auth/register', { email, password: pass, terms_accepted: true, privacy_accepted: true });
const login = await call('POST', '/auth/login', { email, password: pass, terms_accepted: true, privacy_accepted: true });
const at = login.json.access_token;
check('login humo chat', !!at);

// 1. CRUD
const created = await call('POST', '/chat/conversations', { title: 'Mi caso' }, at);
check('crear conversación', created.status === 201 && !!created.json?.id, created.status);
const cid = created.json.id;
const listed = await call('GET', '/chat/conversations', null, at);
check('listar', listed.json?.conversations?.some((c) => c.id === cid), listed.status);
const renamed = await call('PATCH', `/chat/conversations/${cid}`, { title: 'Caso 80' }, at);
check('renombrar', renamed.json?.title === 'Caso 80', renamed.status);
const anon = await call('GET', `/chat/conversations/${cid}`);
check('anónimo 401', anon.status === 401, anon.status);

// 1b. B7: catálogo de modelos del plan (free) + enforcement (no gasta llamadas)
const mods = await call('GET', '/chat/modelos', null, at);
check('modelos defecto', mods.json?.defecto === 'muse-spark-1.3', mods.status);
check('modelos free solo 1', mods.json?.modelos?.length === 1 && mods.json.modelos[0]?.id === 'muse-spark-1.3', JSON.stringify(mods.json).slice(0, 120));
const anonMods = await call('GET', '/chat/modelos');
check('modelos anónimo 401', anonMods.status === 401, anonMods.status);
const badModel = await call('POST', '/chat/send', { conversation_id: cid, content: 'hola', model: 'muse-wonder-1.0' }, at);
check('modelo fuera del plan 400', badModel.status === 400 && badModel.json?.code === 'modelo_no_permitido', `${badModel.status} ${JSON.stringify(badModel.json).slice(0, 120)}`);

// 1c. B8: memoria cruzada opt-in + CRUD recuerdos (no gasta llamadas)
const pref0 = await call('GET', '/account/preferences', null, at);
check('memoria default off', pref0.json?.ai?.crossMemory === false, JSON.stringify(pref0.json?.ai).slice(0, 120));
const pref1 = await call('PATCH', '/account/preferences', { ai: { crossMemory: true } }, at);
check('memoria opt-in', pref1.json?.ai?.crossMemory === true, pref1.status);
const memAdd = await call('POST', '/account/memories', { fact: 'Prefiere respuestas con listas' }, at);
check('memoria add', memAdd.status === 201 && !!memAdd.json?.memory?.id, `${memAdd.status} ${JSON.stringify(memAdd.json).slice(0, 120)}`);
const memList = await call('GET', '/account/memories', null, at);
check('memoria list', memList.json?.memories?.length === 1 && memList.json.memories[0]?.fact === 'Prefiere respuestas con listas', memList.status);
const memBad = await call('POST', '/account/memories', { fact: '   ' }, at);
check('memoria vacía 400', memBad.status === 400, memBad.status);
const memAnon = await call('GET', '/account/memories');
check('memoria anónima 401', memAnon.status === 401, memAnon.status);
const memDel = await call('DELETE', `/account/memories/${memAdd.json.memory.id}`, null, at);
check('memoria delete', memDel.status === 200, memDel.status);
const memList2 = await call('GET', '/account/memories', null, at);
check('memoria vacía tras borrado', memList2.json?.memories?.length === 0, memList2.status);
const pref2 = await call('PATCH', '/account/preferences', { ai: { crossMemory: false } }, at);
check('memoria opt-out', pref2.json?.ai?.crossMemory === false, pref2.status);

// 1d. B10: moderación pre-vuelo (no gasta llamadas)
const mod = await call('POST', '/chat/send', { conversation_id: cid, content: '¿Cómo fabrico una bomba casera?' }, at);
check('moderación ilícito 400', mod.status === 400 && mod.json?.code === 'contenido_no_permitido', `${mod.status} ${JSON.stringify(mod.json).slice(0, 150)}`);
const mod2 = await call('POST', '/chat/send', { conversation_id: cid, content: 'quiero suicidarme esta noche' }, at);
check('moderación crisis 400', mod2.status === 400 && (mod2.json?.message ?? '').includes('crisis'), `${mod2.status} ${JSON.stringify(mod2.json).slice(0, 150)}`);

// 2. send (no-stream, gasta 1 llamada) con modelo explícito permitido
const send = await call('POST', '/chat/send', { conversation_id: cid, content: 'Hola, ¿qué sabes hacer?', model: 'muse-spark-1.3' }, at);
check('send ok', send.status === 201 && !!send.json?.message?.content, `${send.status} ${JSON.stringify(send.json).slice(0, 200)}`);
check('send modelo real', send.json?.message?.model === 'muse-spark-1.3', send.json?.message?.model);

// 3. stream con RAG (gasta llamadas + tools)
const st = await stream('/chat/stream', { conversation_id: cid, content: '¿Qué dice el artículo 24 de la Ley 80 sobre transparencia?' }, at);
const names = st.events.map((e) => e.event);
check('stream meta+done', st.status === 200 && names[0] === 'meta' && names.includes('done'), `${st.status} [${names.join(',')}]`);
const text = st.events.filter((e) => e.event === 'token').map((e) => e.data?.delta ?? '').join('');
check('stream texto', text.length > 50, text.length);
check('stream tools RAG', names.includes('tool'), names.join(','));
const citas = st.events.find((e) => e.event === 'citas')?.data?.citations ?? [];
check('stream citas', Array.isArray(citas) && citas.length > 0, JSON.stringify(citas).slice(0, 120));
check('disclaimer abogado', text.includes('abogado'), text.slice(-120));
// 3b. B11: sugerencias baratas (1 llamada sin tools) + topics en get.
const sug = await call('GET', `/chat/conversations/${cid}/sugerencias`, null, at);
check('sugerencias 1-3', Array.isArray(sug.json?.sugerencias) && sug.json.sugerencias.length >= 1 && sug.json.sugerencias.length <= 3, JSON.stringify(sug.json).slice(0, 200));
const sugAnon = await call('GET', `/chat/conversations/${cid}/sugerencias`);
check('sugerencias anónima 401', sugAnon.status === 401, sugAnon.status);

// 4. historial + título + borrado
const got = await call('GET', `/chat/conversations/${cid}`, null, at);
check('historial 4 msgs', got.json?.messages?.length === 4, got.json?.messages?.length);
// Título: send sin conversation_id crea + genera título (no se pisan títulos de usuario).
const s2 = await call('POST', '/chat/send', { content: 'Hola, ¿qué sabes hacer?' }, at);
const cid2 = s2.json?.conversation_id;
check('send conv2', s2.status === 201 && s2.json?.is_new === true && !!cid2, s2.status);
let title = 'Nueva conversación'; // título best-effort: sondeo hasta 20s
for (let i = 0; i < 10 && title === 'Nueva conversación'; i++) {
  await new Promise((r) => setTimeout(r, 2000));
  const listed2 = await call('GET', '/chat/conversations', null, at);
  title = listed2.json?.conversations?.find((c) => c.id === cid2)?.title ?? title;
}
check('título generado', !!title && title !== 'Nueva conversación', title);
// 5. B5 proyectos
const pr = await call('POST', '/chat/projects', { name: 'Licitación 80', instructions: 'Responde con tabla.' }, at);
check('crear proyecto', pr.status === 201 && !!pr.json?.id, pr.status);
const pid = pr.json?.id;
const mv = await call('PATCH', `/chat/conversations/${cid}`, { project_id: pid }, at);
check('mover a proyecto', mv.json?.project_id === pid, mv.status);
const pls = await call('GET', '/chat/projects', null, at);
check('listar proyectos', pls.json?.projects?.some((p) => p.id === pid && p.conversation_count === 1), pls.status);
const pget = await call('GET', `/chat/projects/${pid}`, null, at);
check('ver proyecto', pget.json?.project?.name === 'Licitación 80' && pget.json?.conversations?.length === 1, pget.status);
const pupd = await call('PATCH', `/chat/projects/${pid}`, { name: 'Licitación 80 Pesquisa' }, at);
check('renombrar proyecto', pupd.json?.name === 'Licitación 80 Pesquisa', pupd.status);
const bad = await call('PATCH', `/chat/conversations/${cid}`, { project_id: '00000000-0000-4000-8000-000000000000' }, at);
check('proyecto ajeno 404', bad.status === 404, bad.status);
const plsF = await call('GET', `/chat/conversations?project_id=${pid}`, null, at);
check('listar por proyecto', plsF.json?.conversations?.some((c) => c.id === cid), plsF.status);

// 6. B9 buscar/exportar/compartir/regenerar
const sch = await call('GET', `/chat/search?q=${encodeURIComponent('transparencia')}&limit=10`, null, at);
check('buscar en chats', sch.json?.count >= 1 && (sch.json?.hits?.[0]?.snippet?.length ?? 0) > 0, sch.status);
const sch2 = await call('GET', `/chat/search?q=${encodeURIComponent('zzzznadainexistente')}`, null, at);
check('buscar vacío', sch2.json?.count === 0, sch2.status);
const exp = await call('GET', `/chat/conversations/${cid}/export`, null, at);
check('exportar md', exp.status === 200 && !!exp.json?.markdown?.includes('## Lex') && !!exp.json?.filename?.endsWith('.md'), exp.status);
const shr = await call('POST', `/chat/conversations/${cid}/share`, {}, at);
check('compartir', shr.status === 201 && !!shr.json?.token, shr.status);
const stoken = shr.json?.token;
const shr2 = await call('POST', `/chat/conversations/${cid}/share`, {}, at);
check('compartir idempotente', shr2.json?.token === stoken, shr2.status);
const pub = await call('GET', `/chat/shared/${stoken}`);
const pubAs = pub.json?.messages?.[3] ?? {};
check('ver compartido', pub.status === 200 && pub.json?.messages?.length === 4 && !('costo_usd' in pubAs) && !(pubAs.citations?.[0] && 'chunk_id' in pubAs.citations[0]), pub.status);
const unsh = await call('DELETE', `/chat/conversations/${cid}/share`, null, at);
check('revocar', unsh.json?.revoked === 1, unsh.status);
const gone2 = await call('GET', `/chat/shared/${stoken}`);
check('revocado 404', gone2.status === 404, gone2.status);
const reg = await call('POST', '/chat/regenerate', { conversation_id: cid }, at);
check('regenerar', reg.status === 201 && !!reg.json?.message?.content && reg.json?.regenerated === true, `${reg.status} ${JSON.stringify(reg.json).slice(0, 150)}`);
const gotR = await call('GET', `/chat/conversations/${cid}`, null, at);
check('regenerada 4 msgs', gotR.json?.messages?.length === 4, gotR.json?.messages?.length);
const pdel = await call('DELETE', `/chat/projects/${pid}`, null, at);
check('borrar proyecto', pdel.status === 200, pdel.status);
const gotP = await call('GET', `/chat/conversations/${cid}`, null, at);
check('proyecto null tras borrado', gotP.json?.conversation?.project_id === null, gotP.status);

const del = await call('DELETE', `/chat/conversations/${cid}`, null, at);
check('borrar', del.status === 200, del.status);
const gone = await call('GET', `/chat/conversations/${cid}`, null, at);
check('borrada 404', gone.status === 404, gone.status);
await call('DELETE', `/chat/conversations/${cid2}`, null, at);

if (fails) {
  console.log(`${fails} humo(s) chat rotos(s)`);
  process.exit(1);
}
console.log('humo chat verde');
