# RESEARCH_REFERENCES — Registro de fuentes consultadas

**Propósito:** registrar cada fuente externa usada, con fecha de consulta y grado de verificación. **Fecha de consulta de todas las entradas:** 2026-10-26.

**Escala de verificación:** `Verificado-oficial` (página del responsable, leída) · `Secundaria` (tercero; sirve de pista, no de prueba) · `Pendiente` (no consultada o no accesible).

| # | Tema | URL | Tipo | Verificación | Qué se extrajo |
|---|------|-----|------|--------------|----------------|
| R1 | Meta Model API: visión general y precios | https://developer.meta.com/ai/products/meta-model-api/ | Oficial Meta | Verificado-oficial (fragmento de búsqueda; releer en vivo antes de decidir) | Acceso a Muse Spark; ventana de 1M tokens; compatibilidad con SDK de OpenAI; *web search grounding*; modelos `muse-spark-1.3` y `muse-spark-1.3-contributor` con precios por millón de tokens |
| R2 | Meta Model API: modelos y tiers | https://ai.developer.meta.com/docs/models/ | Oficial Meta | Verificado-oficial (fragmento) | Tier *Standard* (sin entrenamiento con tus datos) vs *Contributor* (descuento a cambio de usar prompts y respuestas para entrenar) |
| R3 | Base URL y autenticación de Model API | https://www.orcarouter.ai/blog/muse-api | Secundaria (agregador) | Secundaria | `https://api.meta.ai/v1`, cabecera `Authorization: Bearer`. Contrastar con docs de Meta |
| R4 | Datasets SECOP II en datos.gov.co (Socrata) | https://github.com/amgallego8/SECOP-MCP | Secundaria (repo de terceros) | Secundaria | IDs `jbjy-vk9h` (Contratos Electrónicos) y `p6dx-8zbt` (Procesos). **Confirmar en datos.gov.co** |
| R5 | Manual de datos abiertos del SECOP | https://colombiacompra.gov.co/wp-content/uploads/2024/09/manual_de_datos_abiertos_actualizado.pdf | Oficial CCE | Verificado-oficial (fragmento) | Lista de conjuntos: SECOP I procesos, SECOP II contratos, SECOP II procesos, adiciones, proponentes |
| R6 | Búsqueda pública SECOP II sin usuario | https://www.colombiacompra.gov.co/?p=2207 | Oficial CCE | Verificado-oficial (fragmento) | Cualquier persona puede buscar procesos y PAA sin cuenta |
| R7 | Informe Cámara de Comercio de Medellín (calidad de datos SECOP) | https://www.camaramedellin.com.co/Portals/0/Documentos/Informe_1_hasta_2022.pdf | Secundaria | Secundaria | Advierte que SECOP II CE y PC no siempre coinciden y que la calidad de los datos varía |

## Fuentes que NO se pudieron consultar (pendientes)
- Gestor Normativo de Función Pública, Corte Constitucional (relatoría), Rama Judicial, Consejo de Estado, Corte Suprema, Senado (leyes), Diario Oficial/Imprenta Nacional: **no consultadas en esta sesión**. Ver `LEGAL_SOURCES.md` (pendiente) y `OPEN_QUESTIONS.md`.
- Documentación técnica de Meta Model API (endpoints de embeddings, tool calling, límites de tasa): **no leída completa**.
- Texto vigente de la Ley 1581 de 2012 y reglamentos: **no consultado**.
