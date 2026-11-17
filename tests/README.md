# tests/ — estrategia de pruebas

Convención del repo: scripts con aserciones y salida ≠ 0 si fallan
(sin framework). Orden sugerido:

1. **Unitarias** (sin DB ni red): `cd apps/api; npm run test:unit`
2. **E2E sqlite** (sin Docker ni red): `cd apps/api; npm run test:sqlite`
3. **Regresión DB** (stack vivo): `cd apps/api; npm test`
4. **Goldens de contratos**: `python tests/smoke/contract_check.py --check`
   (`--record` para regrabar `tests/smoke/goldens.json` tras un cambio
   deliberado). Requiere API viva con corpus.
5. **Humos** (stack vivo): `node tests/smoke/smoke_*.mjs`
   (`account`, `billing`, `chat`, `corpus`, `files`, `totp`) y
   `python tests/smoke/smoke_meta_api.py` (humo directo a Meta API).
6. **Evals**: `python tests/eval/run_eval.py` y
   `node tests/eval/run_eval_conv.mjs` (datasets en `eval/`).
7. **E2E** (navegador): ver `tests/e2e/README.md`.

El CI (`.github/workflows/ci.yml`) corre typecheck + unitarias + build +
audit sin secretos; la regresión DB y los humos corren en staging
(ver `docs/operaciones/SECURITY_OPERATIONS.md`).
