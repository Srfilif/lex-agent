// Eval conversacional D3 (node stdlib). Uso: node tests/eval/run_eval_conv.mjs
// Mide retrieval+memoria+abstención en diálogos multi-turno reales (/chat/stream).
// Gasta ~9 turnos LLM. MIDE, no bloquea: escribe resultados + informe, sale 0
// salvo error de infraestructura. Solo stdlib.
import { readFileSync, writeFileSync } from 'node:fs';

const API = 'http://localhost:3000';
const PREFIJO = { '80/1993': 'Ley 80/1993', '1150/2007': 'Ley 1150/2007', 'CP/1991': 'Const. 1991' };
const RE_ABST = /evidencia (no|insuficiente)|no (encontré|tengo|hay).{0,40}(evidencia|información|fuentes)|no (puedo|es posible) responder|fuera del (corpus|alcance)/i;

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
  return { status: res.status, json: await res.json().catch(() => null) };
}

async function streamTurn(cid, content, token) {
  const res = await fetch(`${API}/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ conversation_id: cid, content }),
  });
  const events = [];
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
        try {
          cur.data = JSON.parse(t.slice(5).trim());
        } catch {
          cur.data = t.slice(5).trim();
        }
      }
    }
  }
  flush();
  const text = events
    .filter((e) => e.event === 'token')
    .map((e) => e.data?.delta ?? '')
    .join('');
  const citas = events.find((e) => e.event === 'citas')?.data?.citations ?? [];
  const tools = events.filter((e) => e.event === 'tool').length;
  return { status: res.status, text, citas, tools };
}

function hitTarget(citas, target) {
  const pref = PREFIJO[target.numero];
  return citas.some(
    (c) => c.chunk_id && (c.ruta ?? '').startsWith(pref) && (c.ruta ?? '').includes(`Art. ${target.articulo}`),
  );
}

async function main() {
  const dialogos = JSON.parse(readFileSync('eval/conversacion.json', 'utf-8'));
  const email = `evalconv${Date.now()}@lex.co`;
  const pass = 'clave-eval-123';
  await call('POST', '/auth/register', { email, password: pass });
  const login = await call('POST', '/auth/login', { email, password: pass });
  const at = login.json?.access_token;
  if (!at) throw new Error('login eval falló: ' + JSON.stringify(login.json).slice(0, 200));

  const filas = [];
  for (const d of dialogos) {
    const conv = await call('POST', '/chat/conversations', { title: `eval ${d.id}` }, at);
    const cid = conv.json?.id;
    if (!cid) throw new Error(`crear conv ${d.id} falló: ${conv.status}`);
    for (let i = 0; i < d.turnos.length; i++) {
      const t = d.turnos[i];
      const t0 = Date.now();
      const r = await streamTurn(cid, t.pregunta, at);
      const row = {
        dialogo: d.id,
        turno: i + 1,
        pregunta: t.pregunta,
        ms: Date.now() - t0,
        tools: r.tools,
        citas: r.citas.map((c) => c.ruta ?? c.secop_ref ?? '?'),
        chars: r.text.length,
      };
      if (t.target) {
        row.espera = `cita ${t.target.numero} art ${t.target.articulo}`;
        row.hit = hitTarget(r.citas, t.target);
      } else if (t.abstencion) {
        const sinCorpus = !r.citas.some((c) => c.chunk_id);
        row.espera = 'abstención honesta';
        row.hit = sinCorpus || RE_ABST.test(r.text);
        row.sinCorpus = sinCorpus;
      } else if (t.memoria) {
        row.espera = `texto contiene "${t.memoria}"`;
        row.hit = r.text.toLowerCase().includes(t.memoria.toLowerCase());
      }
      filas.push(row);
      console.log(`${row.hit ? 'HIT ' : 'MISS'} ${d.id}t${i + 1} [${row.espera}] citas=${row.citas.length} tools=${r.tools} ${row.ms}ms`);
    }
  }
  const hits = filas.filter((f) => f.hit).length;
  const hoy = new Date().toISOString().slice(0, 10);
  writeFileSync(`eval/resultados-conv-${hoy}.json`, JSON.stringify({ fecha: hoy, hits, total: filas.length, filas }, null, 1));
  const md = [
    `# Eval conversacional D3 — ${hoy}`,
    ``,
    `**Resultado: ${hits}/${filas.length} turnos.** Retrieval multi-turno + memoria + abstención (` +
      `\`eval/conversacion.json\`, runner \`tests/eval/run_eval_conv.mjs\`).`,
    ``,
    `| Diálogo | Turno | Espera | Hit | Citas | Tools | ms |`,
    `|---|---|---|---|---|---|---|`,
    ...filas.map(
      (f) => `| ${f.dialogo} | ${f.turno} | ${f.espera} | ${f.hit ? 'sí' : 'NO'} | ${f.citas.length} | ${f.tools} | ${f.ms} |`,
    ),
    ``,
    `Rutas citadas por turno:`,
    ``,
    ...filas.map((f) => `- **${f.dialogo}t${f.turno}**: ${f.citas.length ? f.citas.map((c) => `\`${c}\``).join(', ') : '(sin citas)'}`),
    ``,
  ].join('\n');
  writeFileSync(`eval/informe-conv-${hoy}.md`, md);
  console.log(`eval conversacional: ${hits}/${filas.length} (informe eval/informe-conv-${hoy}.md)`);
}

main().catch((e) => {
  console.error('ERROR eval conversacional:', e.message);
  process.exit(1);
});
