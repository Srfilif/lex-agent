# IMPLEMENTATION_ROADMAP_SAAS.md — fases B–H (trabajo real por fase)

Convenciones heredadas: `tsc --noEmit`, `npm test` (regresión DB),
`npm run test:unit` (asserts sin framework), goldens `scripts/contract_check.py`,
español, sin `any`, sin `forwardRef`.

## Fase B — Identidad y sesiones (en curso)

Migración `005_identity.sql`: `schema_migrations`, `users`, `one_time_tokens`,
`auth_sessions`, `security_events` (+ espejo en `db/init.sql`).

- `shared/config`: sección `auth` (secretos, TTLs, límites, cookies).
- `modules/identity/`: dominio (`Email`/`Password`/`DisplayName`, `User`,
  `AuthSession`, puertos repo), aplicación (11 casos de uso), infraestructura
  (`scrypt`, JWT HS256, tokens, rate-limit memoria, 4 repos pg, e-mail log),
  presentación (`AuthController`, `AccountController`, `AuthGuard`, DTOs, cookies).
- Runner `src/migrations/run.ts` (`npm run migrate`) + `make-admin.ts`.
- `GET /account/me`, `POST /auth/*`, `GET/DELETE /auth/sessions`.
- Pruebas: unitarias dominio+cripto, regresión DB (tablas), humo HTTP
  (registro→login→me→refresh→rotación→reutilización→logout), goldens viejos.

## Fase C — TOTP y seguridad avanzada

Migración `006_totp.sql`: `totp_configs`, `recovery_codes` (hash).
Docs: `TOTP_AND_RECOVERY.md`. Casos: setup/confirm/verify/disable/regenerar;
login en 2 pasos (pre-token `mfa_pending` 5 min, no reutilizable como sesión);
AES-256-GCM con `TOTP_ENCRYPTION_KEY` externa; ventana ±1 paso, anti-replay por
`last_counter`; rate-limit 10/5min; eventos auditoría; unitarias (RFC 6238
vectores, cifrado roundtrip) + humo con `otpauth://`.

## Fase D — Autorización

Docs: `AUTHORIZATION_AND_RBAC.md`. Roles `user|admin` (columna existente en B),
`RolesGuard` + `@Roles`, `RequireVerifiedGuard` opcional por endpoint,
endpoints admin mínimos (`GET /admin/users`, `PATCH /admin/users/:id/status`),
pruebas de aislamiento (401/403/200) y de escalado (rol por body ignorado).

## Fase E — Planes, entitlements y metering

Migración `007_billing.sql`: `plans`, `plan_entitlements`, `subscriptions`,
`usage_events`, `usage_periods` (+ `investigaciones.user_id` nulable).
Docs: `BILLING_ARCHITECTURE.md`, `PLANS_AND_ENTITLEMENTS.md`, `USAGE_METERING.md`.
Catálogo seed (free/plus/pro, límites como datos), `CheckEntitlement`,
`ConsumeUsage` atómico (`INSERT … ON CONFLICT` + chequeo), atribución agente→usuario
cuando hay Bearer (anónimo = legacy, documentado), `GET /billing/*` lectura.

## Fase F — Suscripciones y pagos (sandbox)

Migración `008_payments.sql`: `subscription_events`, `payments`, `webhook_events`.
Docs: `PAYMENT_INTEGRATION.md`. Puerto `PaymentProvider` + `SandboxAdapter`
(firma HMAC-SHA256 propia documentada, **no** real de Wompi), máquina de estados
explícita con transiciones inválidas rechazadas, idempotencia por
`provider_event_id`, checkout sandbox de punta a punta en pruebas.
Estado final: pendiente de credenciales/validación real (explícito).

## Fase G — Perfil y preferencias

Migración `009_account.sql`: `user_preferences`, `consents` (si aplica).
Docs: `ACCOUNT_AND_PREFERENCES.md`. `PATCH /account/me` (whitelist estricta),
`GET/PATCH /account/preferences` (tema/idioma/zona/AI), exportar datos
(`GET /account/export`), borrado (`POST /account/delete-request` + política),
cambio de e-mail con re-verificación. Pruebas de whitelist y de borrado lógico.

## Fase H — Validación final

`TESTING_STRATEGY_SAAS.md`, `SECURITY_THREAT_MODEL.md`, `SECURITY_OPERATIONS.md`,
`MIGRATION_PLAN_SAAS.md`, `SAAS_PROGRESS.md` al día; batería completa
(typecheck+test+test:unit+goldens+humo auth), revisión `npm audit` (solo lectura),
informe final §23 (5 estados).
