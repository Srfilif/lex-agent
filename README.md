# LexAgent — Chat jurídico colombiano con RAG

Asistente conversacional sobre normativa colombiana (contratación estatal y
constitución): chat multi-turno con streaming, proyectos, archivos por
proyecto, memoria, citas verificables al fragmento y datos SECOP.

- **API:** NestJS + TypeScript — búsqueda híbrida FTS + vectorial (pgvector),
  agente investigador, auth con TOTP, planes y facturación (sandbox).
- **Web:** React 19 + Vite, sin dependencias de UI.
- **Datos:** PostgreSQL 16 + pgvector, Redis (rate-limit), Ollama `bge-m3`
  (embeddings locales 1024 dims).

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

| Servicio | URL |
|---|---|
| Web | http://localhost:4173 |
| API | http://localhost:3000 (`/health`, `/ready`) |
| Postgres | `localhost:5433` (el 5432 del host suele estar ocupado) |
| Ollama | http://localhost:11434 |

Staging (prod-like, exige secretos por entorno):

```powershell
docker compose -f docker-compose.yml -f docker-compose.staging.yml up --build -d
```

## Estructura

```text
apps/api/     API NestJS (ver apps/api/README.md)
apps/web/     Frontend React (ver apps/web/README.md)
db/           init.sql (esquema base) + migrations/ (ver db/README.md)
docs/         Documentación (índice en docs/README.md)
  arquitectura/  sistema, RAG, esquema DB, API, citas, stack
  producto/      alcance, plan, demo, roadmap, preguntas abiertas
  operaciones/   checklist pre-exposición y operación segura
  frontend/      arquitectura del frontend
  archive/       historial del refactor (solo referencia)
scripts/      Operación: backup/restore de Postgres
tests/        smoke/ (humos + goldens), eval/ (runners), e2e/ (Playwright)
eval/         Datasets y informes de evaluación
demo/         Informe de respaldo para la demo en vivo
```

## Comandos útiles (desde la raíz)

```powershell
npm run typecheck   # tsc en api + web
npm run build       # build de api + web
npm run test:unit   # unitarias de dominio puro (api, sin DB ni red)
npm run audit       # npm audit en ambos workspaces
npm run dev:api     # api en modo dev (fuera de Docker)
npm run dev:web     # web en modo dev (puerto 5173)
```

Con el stack vivo: humos `node tests/smoke/smoke_*.mjs`, goldens
`python tests/smoke/contract_check.py --check`, evals en `tests/eval/`.
Detalle en [tests/README.md](tests/README.md).

## Documentación

- Índice general: [docs/README.md](docs/README.md)
- Contratos HTTP: [docs/arquitectura/API_SPECIFICATION.md](docs/arquitectura/API_SPECIFICATION.md)
- Roadmap y pendientes: [docs/producto/ROADMAP.md](docs/producto/ROADMAP.md)
- Operación segura pre-exposición: [docs/operaciones/SECURITY_OPERATIONS.md](docs/operaciones/SECURITY_OPERATIONS.md)
- Guion de demo: [docs/producto/DEMO_SCRIPT.md](docs/producto/DEMO_SCRIPT.md)

## Seguridad

Nunca commitees `.env`, `backups/`, `data/` ni dumps (ver [.gitignore](.gitignore)).
Para reportar vulnerabilidades ver [SECURITY.md](SECURITY.md).

## Licencia

MIT — ver [LICENSE](LICENSE).

---

Creado con ❤️ por SrFilif en colombia
