# BILLING_ARCHITECTURE.md — módulo billing (Fase E, código real)

Ubicación: `apps/api/src/modules/billing/`. Hexagonal como `corpus`/`identity`.
Importa `identity` (usuarios, tokens, guards); expone `BillingForAgent` y
`EffectivePlanResolver` al agente/verificador. Sin dependencias nuevas.

```text
billing/
├── domain/plan.ts             # Plan + Entitlements (datos, no condicionales)
├── domain/subscription.ts     # máquina mínima: viva/cancelada/expirada
├── domain/usage.ts            # eventos, periodos YYYY-MM, resets
├── domain/repositories.ts     # PLAN/SUBSCRIPTION/USAGE_REPOSITORY
├── application/
│   ├── effective-plan.ts      # suscripción viva que cubra hoy, o free
│   ├── reads.ts               # GetPlans/SubscriptionStatus/Usage/Entitlements
│   ├── billing-for-agent.ts   # reserva pre-vuelo + registro post-vuelo
│   └── admin-grant.ts         # concesión manual auditada
├── infrastructure/persistence/pg-billing.repositories.ts
└── presentation/http/         # BillingController, AdminBillingController
```

## Decisiones

- **Límites como datos** (`plan_entitlements`): agregar un plan o cambiar un
  límite es un `INSERT`, no código.
- **Atribución opcional**: `investigaciones.user_id` nulable;
  `OptionalAuthGuard` en `/agent/investigate` y `/report/:id`.
  Anónimo = legacy ilimitado (documentado, ver S2 residual); autenticado =
  compuerta dura 429 + medición.
- **Reserva pre-vuelo + registro post-vuelo**: la cuenta de investigaciones se
  descuenta atómicamente antes del gasto LLM (falla rápido, $0); los tokens
  reales se registran después (idempotentes por `inv:{id}:tokens`).
- **Una viva por usuario** (índice parcial único); `grant` cancela la anterior
  en la misma transacción.
- La Fase F añade checkout/webhooks/pagos sobre `subscriptions` sin cambiar
  este modelo (solo transiciones y columnas de proveedor).
