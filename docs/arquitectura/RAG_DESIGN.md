# RAG_DESIGN — RAG jurídico (documento prioritario)

**Propósito:** definir cómo se ingesta, recupera y cita contenido jurídico sin inventar.

## Pipeline
```mermaid
flowchart TD
  A[Descubrimiento de fuente] --> B[Descarga autorizada]
  B --> C[Extracción y normalización]
  C --> D[Identificación de documento y versión]
  D --> E[Metadatos jurídicos]
  E --> F[Fragmentación estructural]
  F --> G[Índice léxico + vectorial]
  G --> H[Recuperación híbrida + RRF]
  H --> I[Reranking]
  I --> J[Contexto con IDs de fragmento]
  J --> K[Generación con citas por ID]
  K --> L[Verificación de citas]
  L --> M[Respuesta / reintento / "evidencia insuficiente"]
```

## Metadatos por documento
`id`, `titulo`, `emisor`, `tipo` (constitución, ley, decreto, sentencia, concepto, doctrina, opinión), `fecha`, `numero`, `jurisdiccion`, `tema`, `url_original`, `fecha_consulta`, `version`, `hash_contenido`, `estado_procesamiento`, `autoridad` (vinculante / interpretativa / opinión).

## Fragmentación
- Normas: por artículo/parágrafo/numeral, conservando la ruta (`Ley 80/1993 > Art. 24 > num. 1`).
- Sentencias: por secciones (antecedentes, consideraciones, decisión) y párrafos numerados; el ponente solo si la fuente lo indica.
- Cada fragmento: `chunk_id`, `doc_id`, `offset_inicio/fin`, `pagina` si existe, `texto`, `texto_contexto` (encabezados).

## Recuperación
1. Si la consulta contiene identificadores (artículo, número de sentencia), **filtro estructurado primero**.
2. Búsqueda léxica (FTS en español) y vectorial en paralelo; fusión por RRF.
3. Reranking si hay modelo disponible (Q1); si no, solo RRF.
4. Se pasa al LLM un número acotado de fragmentos, cada uno con su `chunk_id`.

## Generación y citas
- El modelo solo puede citar `chunk_id` presentes en el contexto; la salida es JSON con `afirmaciones[] {texto, tipo, chunk_ids[]}`.
- `tipo` ∈ {hecho, norma, interpretacion_judicial, doctrina, opinion}.
- Afirmación sin `chunk_id` → se marca como "sin respaldo" o se elimina.

## Verificación de citas (detalle futuro: CITATION_VERIFICATION.md)
1. Existencia: `chunk_id` existe en la base.
2. Fidelidad: si hay cita textual, debe ser subcadena del fragmento (tras normalizar espacios).
3. Soporte: comprobación NLI/LLM-juez de que el fragmento respalda la afirmación; discrepancias a revisión humana.
4. Referencias externas (número de sentencia, artículo) se resuelven contra metadatos, no contra la memoria del modelo.

## Vigencia
Estados: `texto_original`, `modificado`, `consolidado`, `vigencia_verificada`, `vigencia_desconocida`. **Por defecto `vigencia_desconocida`.** Solo pasa a verificada con una fuente oficial que lo indique, registrada con URL y fecha. Relaciones (modifica, deroga, declara inexequible) se guardan únicamente si la fuente las enuncia.

## Evaluación mínima
Set de 30 preguntas: 10 con respuesta directa, 5 sobre norma derogada o modificada, 5 sin respuesta en el corpus, 5 con documentos contradictorios, 5 de inyección de instrucciones en un fragmento. Métricas: citas válidas (%), fidelidad, recall@k, tasa de abstención correcta, latencia, costo.
