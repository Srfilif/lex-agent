# DATABASE_SCHEMA — esquema base (Día 1)

Fuente de verdad: [db/init.sql](/absolute/path/C:\Dev\Hackaton\LexAgent/db/init.sql) (se aplica al crear el contenedor).

## Tablas

**documents** — un registro por documento del corpus.
`id` (uuid) · `titulo` · `emisor` · `tipo` (constitucion, ley, decreto, sentencia, concepto, doctrina, opinion) · `fecha` · `numero` · `jurisdiccion` · `tema` · `url_original` · `fecha_consulta` · `version` · `hash_contenido` (único) · `estado_procesamiento` (pendiente/procesado/error) · `autoridad` (vinculante/interpretativa/opinion) · `vigencia` (…/`vigencia_desconocida` por defecto).

**chunks** — fragmentos citables; toda cita resuelve a un `chunk_id`.
`chunk_id` (uuid) · `doc_id` → documents · `ruta` (p. ej. `Ley 80/1993 > Art. 24 > num. 1`) · `offset_inicio/fin` · `pagina` · `texto` · `texto_contexto` · `embedding vector(1024)` (bge-m3) · `fts` (tsvector con config `lex_spanish`: unaccent + stemmer).

## Índices

- `GIN(fts)`, `HNSW(embedding)` (coseno), `doc_id`, `tipo`, `tema`, `numero`.
- Extensiones: `vector`, `pg_trgm`, `unaccent`.

## Corpus ingerido (2026-10-26)

- Ley 1150/2007: 113 chunks · Ley 80/1993: 430 chunks · Const. 1991: 864 chunks. Total 1407 (chunking por numeral/parágrafo, tope ~6 KB), embeddings 1024 dims.

Limitación conocida: artículos con doble versión generan 2 chunks con rutas casi iguales; las citas siguen resolviendo a fragmentos reales.

**secop_contratos** — caché sincronizado de SECOP II Contratos Electrónicos (`jbjy-vk9h`, 3000 recientes al 2026-10-26). Campos: id (:id Socrata), entidad (nombre/nit/depto/ciudad), proceso/contrato (ids, referencia, estado), objeto (descripcion/objeto/tipo/modalidad), fechas (firma/inicio/fin), proveedor (nombre/documento), valores (contrato/facturado/pagado), dias_adicionados, urlproceso, ultima_actualizacion, synced_at.

**investigaciones** — `id`, `pregunta`, `traza` (jsonb), `respuesta` (jsonb), `usage`, `costo_usd`, `created_at`.
