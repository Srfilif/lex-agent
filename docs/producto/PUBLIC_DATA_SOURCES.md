# PUBLIC_DATA_SOURCES — Datos públicos (SECOP y datos abiertos)

**Propósito:** documentar qué se sabe, con qué grado de verificación, sobre las fuentes de contratación pública. Consulta: 2026-10-26. Ver `RESEARCH_REFERENCES.md` (R4–R7).

| Fuente | Responsable | Método de acceso | Verificación | Notas |
|---|---|---|---|---|
| SECOP II – Contratos Electrónicos | Colombia Compra Eficiente (publicado en datos.gov.co) | API Socrata (SoQL), dataset ID `jbjy-vk9h` | **Confirmado 2026-10-26** vía `/api/views` (95 columnas) | Sin clave funciona; token opcional. **Sync host-side** a `secop_contratos` (3000 recientes): el contenedor API no alcanza datos.gov.co (TCP filtrado) |
| SECOP II – Procesos de Contratación | idem | Socrata, ID `p6dx-8zbt` | **Confirmado 2026-10-26** (nombre) | Puede no coincidir con Contratos Electrónicos (R7). No sincronizado en MVP |
| SECOP I (procesos, adiciones, proponentes) y SECOP II adiciones | idem | Conjuntos listados en el manual oficial (R5) | Oficial (existencia); IDs pendientes | Adiciones sirven para la cronología |
| Búsqueda pública SECOP II | CCE | Portal web sin usuario (R6) | Oficial | Documentos y anexos exigen navegación del portal; **no asumir descarga automatizable** (puede requerir JavaScript/captcha, según el repo R4) |
| Otros datos abiertos | Entidades | datos.gov.co | Pendiente | Descubrir caso por caso |

## Estrategia de acceso
1. Consultas con filtros SoQL (`$where`, `$select`, `$limit`, `$order`) ejecutadas por el conector; el agente recibe pocas filas o agregados.
2. Caché por consulta con fecha; siempre mostrar `fecha_consulta` y enlace al registro de origen.
3. No introducir tablas completas en el contexto del LLM; para análisis masivo, sincronizar a PostgreSQL por lotes (post-MVP).

## Limitaciones a declarar en cada informe
Calidad y completitud variables, desfase de actualización, duplicidad o discrepancia entre conjuntos, campos libres inconsistentes (nombres de proveedor, objetos). Datos personales de personas naturales pueden aparecer: tratarlos según Q7.

## Señales de riesgo (diseño del MVP)
Reglas explícitas y configurables, p. ej.: modalidad de contratación directa, adiciones acumuladas sobre un umbral de porcentaje, plazo entre fecha de firma y de inicio, datos faltantes. Cada señal muestra la regla, el umbral, los registros y la advertencia: **indicio para revisar, no prueba de irregularidad**. Los umbrales concretos son decisión pendiente.
