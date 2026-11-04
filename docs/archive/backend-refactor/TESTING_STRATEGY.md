# TESTING_STRATEGY.md

Sin framework nuevo (decisión: convención del repo + `node`/`ts-node` + `npm scripts`).

| Suite | Qué | Cómo | Cuándo |
|---|---|---|---|
| `test:unit` (28 asserts) | Dominio puro + filtro HTTP + transforms | `src/tests/unit.ts`, sin DB ni red | cada cambio |
| `test` (6 checks) | Regresión DB (config FTS, tablas, índices) | `src/tests/db-regression.ts`, DB viva | cada cambio |
| `typecheck` | Tipos estrictos | `tsc --noEmit` | cada cambio |
| Goldens (9 casos) | Contratos HTTP byte a byte (normaliza volátiles) | `scripts/contract_check.py --check`, API viva | cada bloque |
| Eval-30 | Calidad E2E con LLM (~$1, ~40 min) | `scripts/run_eval.py` | hitos (no por bloque) |
| Probes ts-node | Caminos puntuales (puertos, 400s) | temporales, se borran | bajo demanda |

Reglas: un cambio que rompa goldens requiere justificación + regrabado explícito (solo `chunk_bad` 404→400, documentado en API_COMPATIBILITY.md). La eval-30 completa NO se re-ejecutó en este refactor (coste/tiempo); la equivalencia se sostiene con goldens + 1 investigación + 1 informe por bloque (0 inventadas en todas).
