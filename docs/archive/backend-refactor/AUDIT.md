# AUDIT.md — Backend `apps/api` (NestJS 11 + pg directo, sin Prisma)

Fecha: 2026-10-26. Alcance: solo `apps/api` (22 ficheros TS). Método: inspección directa + greps + checks ejecutados.

## 1. Línea base verificada

- `npm run typecheck` → verde. `npm test` (regresión DB, 6 checks) → verde.
- Sin `nest-cli.json`, sin lint, sin framework de tests, sin Prisma, sin auth/guards, sin DTOs/ValidationPipe, sin `forwardRef`, sin dependencias circulares, sin `any` en `src/`.
- Despliegue: monolito en un contenedor (`lexagent-api`) + Postgres(pgvector) + Ollama. `docker compose up` verificado.

## 2. Arquitectura actual

Monolito con un único `AppModule` (`src/app.module.ts`) y carpetas por capacidad técnica que ya anticipan dominios: `search/`, `secop/`, `agent/`, `verify/`, `report/`, `ingest/`, `gateway/`. Sin capas: los servicios mezclan orquestación, SQL y reglas; los controladores son delgados (solo parseo de query/body).

## 3. Inventario de módulos y responsabilidades

| Carpeta | Responsabilidad real | Estado |
|---|---|---|
| `gateway/model-gateway.ts` | Puerto LLM/embedding: chat Meta, embed Ollama, contadores | Infraestructura sin interfaz; lee 5 env directos |
| `db.ts` | Pool pg + ping; expone `raw` (Pool) a todos | Único acceso DB, sin repositorios |
| `search/` | Recuperación híbrida FTS+vectorial+RRF, endpoint `/search`, `chunk/:id` | Mezcla retrieval + SQL + mapping |
| `secop/` | Lectura `secop_contratos` + señales, `/secop/contracts`; `sync.ts` CLI aparte | SQL + reglas de señal juntas |
| `ingest/` | `normalize`/`chunk` (puras, sin framework ✓) + `run.ts` CLI con SQL y `new` manuales | Mitad dominio puro, mitad script acoplado |
| `agent/` | `TOOLS`+`Tools` (ejecutor), `AgentService` (bucle), `/agent/*` | `Tools` importa servicios concretos; SQL directo en 2 sitios |
| `verify/` | Existencia + juez LLM + veredictos | SQL + parsing + reglas juntas |
| `report/` | Markdown + bloques estructurados, `/report/:id` | Importa `VerifierService` concreto; 3 consultas SQL |
| `env.ts` | `.env` + `dbUrl()` (ya deduplicado ✓) | Solo usado por CLIs, no por Nest |
| `tests/db-regression.ts` | 6 checks SQL vía `npm test` | Requiere DB viva; único test |

## 4. Hallazgos por severidad (con evidencia)

### Alta

- **H1. SQL disperso sin capa de persistencia.** 20+ `.query(` en 8 ficheros (`search.service.ts:76,96,97,113,133`, `agent.service.ts:88,129`, `tools.ts:163`, `report.service.ts:15,55,70`, `secop.service.ts:60`, `verifier.service.ts:44,65,90`, `ingest/run.ts:47,62,83`, `sync.ts:54`). Cada servicio mapea filas a mano (conversiones `numeric→Number` duplicadas en `secop.service.ts` y `report.service.ts`). Riesgo: cambios de esquema tocan N ficheros; mappings inconsistentes.
- **H2. Configuración dispersa y con defaults inconsistentes.** `process.env` leído en `db.ts:10`, `gateway/model-gateway.ts:44,46,48,136,140`, `main.ts:8`, `sync.ts:25`. Defaults duplicados (URLs, puertos, modelo) y `env.ts` solo usado por CLIs. Riesgo: deriva entre entornos.

### Media

- **H3. Instanciación manual fuera del DI.** `ingest/run.ts:45,55` (`new Pool`, `new ModelGateway`), `sync.ts:26`, `tests/db-regression.ts:10`. Impide sustitución (puertos) y testeo.
- **H4. Dependencias concretas entre capacidades.** `agent/tools.ts:3-4` importa `SearchService`/`SecopService`; `report.service.ts:3` importa `VerifierService`. No hay puertos; un cambio de firma rompe consumidores.
- **H5. Ingesta sin transacción.** `ingest/run.ts:62-83` inserta documento y luego chunks uno a uno: un fallo intermedio deja documento sin chunks (y hay ~1400 roundtrips; aceptable en CLI, no en request).
- **H6. Sin capa de validación de entrada.** Controladores parsean a mano (`secop.controller.ts` `num()`, `search.controller.ts` `Number()`). `top_k=abc` → `NaN` → responde vacío sin error; `POST /agent/investigate` sin pregunta devuelve 200 con `{error}` (inconsistente con los 404 de `report`/`chunk`).
- **H7. Comodines LIKE no escapados.** `secop.service.ts` interpola input de usuario en patrones `ILIKE '%…%'`: `%`/`_` del usuario alteran la búsqueda (no es SQLi —va parametrizado— pero sí comportamiento incorrecto).
- **H8. Duplicación: extracción JSON balanceada** en `agent.service.ts` (`balanced`) y `verifier.service.ts` (`balanced` + `parseJuicios`): misma necesidad, dos implementaciones.

