# Arquitectura del backend — DDD, Clean Architecture y SOLID

Este documento fija las reglas del backend NestJS. No describe una intención
futura: describe la estructura que el código aplica hoy y que el test de
arquitectura verifica.

## Regla de dependencias

```text
presentation ──→ application ──→ domain
                       │
                       └──→ ports (interfaces)

infrastructure ──→ ports/domain
```

- **domain**: entidades, valores, reglas y puertos de persistencia. Sin
  `@nestjs`, sin `pg`, sin SQL y sin HTTP.
- **application**: casos de uso y puertos de integración. Orquesta dominio y
  puertos; no conoce base de datos, proveedores HTTP ni controladores.
- **infrastructure**: adaptadores concretos (pg/sqlite, LLM, correo, pagos,
  almacenamiento). Implementa puertos.
- **presentation**: controladores, DTOs, guards y SSE. Traduce HTTP a casos de
  uso; no contiene reglas de negocio.

La composición y el cableado viven en `app.module.ts` y en cada
`*.module.ts`. Los módulos se comunican por su `index.ts` público o por tokens
de puerto, nunca importando las carpetas internas de otro contexto.

## Contextos delimitados

| Módulo | Responsabilidad | Puertos publicados |
|---|---|---|
| `identity` | usuarios, sesiones, TOTP, RBAC, rate limit | `USER_REPOSITORY`, guards, tokens de auth |
| `account` | perfil, preferencias, privacidad, memoria | `MEMORY_FOR_AGENT` |
| `billing` | planes, suscripciones, uso, pagos, webhooks | `AGENT_BILLING`, `PAYMENT_PROVIDER` |
| `chat` | conversaciones, mensajes, proyectos, archivos | casos de uso HTTP; `FILE_STORAGE` |
| `corpus` | documentos, chunks, recuperación híbrida | `SearchDocuments`, `CORPUS_REPOSITORY`, `EMBEDDING_PORT` |
| `secop` | lectura del caché de contratos y señales | `SECOP_QUERY`, `SearchContracts` |
| `research` | investigador, verificación de citas e informe | `Investigate`, `BuildReport`, `INVESTIGATION_REPOSITORY` |
| `ops` | métricas operativas de solo lectura | `OPS_METRICS_REPOSITORY` |

`shared/llm` contiene el puerto `LLM_CHAT` y el adaptador `ModelGateway`.
`shared/` aloja configuración, logging, utilidades de DB y presentación común;
no es un cajón para lógica de negocio.

## Estructura de un módulo

```text
modules/<contexto>/
├── domain/
│   ├── <entidad>.ts
│   ├── <regla>.ts
│   └── repositories.ts        # puertos + tokens
├── application/
│   ├── <caso-de-uso>.ts
│   ├── ports.ts               # puertos de integración
│   └── errors.ts
├── infrastructure/
│   ├── persistence/           # pg-*.repository.ts
│   └── <adaptador>/
├── presentation/
│   └── http/
├── <contexto>.module.ts
└── index.ts                   # interfaz pública
```

## Puertos y adaptadores

- **LLM**: `LLM_CHAT` (`shared/llm/ports.ts`) → `ModelGateway`
  (`shared/llm/model-gateway.ts`). Chat, research y el verificador dependen del
  puerto, no de la clase concreta.
- **SECOP**: `SECOP_QUERY` → `SearchContracts` → `PgSecopRepository`. El SQL
  vive en infraestructura.
- **Investigaciones**: `INVESTIGATION_REPOSITORY` → `PgInvestigationRepository`.
  El agente, el verificador y el informe no consultan tablas directamente.
- **Facturación**: `AGENT_BILLING` → `BillingForAgent`. Chat y research no
  importan la implementación.
- **Memoria**: `MEMORY_FOR_AGENT` → `MemoryForAgent`.
- **Métricas**: `OPS_METRICS_REPOSITORY` → `PgOpsMetricsRepository`.

## Cambios aplicados en este refactor

- `agent/`, `report/`, `secop/` y `verify/` se movieron a
  `modules/research` y `modules/secop`; ya no hay carpetas legacy en `src/`.
- El SQL de investigaciones, SECOP y métricas salió de los casos de uso.
- `ChatAgent` y `Tools` dependen de `LLM_CHAT` y `SECOP_QUERY`, no de
  `ModelGateway`/`SecopService`.
- `WebhooksController` obtiene la cabecera de firma desde `PaymentProvider`;
  no importa el adaptador sandbox.
- `ChatAgent` quedó como orquestador del bucle; las herramientas son
  estrategias (`SearchNormasTool`, `SecopContractsTool`) resueltas por
  `ChatToolRegistry`. La numeración de citas y el prompt del sistema también
  salieron a piezas puras.
- `SendChatMessage` y `GenerateTitle` salieron de `chat-agent.ts` a sus propios
  casos de uso.
- `SseWriter` pasó de infraestructura a presentación, que es su capa real.
- `HealthController` pasó a `shared/presentation`.
- Se añadió `npm run test:architecture`, que falla si:
  - el dominio importa framework, infraestructura o shared;
  - aplicación importa `infrastructure/`, `presentation/`, `db`, `pg` o el
    gateway concreto;
  - presentación importa infraestructura;
  - un módulo importa las tripas de otro en vez de su `index.ts`.

## Decisiones pragmáticas

- Los casos de uso usan decoradores de `@nestjs/common` para inyección de
  dependencias. Es acoplamiento al contenedor, no a HTTP ni a persistencia; se
  acepta a cambio de no duplicar un contenedor propio. La lógica de negocio
  sigue siendo testeable con dobles.
- `SearchDocuments` es un caso de uso publicado del corpus. Research lo consume
  a través del `index.ts`; si el contexto crece, se moverá a un puerto de
  integración explícito.
- Las migraciones, seeds y scripts de ingesta/sync viven en `ingest/`,
  `migrations/` y `infrastructure/` porque son entrypoints operativos, no
  casos de uso HTTP.

## Cómo añadir un caso de uso

1. Define o reutiliza un puerto en `application/ports.ts` o
   `domain/repositories.ts`.
2. Implementa el adaptador en `infrastructure/`.
3. Escribe el caso de uso en `application/` sin SQL ni HTTP.
4. Expón el controlador en `presentation/http/` y el DTO en la misma capa.
5. Registra el token y el adaptador en el módulo.
6. Ejecuta `npm run test:architecture`, `npm run test:unit` y
   `npm run test:sqlite`.
