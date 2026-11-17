# OPEN_QUESTIONS — Decisiones y verificaciones pendientes

**Propósito:** lista priorizada de lo que bloquea o condiciona decisiones. Prioridad: **P0** bloquea el MVP, **P1** condiciona el diseño, **P2** puede esperar.

| ID | Pregunta | Prio | Cómo cerrarla | Opción provisional |
|----|----------|------|---------------|--------------------|
| Q1 | ¿Meta Model API ofrece embeddings y reranking? **CERRADA 2026-11-04: NO (404 re-confirmado en vivo).** Toggle `EMBED_PROVIDER=meta\|ollama` existe; con `meta` el RAG degrada a solo-FTS con warn (el chat no se cae). Rerank: solo RRF en MVP. | P0 | ~~Humo [5/5]~~ Hecho: 404 real | `ollama` (bge-m3, 1024 dims) = única vía vectorial |
| Q2 | ¿Qué modelos están habilitados y con qué límites/saldo? **PARCIAL 2026-10-26: 9 modelos listados** (`muse-spark-1.3/1.2/1.1`, tiers contributor, wonder, sam-3.1, voice, image). Sin headers de rate-limit/cuota; saldo sin verificar. | P0 | ~~Listar modelos día 0~~ Hecho; falta averiguar saldo/límites en consola | Usar `muse-spark-1.3` (Standard); contributor solo con datos públicos |
| Q3 | ¿Soporta function calling? **CERRADA 2026-10-26: SÍ, solo `tool_choice: auto`.** `tool_choice` forzado/nombrado → 400. | P0 | ~~Humo con herramientas~~ Hecho | Bucle propio con validación JSON; forzar tools vía prompt, no vía `tool_choice` |
| Q4 | ¿Cuáles fuentes jurídicas tienen API, descarga masiva o solo páginas HTML? Condiciones de uso y robots. | P0 | Revisar cada sitio oficial; registrar en `LEGAL_SOURCES.md` | Corpus semilla pequeño y curado descargado manualmente (Constitución + normas y sentencias elegidas) |
| Q5 | Confirmar IDs/campos SECOP. **CERRADA 2026-10-26:** `jbjy-vk9h` = Contratos Electrónicos (95 cols), `p6dx-8zbt` = Procesos. Sin token funciona; límites exactos sin medir. | P1 | ~~Leer diccionario~~ Hecho vía `/api/views` | Sync host-side a `secop_contratos` (contenedor no alcanza datos.gov.co) |
| Q6 | ¿Se pueden enviar documentos privados de usuarios a Meta Model API? Tier Standard vs Contributor; residencia de datos. | P1 | Leer términos y política de privacidad de Meta | MVP: **no** admitir documentos privados en producción; solo corpus público |
| Q7 | Obligaciones de la Ley 1581 de 2012 para el tratamiento de datos en sentencias y SECOP (datos personales en documentos públicos). | P1 | Consulta con abogado de datos; leer norma y guías de la SIC | Minimizar datos personales, no perfilar personas naturales |
| Q8 | Usuario principal del MVP (estudiante, abogado independiente, contratista). | P1 | Entrevistas rápidas (5) antes del día 3 | Hipótesis: estudiantes y abogados que investigan contratación estatal |
| Q9 | Estado y reglas del hackatón (criterios de jurado, entregables, uso de herramientas Meta). | P1 | Releer bases del hackatón | Asumir demo en vivo + repositorio |
