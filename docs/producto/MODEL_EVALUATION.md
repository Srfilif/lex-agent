# MODEL_EVALUATION — Evaluación de modelos (estado: parcial)

**Propósito:** comparar modelos por rol sin asumir capacidades. Fecha: 2026-10-26.

## Hechos verificados (fuentes Meta, fragmentos de búsqueda; releer en vivo)
- Meta Model API sirve modelos Muse Spark (hay 1.1, 1.2 y 1.3 listados) con contexto de 1M tokens y SDK compatible con OpenAI; ofrece *web search grounding* (R1, R2).
- `muse-spark-1.3`: entrada $1.25 / salida $4.25 por millón de tokens; entrada en caché $0.15. `muse-spark-1.3-contributor`: $0.10 / $0.20, pero **tus prompts y respuestas pueden usarse para entrenar** (R1, R2).
- Los modelos Llama y Muse Glimmer aparecen en el sitio de Meta; su disponibilidad por Model API **no está verificada**.

## Matriz por rol (a completar con pruebas)
| Rol | Candidato | Estado |
|---|---|---|
| Razonamiento principal | muse-spark-1.3 (Standard) | **Humo OK 2026-10-26.** Ojo: respuesta trivial consumió 265 tokens completion (251 de razonamiento). Usar `max_tokens` ≥ 500–1000 y medir costo real |
| Tareas baratas (clasificación, metadatos) | muse-spark-1.3-contributor **solo con datos públicos** | Decisión sujeta a Q6 |
| Embeddings | `gemini-embedding-001` (3072 dims, batch OK 2026-11-04); bge-m3 local 1024; Meta `/embeddings` = 404 (Q1) | **2026-11-04:** proveedor dedicado `EMBED_*` + mig 018 (`vector(3072)`) + degradación a solo-FTS sin vectores |
| Reranking | Sin evidencia | Pendiente; alternativa: cross-encoder abierto o solo RRF |
| OCR/visión | Muse Spark describe soporte multimodal (R1) | Pendiente de prueba; no necesario en MVP |
| Herramientas | Verificado: `tool_choice: auto` emite `tool_calls` correctos; forzado → 400 | **Cerrado:** bucle propio + validación JSON; prompt fuerte en vez de forzar |

## Muse Code vs Model API
Muse Code es una herramienta de programación en terminal para **desarrollar** el proyecto; Model API es el servicio de inferencia que usaría la **aplicación**. Son decisiones separadas.

## Plan de pruebas (día 0 y día 6)
Mismo set de 30 preguntas (ver RAG_DESIGN) por modelo; registrar % de citas válidas, abstención correcta, JSON válido, latencia p50/p95 y costo por investigación calculado con tokens reales y precios de R1.

## Costos
Medido día 5 (muse-spark-1.3, $1.25/$4.25 por M): investigación SECOP simple (2 pasos) ≈ $0.018; jurídica profunda (6 pasos, 36k prompt) ≈ $0.063. Escenarios bajo/medio/alto: ~$0.02 / ~$0.04 / ~$0.07 por investigación.

## Evaluación día 8 (set de 30, ver eval/informe-2026-10-26.md)

0 citas inventadas · JSON válido 30/30 (tras fix de truncamiento) · soporte verificada+parcial 86.7% · abstención efectiva 5/5 · inyección obedecida 0/5 · recall@8 100% · latencia p50 12.9 s / p95 19.2 s · costo $1.01 total.
