# ARCHITECTURE_DECISIONS.md

## ADR-001 — No introducir Prisma; persistencia con node-postgres tras puertos

- Contexto: el backend usa `pg` directo con SQL especializado (FTS `lex_spanish`, HNSW `vector_cosine_ops`, `unaccent`, `COPY`-like por lotes). El prompt de refactor presupone Prisma, pero no existe en el repo.
- Alternativas: (a) migrar a Prisma; (b) repositorios con `pg` tras interfaces.
- Decisión: (b). Prisma no aportaría tipado de dominio (igual harían falta mapeadores) y las consultas críticas seguirían siendo `$queryRaw`; la migración añade riesgo (esquema, enums, vectores) sin beneficio para 4 tablas.
- Consecuencias: las secciones "Prisma" del plan se leen como "adaptadores pg"; se documenta en `DATABASE_AND_PRISMA.md` como N/A justificado.

## ADR-003 — Modularización parcial: un módulo ejemplar + puertos en el resto

- Contexto: el plan preveía extraer 4 módulos completos; `corpus` (el de más SQL y reutilización) se extrajo entero y demostró el patrón.
- Decisión: `secop/agent/verify/report` se quedan planos pero con dominio puro extraído, puertos por necesidad del consumidor (`useExisting`) y DTOs propios. Mover carpetas sin mejorar dependencias está prohibido por el propio prompt (restricciones).
- Consecuencias: menos churn, mismo desacople efectivo; la extracción total queda como deuda documentada si un módulo crece.

## ADR-002 — Sin CQRS, buses ni mediadores

- Contexto: casos de uso lineales (buscar, investigar, verificar, informar), un escritor por flujo.
- Decisión: casos de uso como clases/inyectables directos invocados por controladores y CLIs.
- Consecuencias: menos indirección; revisitar si aparecen escrituras concurrentes o proyecciones.
