# PROGRESS.md — Refactor backend

## 2026-10-26 — Fase 1 línea base + auditoría

- Inventario: 22 ficheros TS en `apps/api/src`; NestJS 11, pg directo, sin Prisma/auth/DTOs/guards.
- Checks: `typecheck` verde, `npm test` 6/6 verde.
- Creado `docs/backend-refactor/AUDIT.md` (12 hallazgos: 2 altos, 6 medios, resto bajos).
- Decisiones anticipadas: no introducir Prisma (ADR pendiente); contratos HTTP congelados.

## 2026-10-26 — Fase 2 límites arquitectónicos

- Creados `TARGET_ARCHITECTURE.md`, `DEPENDENCY_RULES.md`, `ARCHITECTURE_DECISIONS.md` (ADR-001 sin Prisma, ADR-002 sin CQRS), `REFACTORING_PLAN.md` (bloques A–F).
- Sin cambios de código todavía.

## 2026-10-26 — Bloque A config centralizada ✅

- Nuevo `src/shared/config/` (`dotenv.ts`, `app-config.ts`, `config.module.ts` global, `index.ts`).
- Migrados: `db.ts`, `gateway/model-gateway.ts` (DI + default transitorio para `new`), `main.ts` (puerto vía `app.get`), `app.module.ts`, `ingest/run.ts`, `secop/sync.ts`, `tests/db-regression.ts`. Eliminado `src/env.ts` (0 referencias).
- Verificación: `typecheck` verde, `npm test` 6/6, API reconstruida (`/health` ok, `/search` ok), regla 7 (`process.env` solo en `shared/config`), fallo rápido `PORT=abc` → `Error: Config inválida...`.
- Micro-correcciones: los CLIs ahora sí leen `.env` (el conteo de niveles anterior nunca lo encontraba); default DB explícito `localhost:5433` (antes, default implícito de pg apuntaba al Postgres equivocado).

## 2026-10-26 — Bloque B módulo corpus ✅

- Nuevo `src/modules/corpus/`: `domain/` (chunk, normalize, retrieval RRF+refs, puerto `CorpusRepository`), `application/` (puerto `EmbeddingPort`, caso de uso `SearchDocuments`), `infrastructure/` (SQL verbatim en `PgCorpusRepository` + `safeLimit`, `GatewayEmbeddingAdapter`), `presentation/` (controlador movido), `corpus.module.ts`, `index.ts`.
- Nuevo `src/shared/shared.module.ts` transitorio (expone `Db`+`ModelGateway`; Bloque D le dará módulo propio). `AppModule` lo importa; fuera `Db/ModelGateway/Search*` duplicados.
- `agent/tools.ts` usa `SearchDocuments` + `CORPUS_REPOSITORY` (0 SQL directo); `ingest/run.ts` importa dominio vía índice público (transitorio hasta Bloque E).
- Eliminados: `src/search/*`, `src/ingest/chunk.ts`, `src/ingest/normalize.ts`.
- Verificación: `typecheck` verde, `npm test` 6/6, greps reglas 1–2 vacíos en domain/application, API reconstruida (`/search` top hit idéntico, `chunk/:id` roundtrip ok), investigación Art.24 (5 afirm, 0 inventadas), probe de puerto (válido/inexistente/inválido exactos).

## 2026-10-26 — Bloque C presentación uniforme ✅

- Deps justificadas: `class-validator` + `class-transformer` (validación idiomática Nest).
- Nuevo: `shared/presentation/` (filtro uniforme + transforms), DTOs (`corpus/presentation/dto.ts`, `secop/secop.dto.ts`, `agent/dto.ts`), `ValidationPipe` global (whitelist+transform), `ParseUUIDPipe` en ids.
- Goldens: `scripts/contract_check.py` + 9 casos (8 intactos tras normalizar `totals`; `chunk_bad` regrabado por cambio deliberado 404→400).
- Verificación: `typecheck`/`npm test` verdes, goldens iguales, 400s nuevos comprobados (top_k, limit, investigate, UUIDs), 404 intacto en inexistentes.
- Deltas documentados en `API_COMPATIBILITY.md`. Pendiente: test directo del camino 500 del filtro (Bloque F).

## 2026-10-26 — Bloque D puertos + dominio ✅

- Puertos por necesidad del consumidor + `useExisting`: `agent/secop.port.ts` (`CONSULTAR_CONTRATOS`), `report/verify.port.ts` (`VERIFICAR_INVESTIGACION`); `Tools` y `ReportService` ya no importan servicios concretos; `implements` verifica LSP en compilación.
- Dominio puro extraído: `secop/senales.ts` (`evaluarSenales`), `verify/veredictos.ts` (`dictaminar`), `shared/pricing.ts` (`costoTokens`, kernel), `shared/json/balanced.ts` (dedup H8, borrados los 2 privados).
- Juez contabilizado (H11): `verificacion.juez {usage, costo_usd}` + línea en ficha Markdown (aditivo, frontend intacto).
- Verificación: `typecheck`/`npm test` verdes, goldens 8/8 idénticos, investigación SECOP por el puerto + informe con juez (0 inventadas).

## 2026-10-26 — Bloque E CLIs + transacción + LIKE ✅

- Puerto: `findDocumentByHash` + `saveDocumentWithChunks` (BEGIN/COMMIT/ROLLBACK en `PgCorpusRepository`); caso de uso `IngestDocument` (dup → embed → guarda); `ingest/run.ts` fino vía contexto Nest (adiós `new Pool`/`new ModelGateway`/SQL).
- `sync:secop` resuelve `Db` del contexto (adiós `new Pool`); extracción de `SocrataClient` diferida (un solo llamador, sin reutilización).
- `shared/sql.ts` (`escapeLike`) aplicado en `pg-corpus.repository` (emisor) y `secop.service` (5 filtros); `numero LIKE` conserva `%` intencional (agente/documentado).
- Verificación: `typecheck`/tests verdes, goldens 8/8, ingesta prueba (3 chunks 1024 + skip idempotente + borrado), sync N=1 ok, `entidad=%`/`emisor=%` → 0 (literal).

## 2026-10-26 — Bloque F suite + cierre ✅

- `npm run test:unit`: 28 aserciones (dominio, filtro 400/500, transforms) en verde.
- Docs: `CURRENT_ARCHITECTURE`, `MODULE_BOUNDARIES`, `DOMAIN_MODEL`, `DATABASE_AND_PRISMA`, `TESTING_STRATEGY`, `SECURITY_REVIEW` (+ ADR-003 modularización parcial).
- Batería final: `typecheck`/`test`/`test:unit` verdes, goldens 8/8, reglas 1/2/7 por grep, 4/4 contenedores arriba.

## Estado final

Refactor completo A–F. Criterios §15: 1–10 ✅, 11 ✅ (goldens+suites; eval-30 no re-ejecutada, documentado), 12 ✅, 13 ✅ (PROGRESS + SECURITY_REVIEW pendientes), 14 ✅ (0 ficheros web tocados), 15 ✅ (bloques revertibles por separado).
