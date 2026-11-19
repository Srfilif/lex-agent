# Documentación — índice

## Arquitectura (`arquitectura/`)

- `SYSTEM_ARCHITECTURE.md` — arquitectura del sistema.
- `ARQUITECTURA_DDD.md` — reglas DDD/Clean Architecture, puertos y test de límites.
- `TECH_STACK.md` — stack tecnológico y decisiones.
- `RAG_DESIGN.md` — diseño del RAG (metadatos, fragmentación, retrieval).
- `DATABASE_SCHEMA.md` — resumen del esquema (fuente de verdad: `db/init.sql`).
- `API_SPECIFICATION.md` — contratos HTTP canónicos.
- `CITATION_VERIFICATION.md` — verificación de citas con juez LLM.

## Producto (`producto/`)

- `ROADMAP.md` — estado real verificado contra código + pendientes (antes `FALTANTE.md`).
- `MVP_SCOPE.md` — alcance del MVP.
- `EXECUTIVE_SUMMARY.md` — resumen ejecutivo.
- `HACKATHON_PLAN.md` — plan de hackatón (incluye §"No prometer").
- `DEMO_SCRIPT.md` — guion de la demo (+ `demo/informe-demo-respaldo.md`).
- `MODEL_EVALUATION.md` — evaluación de modelos (parcial).
- `PUBLIC_DATA_SOURCES.md` — fuentes públicas (IDs pendientes de verificar).
- `RESEARCH_REFERENCES.md` — referencias de investigación.
- `OPEN_QUESTIONS.md` — preguntas abiertas de producto.
- `REDISENO_LEGALTECH_2026-11.md` — auditoría, cambios y pendientes del
  rediseño de plataforma.

## Operaciones (`operaciones/`)

- `SECURITY_OPERATIONS.md` — checklist bloqueante pre-exposición, secretos,
  probes, logs y respuesta a incidentes.
- `ACCESS_MODES.md` — modos de acceso (open/closed/whitelist/code), variables,
  CLI, endpoints y gestión desde el panel Admin.

## Frontend (`frontend/`)

- `ARQUITECTURA.md` — arquitectura del frontend.
- Landing pública: app Next independiente en `apps/landing`
  (ver `apps/landing/README.md`).

## Archivo (`archive/`)

- `backend-refactor/` — historial del refactor del backend (días 0–9).
  Solo referencia; lo vivo se movió a `docs/operaciones/` y `tests/smoke/`.
  Ver `archive/README.md`.
