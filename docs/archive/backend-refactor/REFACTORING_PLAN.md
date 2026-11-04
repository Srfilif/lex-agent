# REFACTORING_PLAN.md — incrementos verificables (backend `apps/api`)

Cada incremento: cambios → `typecheck` + `test` + reglas §DEPENDENCY_RULES → resumen. Sin cambios de contrato ni de esquema.

## Bloque A — Config centralizada (P0, H2)

- Nuevo `src/shared/config/` (schema + validación + tipado; falla rápido).
- Migrar lecturas de `db.ts`, `gateway/model-gateway.ts`, `main.ts`, `secop/sync.ts`, CLIs.
- Verificación: arranque OK sin `.env` parcial (error claro), checks verdes.

## Bloque B — Módulo corpus: dominio + repositorio (P0, H1/H4)

- `modules/corpus/domain/`: mover `chunk.ts`, `normalize.ts`; extraer RRF + `detectarRef` de `search.service.ts`.
- Puerto `CorpusRepository` + `PgCorpusRepository`; `search.service.ts` adelgaza a caso de uso.
- `agent/tools.ts:verificar_cita` usa el puerto (no SQL directo).
- Verificación: `/search*` idénticos + `npm test` + regla grep domain limpio.

## Bloque C — Presentación uniforme (P1, H6)

- DTOs + `ValidationPipe` global (whitelist) + filtro de errores HTTP coherente (404/400/500).
- Preservar formas exactas (tests de contrato contra respuestas actuales).
- Verificación: mismos bodies que hoy para casos válidos; errores tipados para inválidos.

## Bloque D — Puertos agente + dominio restante (P1/P2, H4/H8/H10/H11)

- Puertos `BuscarDocumentos`/`ConsultarContratos` para `Tools`; `balanced()` a `shared/json`.
- Extraer `senales` y veredictos a `domain/`; constantes a config; sumar coste del juez.
- Verificación: 1 investigación + 1 informe comparados con `demo/informe-demo-respaldo.md` (forma).

## Bloque E — CLIs al contenedor + transacción ingesta (P2, H3/H5)

- `ingest`/`sync` resuelven providers del contexto Nest; transacción doc+chunks; escape LIKE (H7).
- Verificación: ingesta de prueba + borrado (ya existe el procedimiento).

## Bloque F — Suite rápida + docs cierre (P2)

- Unitarias dominio (chunking, RRF, veredictos, señales) + contrato HTTP contra golden; `TESTING_STRATEGY.md`, `SECURITY_REVIEW.md`, `API_COMPATIBILITY.md`, `DOMAIN_MODEL.md`, `DATABASE_AND_PRISMA.md`, `CURRENT_ARCHITECTURE.md`, `MODULE_BOUNDARIES.md`; `PROGRESS.md` al día.
- Verificación final: suite completa + (opcional, con autorización por coste) re-corrida eval-30.

Orden: A → B → C → D → E → F. Cada bloque es revertible por separado (commits por bloque).
