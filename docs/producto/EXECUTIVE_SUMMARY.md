# EXECUTIVE_SUMMARY — Kelsyx AI

**Qué es:** herramienta de investigación asistida por IA que une fuentes jurídicas colombianas y datos de contratación pública, y responde con citas verificables. No es un sustituto del criterio profesional.

**Diferenciador buscado (hipótesis):** verificación automática de citas y abstención explícita cuando no hay evidencia. No hay estudio de mercado que lo respalde todavía.

**MVP (10 días):** un flujo completo: pregunta → agente → recuperación híbrida sobre un corpus semilla de contratación estatal → consulta SECOP II → respuesta citada y verificada → informe.

**Decisiones principales (provisionales):** monolito modular con PostgreSQL (FTS + pgvector); `ModelGateway` para cambiar de proveedor; Meta Model API para razonamiento; embeddings por definir (Q1); vigencia normativa "desconocida" por defecto.

**Estado de la investigación:** verificadas en fragmentos oficiales la oferta y precios de Meta Model API y la existencia de conjuntos SECOP; **no verificadas** las fuentes jurídicas oficiales, los IDs de datasets y la legislación de datos personales.

**Riesgos clave:** acceso a fuentes jurídicas, embeddings, saldo de API, calidad de datos SECOP (ver HACKATHON_PLAN y OPEN_QUESTIONS).