### Baja / informativa

- **H9. Sin autenticación ni autorización.** Aceptado para hackatón local monousuario (el multiusuario es módulo H post-MVP); bloqueante antes de exponer o multiusuario.
- **H10. Números mágicos**: `RRF_K=60`, topes (20/50), reintentos, TTLs implícitos, precios USD en `agent.service.ts`.
- **H11. Coste del juez no contabilizado** en `costo_usd` (solo el bucle del agente).
- **H12. `Db` expone `raw: Pool`**: necesario hoy para los servicios; debe desaparecer tras introducir repositorios.

### No hallado (verificado, no presupuesto)

Controladores con lógica de negocio (solo parseo banal), dependencias circulares, `any`, entidades acopladas a ORM (no hay ORM ni entidades), guards/permisos que romper (no existen), Prisma (no existe: ver §7).

## 5. Riesgos

1. Refactor rompe la demo del día 10 si cambia contratos o introduce regresiones → mitigación: contratos congelados (§8), incrementos con checks, rama de trabajo.
2. Reescribir persistencia a Prisma migraría riesgo sin beneficio (FTS español+unaccent, HNSW y `vector(1024)` exigen SQL crudo igual) → decisión: no introducir Prisma (ADR-001 prevista).
3. Coste/tokens de re-ejecutar la eval de 30 tras cada cambio (~$1, ~40 min) → mitigación: suite rápida nueva (unit + API sin LLM) y eval completa solo al final.

## 6. Comandos disponibles (backend)

`npm run build|start|start:dev|typecheck|test|ingest|sync:secop` (en `apps/api`). Sin lint ni coverage. DB: `docker exec lexagent-db-1 psql -U lex -d lexdb`.

## 7. Propuesta de arquitectura objetivo (resumen)

Modular monolith por contextos reales (las carpetas actuales ya casi lo son), con capas pragmáticas por módulo: `domain/` (puro: chunking, señales, veredictos, RRF), `application/` (casos de uso + puertos), `infrastructure/` (repositorios pg + adaptadores LLM), `presentation/` (controladores+DTOs finos). Núcleo compartido: `config/` centralizada y `database/` (pool + migraciones). Sin Prisma, sin CQRS/buses, sin microservicios. Detalle en `TARGET_ARCHITECTURE.md` (fase 2).

## 8. Contratos HTTP congelados (compatibilidad frontend)

`GET /health`, `GET /search`, `GET /search/chunk/:id`, `GET /secop/contracts`, `POST /agent/investigate`, `GET /agent/investigaciones/:id`, `GET /report/:id` — formas exactas en `API_SPECIFICATION.md` (raíz). Cualquier cambio requiere justificación + compatibilidad.

## 9. Prioridades y archivos previstos

1. P0: `config/` centralizada + tipada (toca: nuevo `config/`, `db.ts`, `gateway/`, `main.ts`, `env.ts`, CLIs).
2. P0: puertos+repositorios pg para `chunks/documents` (nuevo `modules/corpus/*`, adelgaza `search.service.ts`, `tools.ts:163`).
3. P1: extraer `domain/` puro (mover `ingest/chunk.ts`, `normalize.ts`; reglas de `senales`, veredictos, RRF) + deducir `balanced()` a `shared/`.
4. P1: DTOs + `ValidationPipe` global + filtro de errores uniforme (toca controladores; preserva formas).
5. P2: puertos agente→(búsqueda, SECOP), caso de uso `InvestigarPregunta`, transacción en ingesta, escape LIKE.
6. P2: suite rápida (unit dominio + API con dobles) y `TESTING_STRATEGY.md`.

## 10. Intacto

Frontend (`apps/web`), esquema y datos DB (1407 chunks, 3000 contratos SECOP), contratos HTTP, corpus `data/`, `.env`, infra compose salvo lo necesario para probar.
