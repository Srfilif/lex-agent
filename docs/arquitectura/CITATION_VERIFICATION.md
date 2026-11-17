# CITATION_VERIFICATION — verificador formal (Día 6)

Implementación: [`verify-investigation.ts`](../../apps/api/src/modules/research/application/verify-investigation.ts). Informe: `GET /report/:id` (caso de uso en [`build-report.ts`](../../apps/api/src/modules/research/application/build-report.ts)).

## Niveles por afirmación

| Veredicto | Significado |
|---|---|
| `verificada` | chunk_ids existen en DB y el juez confirma soporte (o secop_refs existen) |
| `parcial` | el fragmento apoya solo parte de la afirmación |
| `no_verificada` | existe la cita pero el juez no ve soporte → **revisión humana** |
| `sin_respaldo` | sin citas (esperable en abstenciones explícitas) |
| `cita_inventada` | chunk_id inexistente → **fallo crítico, debe ser 0** |

## Cómo funciona

1. **Existencia:** cada `chunk_id` contra `chunks`, cada `secop_ref` contra `secop_contratos.id_contrato`.
2. **Soporte:** un juez LLM (muse-spark-1.3) en una sola llamada por lote recibe cada afirmación + sus fragmentos (≤1500 car.) y devuelve `si|parcial|no` + motivo.
3. **Fidelidad textual:** no aplica aún — el formato de afirmación es paráfrasis, no cita textual (ver RAG_DESIGN §fidelidad cuando haya comillas).

## Resultados 2026-10-26 (5 investigaciones, 12 afirmaciones)

- **0 citas inventadas.** Art. 24 → 4 verificadas + 1 sin respaldo; SECOP software → 1 + 1; homicidio → 1 (Art. 11 CP, legítima) + abstención; Juan Pérez → abstención; Art. 999 → 2 `no_verificada` (inferencia válida "la ley termina en Art. 81" marcada estricta: fail-closed, a calibrar día 8).
- Abstención correcta en los 3 casos adversariales: nada inventado.

## Limitaciones

- El juez es el mismo modelo que investiga (sesgo posible); día 8: medir acuerdo juez-humano en el set de 30.
- Sin NLI dedicado; sin comprobación de vigencia.
