# MVP_SCOPE — Alcance del MVP de 10 días

**Propósito:** fijar qué entra y qué no. **Principio:** un flujo completo y verificable vale más que muchos módulos.

## Usuario y problema (hipótesis, no dato comprobado)
- **Usuario principal provisional:** estudiante de Derecho o abogado que investiga cómo se ha interpretado una norma y qué dicen los contratos públicos relacionados. Validar con 5 entrevistas (Q8).
- **Problema:** buscar norma, jurisprudencia y datos de contratación en sitios separados, sin citas verificables.

## Flujo único a demostrar
Pregunta → plan de investigación del agente → recuperación híbrida en corpus jurídico semilla → consulta de contratos SECOP II vía API de datos abiertos → respuesta con citas → **verificador de citas** → informe Markdown/PDF.

## Dentro del MVP
| Módulo | Alcance MVP |
|---|---|
| A. Asistente | Respuesta con fundamento, citas con fragmento y enlace, nivel de incertidumbre, aviso de vigencia "no verificada" |
| B. Buscador | Híbrido (texto completo + vectorial) con filtros: tipo, año, corporación |
| C. Agente | Bucle con 4 herramientas: `buscar_normas`, `buscar_jurisprudencia`, `consultar_secop`, `verificar_cita` |
| D. SECOP | Consulta por entidad/proveedor/objeto/cuantía; cronología simple; 3 señales explicables configurables |
| G. Informes | Exportar a Markdown (PDF si sobra tiempo) |

## Fuera del MVP (no prometer)
Carga de documentos privados y OCR (E), monitor de novedades (F), multiusuario y cuotas (H), cobertura nacional de jurisprudencia, determinación automática de vigencia, DOCX.

## Corpus semilla (a confirmar en Q4)
Constitución Política + 10–20 normas y 30–60 sentencias seleccionadas de un solo tema (propuesta: contratación estatal, p. ej. Ley 80 de 1993 y Ley 1150 de 2007). Cada documento con URL oficial y fecha de consulta.

## Criterios de aceptación
1. 100 % de las citas de una respuesta resuelven a un fragmento real del corpus (prueba automática).
2. Ante pregunta sin evidencia, el sistema lo dice y no inventa (≥ 4 de 5 casos del set adversarial).
3. Consulta SECOP devuelve registros reales con enlace al origen; ninguna señal se presenta como acusación.
4. Demo completa en ≤ 5 minutos sin intervención manual.
