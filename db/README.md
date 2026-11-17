# Base de datos — Postgres 16 + pgvector

## Piezas

- `init.sql` — esquema base (extensiones `vector`/`pg_trgm`/`unaccent`,
  config `lex_spanish`, `documents`, `chunks`, ...). Se monta en
  `docker-entrypoint-initdb.d` vía `docker-compose.yml`: solo aplica en la
  **primera creación** del volumen `pgdata`.
- `migrations/002–004` — baseline aplicado a mano antes del runner; no se
  tocan (`002_unaccent`, `003_secop_contratos`, `004_investigaciones`).
- `migrations/005–017` — se aplican con el runner (tracking en
  `schema_migrations`, una transacción por archivo):
  `005_identity`, `006_totp`, `007_billing`, `008_payments`, `009_account`,
  `010_chat`, `011_chat_projects`, `012_project_files`, `013_chat_models`,
  `014_chat_memory`, `015_file_sospechoso`, `016_conv_topics`,
  `017_session_mfa`.

## Uso

```powershell
# BD limpia desde cero:
docker compose up -d db        # aplica init.sql al crear el volumen
cd apps/api; npm run migrate   # aplica 005→017 (005–019 según regex)
```

```powershell
# Postgres propio sin Docker (requiere extensión pgvector instalada):
psql -d lexdb -f db/init.sql
psql -d lexdb -f db/migrations/002_unaccent.sql -f db/migrations/003_secop_contratos.sql -f db/migrations/004_investigaciones.sql
cd apps/api; npm run migrate
# Apunta DATABASE_URL en el .env a ese Postgres y arranca con npm run dev
```

## SQLite (dev local)

Con `DATABASE_PROVIDER=sqlite`, `npm run migrate` aplica
`db/sqlite/schema.sql` (espejo del estado final: 27 tablas + catálogo de
planes) al fichero `SQLITE_PATH` (default `data/lexdb.sqlite`, ignorado
por git). Diferencias: sin extensiones ni tsvector/HNSW, `embedding`
como TEXT-JSON, booleanos 0/1 y timestamps ISO-UTC. Para resetear: borra
el `.sqlite` y repite `migrate` (+ `seed` si quieres usuarios).

Resumen del modelo: `docs/arquitectura/DATABASE_SCHEMA.md`.
Backups: `node scripts/backup_db.mjs [salida]` (dumps en `backups/`,
nunca commitear).
