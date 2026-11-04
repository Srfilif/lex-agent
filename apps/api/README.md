# lex-api — Backend NestJS

API del chat jurídico: RAG híbrido (FTS `lex_spanish` + pgvector HNSW),
agente investigador, chat multi-turno con SSE, identidad (sesiones
rotatorias, TOTP, RBAC), planes/cuotas y facturación sandbox.

## Scripts (`npm run` desde `apps/api/`)

- `start:dev` — dev con ts-node (puerto `PORT`, default 3000).
- `build` / `start` — compila a `dist/` y sirve.
- `typecheck` — `tsc --noEmit`.
- `test:unit` — unitarias de dominio puro, sin DB ni red.
- `test` — regresión contra DB viva (`src/tests/db-regression.ts`).
- `migrate` — aplica `db/migrations/005→017` (tracking `schema_migrations`).
- `ingest -- <manifiesto>` — ingiere corpus desde `data/raw/` (no commiteado).
- `sync:secop -- <n>` — sincroniza contratos SECOP.
- `purge` — purga sesiones muertas y eventos viejos.
- `make:admin` — otorga rol admin.

## Endpoints principales

Salud: `GET /health`, `GET /ready`. Contratos canónicos en
`docs/arquitectura/API_SPECIFICATION.md`:

- Búsqueda: `GET /search`, `GET /search/documentos`, `GET /search/chunk/:id`
- SECOP: `GET /secop/contracts`
- Agente: `POST /agent/investigate` (anónimo bloqueado en prod)
- Chat: `POST /chat/send`, `POST /chat/stream` (SSE), `GET /chat/modelos`,
  `GET /chat/files`, conversaciones/proyectos/archivos/memoria
- Cuenta: `/auth/*` (registro, login, refresh, TOTP), `/account/*`, billing
- Admin: `/ops/metricas` (requiere admin + 2FA en prod)

## Módulos (`src/modules/`)

`account`, `billing`, `chat`, `corpus`, `identity`, `ops`, más `agent/`,
`gateway/`, `ingest/`, `report/`, `secop/`, `verify/`, `shared/`, `migrations/`.

## Entorno

`DATABASE_URL` (default `postgres://lex:lexdev@localhost:5433/lexdb`),
`META_API_KEY`, `OLLAMA_HOST`, `REDIS_URL`, secretos de auth/TOTP/billing.
Lista completa en `.env.example` (raíz). Con `NODE_ENV=production` el arranque
falla rápido si faltan secretos, SMTP o CORS https.
