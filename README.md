# LexAgent — Chat jurídico colombiano con RAG

Asistente conversacional sobre normativa colombiana (contratación estatal y
constitución): chat multi-turno con streaming, proyectos, archivos por
proyecto, memoria, citas verificables al fragmento y datos SECOP.

- **API:** NestJS + TypeScript — búsqueda híbrida FTS + vectorial (pgvector),
  agente investigador, auth con TOTP, planes y facturación (sandbox).
- **Web:** React 19 + Vite, shadcn/ui sobre Tailwind CSS v4, tokens propios y
  `lucide-react` para iconos.
- **Landing:** Next.js 15 (App Router) + CSS Modules, app independiente con SEO
  y renderizado en servidor (`apps/landing`).
- **Datos:** PostgreSQL 16 + pgvector, Redis (rate-limit), embeddings por
  proveedor dedicado (`EMBED_PROVIDER=gemini`, 3072 dims) u Ollama `bge-m3`
  local (1024 dims).

## Requisitos

- Node 22 (ver [.nvmrc](.nvmrc)), Docker + Docker Compose, Python 3 (solo
  humos/evals `.py`).
- Clave de Meta Model API.

## Cómo correr

```powershell
# 1. Variables de entorno
Copy-Item .env.example .env
#    Edita .env y pon tu META_API_KEY real (el .env nunca se commitea)

# 2. Levantar todo (db + redis + ollama + api + web)
docker compose up -d --build

# 3. Base de datos (una vez): baseline + migraciones + corpus + SECOP
cd apps/api
npm run migrate
npm run ingest -- ../../data/raw/<manifiesto>.json   # textos en data/, no se commitean
npm run sync:secop -- 3000
cd ../..
```

Sin embeddings (Meta 404 / Ollama apagado) la ingesta guarda igual con
`dims=0` (solo FTS, sin vectores) y el chat funciona degradado.

| Servicio | URL |
|---|---|
| Web | http://localhost:4173 |
| Landing | http://localhost:3001 |
| API | http://localhost:3000 (`/health`, `/ready`) |
| Postgres | `localhost:5433` (el 5432 del host suele estar ocupado) |
| Ollama | http://localhost:11434 |

Staging (prod-like, exige secretos por entorno):

```powershell
docker compose -f docker-compose.yml -f docker-compose.staging.yml up --build -d
```

## Dev local sin Docker

```powershell
npm run dev   # API :3000 + web :5173 con el .env de la raíz
```

- Lee `DATABASE_URL`, `PORT`, `META_API_KEY` y demás del `.env` (el entorno
  real manda si define la variable).
- Deriva `VITE_API_URL` del `PORT` y guarda archivos en `data/project-files/`.
- Requiere Postgres+pgvector alcanzable y embeddings, a elegir:
  - **Híbrido:** `docker compose up -d db ollama` (solo infra) + `npm run dev`
    (los valores por defecto del `.env` apuntan ahí).
  - **100% sin Docker:** tu propio Postgres con pgvector (aplica `db/init.sql`
    + `migrations/002–004` + `npm run migrate`, ver `db/README.md`) y
    `EMBED_PROVIDER=gemini` (+`EMBED_API_KEY`, sin Ollama) u Ollama local
    con `bge-m3`.
- Sin DB el API responde `degraded` en `/health`; sin `META_API_KEY` el chat
  no funciona. Abre http://localhost:5173 en el navegador.

## Dev con SQLite (sin Postgres)

Para desarrollo sin Postgres ni Docker: en `.env` pon
`DATABASE_PROVIDER=sqlite` (se ignora `DATABASE_URL`) y corre:

```powershell
npm run migrate   # crea data/lexdb.sqlite con el esquema + catálogo de planes
npm run seed      # crea usuario@lex.local / lex12345 y admin@lex.local / admin12345
npm run dev       # API + web contra sqlite
```

Notas: el seed se rehúsa en producción; el RAG en sqlite usa LIKE +
coseno en JS (sin pgvector/FTS, suficiente para dev); `data/*.sqlite`
no se commitea. Detalle en `db/README.md`.

## Estructura

```text
apps/api/     API NestJS (ver apps/api/README.md)
apps/web/     Frontend React (ver apps/web/README.md)
apps/landing/ Landing Next.js (ver apps/landing/README.md)
db/           init.sql (esquema base) + migrations/ (ver db/README.md)
docs/         Documentación (índice en docs/README.md)
  arquitectura/  sistema, RAG, esquema DB, API, citas, stack
  producto/      alcance, plan, demo, roadmap, preguntas abiertas
  operaciones/   checklist pre-exposición y operación segura
  frontend/      arquitectura del frontend
  archive/       historial del refactor (solo referencia)
scripts/      Runner dev local + backup/restore de Postgres
tests/        smoke/ (humos + goldens), eval/ (runners), e2e/ (Playwright)
eval/         Datasets y informes de evaluación
demo/         Informe de respaldo para la demo en vivo
```

## Comandos útiles (desde la raíz)

```powershell
npm run dev         # API + web sin Docker con el .env de la raíz
npm run typecheck   # tsc en api + web
npm run build       # build de api + web
npm run test:unit   # unitarias de dominio puro (api, sin DB ni red)
npm run test:architecture  # límites DDD/Clean del backend
npm run audit       # npm audit en ambos workspaces
npm run dev:api     # api en modo dev (fuera de Docker)
npm run dev:web     # web en modo dev (puerto 5173)
npm run dev:landing # landing Next en modo dev (puerto 3001)
# La landing tiene dependencias propias: cd apps/landing && npm install
# Detalle y variables: apps/landing/README.md
```

Con el stack vivo: humos `node tests/smoke/smoke_*.mjs`, goldens
`python tests/smoke/contract_check.py --check`, evals en `tests/eval/`.
Detalle en [tests/README.md](tests/README.md).

## Documentación

- Índice general: [docs/README.md](docs/README.md)
- Contratos HTTP: [docs/arquitectura/API_SPECIFICATION.md](docs/arquitectura/API_SPECIFICATION.md)
- Roadmap y pendientes: [docs/producto/ROADMAP.md](docs/producto/ROADMAP.md)
- Rediseño LegalTech (auditoría y cambios):
  [docs/producto/REDISENO_LEGALTECH_2026-11.md](docs/producto/REDISENO_LEGALTECH_2026-11.md)
- Operación segura pre-exposición: [docs/operaciones/SECURITY_OPERATIONS.md](docs/operaciones/SECURITY_OPERATIONS.md)
- Guion de demo: [docs/producto/DEMO_SCRIPT.md](docs/producto/DEMO_SCRIPT.md)

## Seguridad

Nunca commitees `.env`, `backups/`, `data/` ni dumps (ver [.gitignore](.gitignore)).
Para reportar vulnerabilidades ver [SECURITY.md](SECURITY.md).

## Licencia

MIT — ver [LICENSE](LICENSE).

---

Creado con ❤️ por SrFilif en colombia
