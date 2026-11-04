// Humo corpus D1/D2/D3 (node stdlib). Uso: node tests/smoke/smoke_corpus.mjs
// Sin costo LLM: solo /search + /search/documentos + /search/chunk/:id.
// Sale 1 si algo falla.
const API = 'http://localhost:3000';
let fails = 0;
let total = 0;

function check(name, ok, extra = '') {
  total++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ` ${extra}`}`);
  if (!ok) fails++;
}

async function get(path) {
  const res = await fetch(`${API}${path}`);
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

async function main() {
  // D1: cobertura honesta
  const cov = await get('/search/documentos');
  check('cov 200', cov.status === 200, cov.status);
  check('cov 3 documentos', cov.json?.documentos === 3, JSON.stringify(cov.json?.documentos));
  check('cov fragmentos>1000', (cov.json?.fragmentos ?? 0) > 1000, cov.json?.fragmentos);
  const d0 = cov.json?.docs?.[0];
  check(
    'cov doc keys',
    d0 !== undefined &&
      ['titulo', 'numero', 'tipo', 'emisor', 'jurisdiccion', 'vigencia', 'fragmentos', 'fecha_consulta'].every(
        (k) => k in d0,
      ),
    JSON.stringify(Object.keys(d0 ?? {})),
  );
  check(
    'cov vigencia honesta',
    (cov.json?.docs ?? []).every((d) =>
      ['texto_original', 'modificado', 'consolidado', 'vigencia_verificada', 'vigencia_desconocida'].includes(
        d.vigencia,
      ),
    ),
  );
  check(
    'cov suma fragmentos',
    (cov.json?.docs ?? []).reduce((a, d) => a + d.fragmentos, 0) === cov.json?.fragmentos,
  );

  // D2: vigencia/autoridad/fecha en hits y chunk
  const q = await get('/search?q=principio%20de%20transparencia&top_k=3');
  check('search 200', q.status === 200, q.status);
  const h0 = q.json?.hits?.[0];
  check('hit doc vigencia', typeof h0?.doc?.vigencia === 'string', JSON.stringify(h0?.doc));
  check('hit doc autoridad', typeof h0?.doc?.autoridad === 'string');
  check(
    'hit fecha corta o null',
    h0?.doc?.fecha_consulta === null || /^\d{4}-\d{2}-\d{2}$/.test(h0?.doc?.fecha_consulta ?? ''),
    h0?.doc?.fecha_consulta,
  );
  if (h0?.chunk_id) {
    const ch = await get(`/search/chunk/${h0.chunk_id}`);
    check('chunk 200', ch.status === 200, ch.status);
    check('chunk doc vigencia', typeof ch.json?.doc?.vigencia === 'string');
    check('chunk doc autoridad', typeof ch.json?.doc?.autoridad === 'string');
  } else {
    check('chunk 200', false, 'sin hits');
    check('chunk doc vigencia', false, 'sin hits');
    check('chunk doc autoridad', false, 'sin hits');
  }

  // D2 filtros: tema inexistente → 0 hits; jurisdiccion CO → hits
  const ft = await get('/search?q=transparencia&jurisdiccion=CO&tema=contratacion_estatal&top_k=5');
  check('filtros 200', ft.status === 200, ft.status);
  check('filtros hits CO/contratacion>0', (ft.json?.hits?.length ?? 0) > 0);
  const fx = await get('/search?q=transparencia&tema=tema_inexistente_xyz&top_k=5');
  check('filtro tema raro 0 hits', fx.status === 200 && (fx.json?.hits?.length ?? -1) === 0, fx.json?.hits?.length);

  // D3: rerank determinista (mismo orden en 2 llamadas)
  const r1 = await get('/search?q=principio%20de%20transparencia&top_k=5');
  const r2 = await get('/search?q=principio%20de%20transparencia&top_k=5');
  const o1 = (r1.json?.hits ?? []).map((h) => h.chunk_id).join(',');
  const o2 = (r2.json?.hits ?? []).map((h) => h.chunk_id).join(',');
  check('rerank determinista', o1 !== '' && o1 === o2, `${o1} vs ${o2}`);

  console.log(fails ? `${fails}/${total} humo corpus roto` : `humo corpus ${total}/${total}`);
  if (fails) process.exit(1);
}

main().catch((e) => {
  console.error('FAIL humo corpus', e.message);
  process.exit(1);
});
