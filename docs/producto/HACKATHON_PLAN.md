# HACKATHON_PLAN — Plan A (10 días) y Plan B (producto)

**Supuestos:** equipo de 2–4 personas (por confirmar), acceso a Meta Model API sujeto a la cuenta (Q2). El saldo promocional es temporal.

## Plan A — Cronograma
| Día | Objetivo | Entregable verificable |
|---|---|---|
| 0 | Verificar acceso, modelos, tool calling y embeddings (Q1–Q3) | Script de humo que lista modelos y ejecuta una llamada con herramienta |
| 1 | Repo, Docker Compose, PostgreSQL+pgvector, esquema base | `docker compose up` levanta DB y API |
| 2 | Ingesta del corpus semilla (descarga, normalización, fragmentación) | N documentos con metadatos y URL |
| 3 | Índices léxico + vectorial, endpoint `/search` | Consulta devuelve fragmentos con score |
| 4 | Conector SECOP (SoQL) con caché y límites | `/secop/contracts` con filtros |
| 5 | Agente con 4 herramientas y trazas | Investigación de 3 pasos registrada |
| 6 | Verificador de citas + formato de respuesta | Prueba: 0 citas inventadas en set de 20 preguntas |
| 7 | Frontend React: chat, panel de fuentes, vista de contratos | Flujo completo en UI |
| 8 | Set de evaluación y métricas; informe Markdown | Reporte de métricas |
| 9 | Pulido, ensayo de demo, plan de contingencia | Demo grabada de respaldo |
| 10 | Presentación | — |

## Plan B — Hoja de ruta (resumen; detalle en ROADMAP.md, pendiente)
Fase 1 (meses 1–3): cobertura jurisprudencial ampliada, vigencia verificada con fuente. Fase 2: documentos privados con aislamiento y OCR. Fase 3: monitor de novedades y cuentas de organización. Cada fase depende de cerrar Q4, Q6 y Q7.

## Riesgos que pueden impedir terminar en 10 días
1. Fuentes jurídicas sin descarga estructurada (mitigación: corpus semilla manual).
2. Sin embeddings en Meta (mitigación: modelo abierto vía interfaz).
3. Saldo de API agotado o límites de tasa (mitigación: caché, modelo económico, contributor solo para datos públicos).
4. Calidad irregular de datos SECOP (mitigación: mostrar siempre el enlace al origen y las limitaciones).
5. Tiempo del verificador de citas (mitigación: priorizarlo sobre el frontend).

## No prometer en la demo
Vigencia garantizada, cobertura completa de jurisprudencia, detección de corrupción, tiempo real, asesoría jurídica automática.
