# TESTING_STRATEGY_SAAS.md — estrategia real (Fase H)

Herramientas del repo (sin framework): `tsc --noEmit`, `npm test`
(regresión DB), `npm run test:unit` (asserts puros), goldens
`scripts/contract_check.py`, humos `scripts/smoke_*.mjs` (fetch + TOTP +
firmas). Sin linter configurado (preexistente; no se añadió).

| Capa | Qué | Dónde | Estado |
|---|---|---|---|
| Dominio | VO, entidades, transiciones, parse prefs | `test:unit` | 126 asserts ✅ |
| Cripto | scrypt, JWT/MFA, TOTP vectores RFC, GCM, HMAC sandbox, rate-limit | `test:unit` | ✅ |
| DB | 20 tablas, índices, seeds, constraints 005–009 | `npm test` | 16 checks ✅ |
| HTTP auth | registro→…→logout-all, reúso, 429 | humo manual + asserts | ✅ |
| TOTP | setup→mfa→recovery→disable, replay | `smoke_totp.mjs` | 18/18 ✅ |
| RBAC | 401/403/200, bloqueo, no-auto, no-escalado | humo | ✅ |
| Billing | grant, 429 $0, 1 inv real $0.03, rollback, idempotencia | humo + SQL | ✅ |
| Pagos | checkout→webhook→activa, dup, firma, mora, cancel/change | `smoke_billing.mjs` | 19/19 ✅ |
| Cuenta | whitelist, prefs, modelo-vs-plan, export, correo, borrado | `smoke_account.mjs` + humo | 11/11 + ✅ |
| Contratos | legacy intactos tras A–H | goldens | intactos ✅ |
| Deps | `npm audit` | — | 0 vulns (override multer) ✅ |

No se marcó verde nada sin ejecutar. Gaps honestos: sin pruebas de
concurrencia real sobre `consume()` (atomicidad por construcción SQL);
eval-30 no re-ejecutada (goldens como equivalencia); sin E2E de UI.
Limpieza: cada humo borra sus usuarios (verificado `users` tras cada fase).
