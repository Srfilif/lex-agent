# API_SPECIFICATION — endpoints (Día 3)

Base: `http://localhost:3000`.

## GET /health

Estado de API, DB y gateway. Sin parámetros.

```json
{ "status": "ok", "db": "up (...)", "modelGateway": { "provider": "meta", "model": "muse-spark-1.3", "keyConfigured": true, "totals": {...} } }
```

## GET /search

Recuperación híbrida sobre el corpus (ver RAG_DESIGN.md).

| Parámetro | Requerido | Default | Descripción |
|---|---|---|---|
| `q` | sí | — | consulta en lenguaje natural o con identificadores (`artículo 24 ley 80`) |
| `top_k` | no | 8 (máx 20) | nº de fragmentos |
| `tipo` | no | — | filtro: `ley`, `constitucion`, … |
| `emisor` | no | — | filtro parcial (`Congreso`) |
| `numero` | no | — | filtro (`80/1993`, admite `%`) |

Respuesta: `{ q, count, ms, hits[] }`, cada hit con `chunk_id`, `ruta`, `texto`, `texto_contexto`, `score` (RRF k=60; 1.0 si estructurado), `metodo` (`estructurado`|`hibrido`) y `doc {titulo, numero, tipo, url}`.

Ejemplos verificados (2026-10-26, 545 chunks):
- `q=principio de transparencia` → Art. 24 Ley 80 primero (híbrido).
- `q=articulo 24 de la ley 80` → Art. 24 ×2 versiones (estructurado, 37 ms).
- `q=derecho de peticion&tipo=constitucion` → Art. 23 CP primero (94 ms).

## GET /secop/contracts

Contratos SECOP II desde caché local sincronizado (3000 más recientes; re-sync: `npm run sync:secop -- [N]`).

Filtros: `entidad`, `proveedor`, `objeto`, `valor_min`, `valor_max`, `modalidad`, `estado`, `anio`, `limit` (máx 50). Respuesta: `{ contratos[], count, fecha_consulta, modo, dataset, advertencia }`. Cada contrato trae `enlace_origen` (SECOP II o dataset) y `senales[]` (contratacion_directa, dias_adicionados, facturado_mayor_contrato — indicios, no acusaciones).

Verificado 2026-10-26: `entidad=medellin` → 2 reales; `objeto=software&valor_min=100000000` → 1 × $2.999M.

## POST /agent/investigate

Agente investigador: bucle con 4 herramientas (`buscar_normas`, `buscar_jurisprudencia`, `consultar_secop`, `verificar_cita`), máx 6 pasos. Body: `{ pregunta, max_pasos? }`. Responde `{ id, respuesta {resumen, afirmaciones[] {texto, tipo, chunk_ids[], secop_refs[]}}, traza[], usage, costo_usd, json_valido }` y persiste en `investigaciones`.

Verificado 2026-10-26: Art. 24 Ley 80 → 5 afirmaciones con citas a numeral, 4/4 chunk_ids reales; SECOP software/Medellín → 2 afirmaciones. Costo medido: $0.018–0.064/investigación.

## GET /agent/investigaciones/:id

Recupera investigación guardada (pregunta, traza, respuesta, uso, costo).

## GET /report/:id

Informe Markdown de una investigación: resumen, afirmaciones con veredicto (✓ ~ ✗ ○ ⛔), fuentes con enlace al origen, contratos citados, traza, ficha de costo y limitaciones. Incluye el objeto `verificacion` (ver CITATION_VERIFICATION.md). 404 si no existe.

Verificado 2026-10-26: 5 investigaciones, 12 afirmaciones, **0 citas inventadas**. Desde día 7 incluye bloques estructurados `fuentes[]`, `contratos[]`, `pregunta`, `resumen`, `traza`, `costo_usd` para la UI.

## GET /search/chunk/:id

Fragmento por id (`chunk_id`, `ruta`, `texto`, `texto_contexto`, `doc`). 404 si no existe o el id es inválido. Lo usa el panel de fuentes de la UI.

## Web UI (día 7)

`apps/web` (Vite + React). Investigar → informe con veredictos → clic en cita abre el fragmento; buscador SECOP con tabla y señales; descarga del informe en Markdown. API con CORS para `:4173`.
