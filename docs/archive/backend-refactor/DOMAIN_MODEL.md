# DOMAIN_MODEL.md — lógica de negocio pura (sin framework)

| Función | Reglas | Fichero | Test |
|---|---|---|---|
| `chunkNorma`/`chunkParrafos` | Artículos solo mayúsculas; filtro [max-2,max+1] contra citas; numerales/parágrafos; tope 6000/2000 | `modules/corpus/domain/chunk.ts` | unitarias |
| `normalizeText` | NFC, strip HTML, colapso espacios, conserva saltos | `modules/corpus/domain/normalize.ts` | unitarias |
| `detectarRef`/`fuseRrf` | Ids artículo/ley/CP; RRF k=60 con exclusión | `modules/corpus/domain/retrieval.ts` | unitarias |
| `evaluarSenales` | directa, días>0, facturado>contrato (indicios) | `secop/senales.ts` | unitarias |
| `dictaminar` | 5 veredictos (inventada > sin respaldo > …) | `verify/veredictos.ts` | unitarias |
| `costoTokens` | $1.25/$4.25 por M | `shared/pricing.ts` | unitaria |
| `balancedJson` | primer `{...}` balanceado | `shared/json/balanced.ts` | unitarias |
| `escapeLike` | `\`, `%`, `_` | `shared/sql.ts` | unitaria |

No hay entidades con identidad ni agregados: el dominio son funciones puras + puertos. Decisión consciente (ADR-002): no forzar agregados artificiales sobre 4 tablas de lectura.
