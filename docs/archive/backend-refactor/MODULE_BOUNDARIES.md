# MODULE_BOUNDARIES.md

## corpus (módulo completo)
Propósito: documentos, fragmentos, ingesta y recuperación. Tablas: `documents`, `chunks` (único escritor). Interfaz pública: `modules/corpus/index.ts` (`CorpusModule`, `SearchDocuments`, `IngestDocument`, `CORPUS_REPOSITORY`, tipos, dominio puro para ingesta). Dependencias: `SharedModule` (Db, ModelGateway vía adaptador). Test: unitarias chunking/normalize/RRF + goldens `/search*`.

## secop (plano + puerto)
Propósito: lectura de contratos sincronizados + señales. Tablas: `secop_contratos` (escritor: `sync` CLI). Interfaz: `SecopService implements ConsultarContratos` (puerto en `agent/secop.port.ts`). Test: goldens `/secop/contracts` + unitarias `evaluarSenales`.

## agent (plano + puertos)
Propósito: investigación con herramientas. Tablas: `investigaciones` (único escritor). Consume: `SearchDocuments`, `CORPUS_REPOSITORY`, `CONSULTAR_CONTRATOS` (nunca SQL directo ni servicios concretos, salvo `SecopService` vía puerto). Test: eval-30 + 1 investigación por bloque.

## verification + report (planos + puerto)
Propósito: veredictos y Markdown. Lee `investigaciones/chunks/secop_contratos` (sin escribir). Interfaz: `VERIFICAR_INVESTIGACION`. Test: goldens de contrato + unitarias `dictaminar`.

## shared/kernel
`config` (único lector env), `pricing`, `sql`, `json`, `presentation` (filtro/transforms), `SharedModule` transitorio. Test: unitarias.

## Reglas
Regla 5 (interfaces públicas) + regla 7 (env) verificadas por grep en cada bloque. Excepciones: `ingest/run.ts` importa dominio de corpus (transitorio, CLI fuera de Nest); `SharedModule` global transitorio (ver ADR-003).
