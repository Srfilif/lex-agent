# TARGET_ARCHITECTURE.md — Modular monolith pragmático

## Contextos delimitados (reales, del código actual)

| Módulo | Capacidad | Tablas | Hoy en |
|---|---|---|---|
| `corpus` | Documentos, chunks, ingesta, recuperación híbrida | `documents`, `chunks` | `ingest/`, `search/`, `db.ts` (parte) |
| `secop` | Contratos sincronizados + señales | `secop_contratos` | `secop/` |
| `agent` | Investigación con herramientas | `investigaciones` | `agent/` |
| `verification` | Veredictos + informe | (lee las anteriores) | `verify/`, `report/` |
| `shared/kernel` | Config, pool DB, puertos LLM, utilidades JSON | — | `env.ts`, `db.ts`, `gateway/` |

## Estructura por módulo (solo capas con contenido real)

```text
src/modules/corpus/
├── corpus.module.ts            # composición: tokens + providers
├── domain/                     # puro, sin Nest ni pg
│   ├── chunk.ts                # chunking estructural (hoy ingest/chunk.ts)
│   ├── normalize.ts            # normalización (hoy ingest/normalize.ts)
│   ├── retrieval.ts            # RRF + detección de refs (extraído de search.service)
│   └── repositories.ts         # puertos CorpusRepository (interfaces)
├── application/
│   └── search-documents.ts     # caso de uso BuscarDocumentos
├── infrastructure/
│   └── pg-corpus.repository.ts # implementa puertos con node-postgres
└── presentation/
    ├── search.controller.ts    # fino + SearchQueryDto
    └── dto.ts
```

`agent/`, `secop/`, `verification/` siguen el mismo esqueleto reducido (sin capas vacías). CLI (`ingest`, `sync:secop`, `test`) se convierten en comandos que resuelven casos de uso del contenedor Nest en vez de `new` manuales.

## Reglas clave

- `domain/` no importa Nest, pg, HTTP ni otros módulos (verificable con grep/lint).
- `application/` depende de `domain` + puertos; nunca de `*.repository.ts` concretos.
- Comunicación entre módulos solo vía casos de uso expuestos o puertos (`agent` → `corpus`/`secop` mediante `BuscarDocumentos`/`ConsultarContratos`, no servicios concretos).
- Config centralizada y validada en `shared/config` (falla rápido al arrancar, no en la primera request).
- Contratos HTTP y esquema DB inalterados (ver AUDIT.md §8/§10).

## Lo que NO se introduce (decisión consciente)

Prisma (ADR-001), CQRS/buses/mediadores, microservicios, framework de tests nuevo (se amplía el harness actual + assertions unitarias con `node:test` si hace falta), ORM/entidades ActiveRecord.
