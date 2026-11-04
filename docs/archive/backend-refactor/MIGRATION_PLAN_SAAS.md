# MIGRATION_PLAN_SAAS.md — migraciones 005–009 (Fase H)

Runner: `npm run migrate` (idempotente, `schema_migrations`, baseline ≤004
manual). Re-ejecutado en H: todo `skip`, DB verde. Frescas: `init.sql` espeja
las 20 tablas (verificado por diff de nombres).

| Mig | Contenido | Reversible | Riesgo |
|---|---|---|---|
| 005 | identity: users, tokens, sessions, events | DROP tables | bajo |
| 006 | totp_configs, recovery_codes | DROP tables | bajo |
| 007 | billing + `investigaciones.user_id` nulable + seed | DROP + DROP COLUMN | bajo |
| 008 | payments, webhooks, sub_events + precios | DROP + DROP COLUMNs | bajo |
| 009 | preferences, deletion_requested_at, kinds+new_email | DROP + DROP COLUMN, re-CHECK | bajo |

Todas aditivas, `IF NOT EXISTS`, sin renombrados ni borrado de datos.
Tablas legacy (`documents`, `chunks` 1407, `secop_contratos`, 50
investigaciones) intactas y verificadas tras cada fase.
Despliegue: `migrate` antes de arrancar API (las columnas nulables permiten
deploy sin downtime). Rollback: re-deploy versión anterior + DROPs manuales
(documentar ventana; sin down-migrations automáticas por seguridad).
