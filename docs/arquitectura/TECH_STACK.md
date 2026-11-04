# TECH_STACK — decisiones fijadas (Día 1)

| Capa | Elección | Versión pineada | Por qué |
|---|---|---|---|
| API | NestJS (Express) + TypeScript | Nest 11, Node 22 | Modular por defecto; coincide con SYSTEM_ARCHITECTURE |
| DB | PostgreSQL + pgvector | `pgvector/pgvector:pg16` | FTS español + vectores en una sola base |
| LLM razonamiento | Meta Model API `muse-spark-1.3` | vía `ModelGateway` | Verificado Día 0; `tool_choice` solo `auto` |
| Embeddings | bge-m3 local vía Ollama (multilingüe, 1024 dims) | `ollama/ollama` + `bge-m3` (1.2 GB) | Meta → 404 (Q1 cerrada). Interfaz: `ModelGateway.embed()` |
| Rerank | RRF sin reranker (identidad) | — | `ModelGateway.rerank()` sustituible |
| Contenedores | Docker Compose | Compose v5 | `docker compose up` levanta DB + API |

Notas:
- `max_tokens` generoso (≥1000): el razonamiento consume ~250+ tokens por llamada (Día 0).
- `ModelGateway` cuenta tokens en memoria (`totals`) para el cálculo de costo del día 5.
- Dimensión de `embedding` provisional: 1024 (e5-large / bge-m3). Migrar si el modelo final difiere.
