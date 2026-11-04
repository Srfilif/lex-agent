# CURRENT_ARCHITECTURE.md — estado tras Bloques A–F

Monolito modular NestJS (`apps/api/src`). Un despliegue (contenedor `lexagent-api`).

```text
src/
├── main.ts                  # bootstrap: CORS + ValidationPipe + filtro + puerto (vía CONFIG)
├── app.module.ts            # composición raíz (usa useExisting para puertos)
├── shared/
│   ├── config/              # AppConfig validada + ConfigModule global (Bloque A)
│   ├── shared.module.ts     # expone Db + ModelGateway (transitorio, ver ADR-003)
│   ├── pricing.ts           # coste tokens (kernel)
│   ├── sql.ts               # escapeLike (H7)
│   ├── json/balanced.ts     # extracción JSON (dedup H8)
│   └── presentation/        # filtro HTTP uniforme + transforms DTO
├── modules/corpus/          # contexto completo (Bloque B): domain/application/
│   │                        # infrastructure/pg + adapter/presentation + module
│   ├── domain/              # chunk, normalize, retrieval (RRF/refs), puerto CorpusRepository
│   ├── application/         # SearchDocuments, IngestDocument, puerto EmbeddingPort
│   ├── infrastructure/      # PgCorpusRepository (lecturas + save transaccional)
│   └── presentation/        # SearchController + SearchQueryDto
├── secop/                   # plano + puerto: service (usa evaluarSenales), dto, sync CLI (vía contexto)
├── agent/                   # plano + puertos: service, Tools (puertos), dto, secop.port
├── verify/                  # plano: service (usa dictaminar), veredictos (dominio)
├── report/                  # plano: service, verify.port
├── gateway/                 # ModelGateway (chat Meta + embed Ollama, config por DI)
├── ingest/                  # CLI fino → IngestDocument (dominio en corpus)
├── db.ts                    # Pool + ping (config por DI; `raw` en retirada)
└── tests/                   # db-regression.ts (vive) + unit.ts (28 asserts)
```

Puertos (`Symbol` + `useExisting`/`useClass`): `CONFIG`, `CORPUS_REPOSITORY`, `EMBEDDING_PORT`, `CONSULTAR_CONTRATOS`, `VERIFICAR_INVESTIGACION`. Comunicación entre capacidades solo vía casos de uso expuestos o puertos.
