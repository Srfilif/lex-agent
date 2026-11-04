# PLANS_AND_ENTITLEMENTS.md — catálogo y derechos (Fase E)

## Catálogo semilla (migración 007, activo y versionado)

| Plan | investigaciones/mes | tokens/mes | max_pasos | modelos |
|---|---|---|---|---|
| free | 20 | 200 000 | 6 | muse-spark-1.3 |
| plus | 200 | 2 000 000 | 8 | muse-spark-1.3 |
| pro | 2 000 | 20 000 000 | 10 | muse-spark-1.3 |

## Endpoints

- `GET /billing/plans` (público): catálogo con límites.
- `GET /billing/subscription` (Bearer): plan efectivo, estado, fin de periodo.
- `GET /billing/usage` (Bearer): uso del mes, límites, restantes, `reset_at`.
- `GET /billing/entitlements` (Bearer): `puede_investigar`, `max_pasos`,
  modelos, restantes.
- `POST /admin/billing/grant` (admin): `{user_id, plan, days}` → suscripción
  activa auditada (`billing_grant`).

## Semántica

- Plan efectivo = suscripción viva (`trialing/active/past_due`) que cubra hoy;
  si no, `free` con `status:'free'`.
- `max_pasos` del plan pinza el `max_pasos` pedido (clamp silencioso, como el
  1–10 existente). `modelos` se expone; con un solo modelo no filtra (Fase H+).
- Cancelar renovación (`cancel_at_period_end`, Fase F) ≠ fin inmediato:
  `covers()` mantiene acceso hasta el periodo.
