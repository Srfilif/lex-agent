# DATABASE_AND_PRISMA.md

## Prisma: N/A justificado (ADR-001)

No existe Prisma en el repo y no se introduce: las consultas críticas (FTS `lex_spanish`, `unaccent`, HNSW `vector_cosine_ops`, `vector(1024)`) exigen SQL crudo igualmente; 4 tablas no justifican la migración. La persistencia vive tras puertos (`CorpusRepository`; resto, SQL encapsulado en servicios camino a puertos).

## Esquema (intacto, ver DATABASE_SCHEMA.md raíz)

`documents`, `chunks` (GIN `fts`, HNSW `embedding`), `secop_contratos`, `investigaciones`. Sin migraciones en este refactor (cero cambios de esquema/datos).

## Transacciones (nuevo, Bloque E)

`saveDocumentWithChunks`: BEGIN → doc → chunks → COMMIT / ROLLBACK (pool client). Resto: lecturas puntuales; `sync` idempotente por upsert.

## Mapeos y N+1

Mapeo fila→objeto en un solo punto por lector (`map` en casos de uso/servicios; `numeric→Number` en `secop`/`report`). Sin N+1 nuevos: lecturas por consulta única o `= ANY($1)`.
