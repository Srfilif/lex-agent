# SAAS_PROGRESS.md — avance SaaS por fases

## 2026-10-26 — Fase A auditoría ✅

- `SAAS_SECURITY_AUDIT.md` (S1–S8, D1–D8), `IMPLEMENTATION_ROADMAP_SAAS.md`,
  `DATABASE_SCHEMA_SAAS.md`. Línea base verde; 0 tablas identidad (verificado).

## 2026-10-26 — Fase B identidad + sesiones ✅

- Migración `005_identity.sql` + espejo `init.sql` + runner `npm run migrate`
  + `npm run make:admin`. Tablas: `schema_migrations`, `users`,
  `one_time_tokens`, `auth_sessions`, `security_events`.
- Módulo `identity/` (27 ficheros): dominio puro, 13 casos de uso, cripto
  `node:crypto` cero-deps (scrypt/JWT-HS256/tokens/rate-limit), 4 repos pg,
  e-mail log, 13 endpoints, `AuthGuard` con DB-check.
- Config `auth` validada (secretos/TTLs/límites/cookies) + `.env.example`.
- Pruebas: `typecheck` ✅, `test:unit` 55 asserts ✅, `test` 8/8 ✅,
  goldens viejos intactos ✅, humo HTTP (registro→login→me→refresh→reúso→
  familia revocada→verify→forgot/reset→change→logout-all) ✅, cookie ✅,
  rate-limit 429 ✅, greps reglas 1/2/7 ✅. Usuario QA eliminado.
- Docs: `IDENTITY_ARCHITECTURE.md`, `AUTHENTICATION_AND_SESSIONS.md`,
  `API_COMPATIBILITY_SAAS.md`.

## 2026-10-26 — Fase C TOTP ✅

- Migración `006_totp.sql`: `totp_configs`, `recovery_codes`. Config `totp`
  validada (clave AES externa, ventana, TTL MFA).
- Dominio `TotpConfig` (pending/active + anti-replay) + 6 casos de uso;
  `IssueSession` extraído (login directo y MFA comparten emisión).
- Login en 2 fases: `mfa_required` + pre-token 5 min (no sirve como sesión);
  `POST /auth/mfa/verify` acepta TOTP o recovery.
- Pruebas: `typecheck` ✅, `test:unit` 80 asserts (vectores RFC 6238) ✅,
  `test` 9/9 ✅, `scripts/smoke_totp.mjs` 18/18 ✅, goldens intactos ✅,
  sin secretos en logs ✅. Usuarios humo eliminados.
- Ajustes del humo: TOTP erróneo 6 dígitos → 401 (no 400); anti-replay
  estricto cross-operación documentado.
- Docs: `TOTP_AND_RECOVERY.md`.

## 2026-10-26 — Fase D RBAC ✅

- `RolesGuard` + `@Roles('admin')`, 4 casos de uso admin, `AdminController`
  (`GET /admin/users`, `PATCH :id/status|role`, `POST :id/totp/reset`).
- Dominio: `User.enable/setRole`; repo: `list/count` con LIKE escapado.
- Pruebas: `typecheck` ✅, `test:unit` 86 asserts ✅, humo (401/403/200,
  bloqueo→403, self-400, escalado-por-body ignorado) ✅. Usuarios humo fuera.
- Docs: `AUTHORIZATION_AND_RBAC.md`.

## 2026-10-26 — Fase E planes/entitlements/metering ✅

- Migración `007_billing.sql`: `plans`, `plan_entitlements`, `subscriptions`,
  `usage_events`, `usage_periods`, `investigaciones.user_id` + seed free/plus/pro.
- Módulo `billing/` (13 ficheros): plan efectivo, 4 lecturas, `BillingForAgent`
  (reserva+registro), `AdminGrantPlan`; 5 endpoints + grant admin.
- Atribución: `OptionalAuthGuard` en investigate/report; anónimo legacy intacto.
- Pruebas: `typecheck` ✅, `test:unit` 95 asserts ✅, `test` 12/12 ✅,
  humo (grant, 429 con $0, 1 investigación real $0.03 atribuida, rollback e
  idempotencia verificados) ✅, goldens intactos ✅. Usuarios humo fuera.
- Incidencias: DI `ACCESS_TOKENS`/`SECURITY_EVENT_REPOSITORY` no exportados
  (arranque caído, corregido exportando); curl 000 = quirk cliente (API OK).
- Docs: `BILLING_ARCHITECTURE.md`, `PLANS_AND_ENTITLEMENTS.md`, `USAGE_METERING.md`.

## 2026-10-26 — Fase F suscripciones/pagos-sandbox ✅

- Migración `008_payments.sql`: `payments`, `webhook_events`,
  `subscription_events`, precios sandbox en `plans`. Config `billing` validada
  (solo sandbox, secreto webhook).
- Puerto `PaymentProvider` + `SandboxPaymentProvider` (HMAC propio) + simulador;
  `HandleWebhook` (firma→idempotencia→máquina); checkout/cancel/resume/
  change-plan; pagos e historial. 9 endpoints/familias nuevos.
- Pruebas: `typecheck` ✅, `test:unit` 113 asserts ✅, `test` 14/14 ✅,
  `scripts/smoke_billing.mjs` 19/19 ✅, goldens intactos ✅, payloads sin
  tarjeta ✅. Usuarios humo fuera.
- Incidencias: rutas relativas (3 rondas), bloque pg corrupto por expansión
  `$` de PowerShell (truncado y reescrito con edit_file), GET-con-body en humo.
- Docs: `PAYMENT_INTEGRATION.md` (Wompi pendiente explícito).
- Deuda: anononimizar webhooks al borrar cuenta (G), job expiración (H).

## 2026-10-26 — Fase G perfil/preferencias/privacidad ✅

- Migración `009_account.sql`: `user_preferences`, `deletion_requested_at`,
  kinds `email_change`/`account_delete` + `new_email`.
- Módulo `account/` (10 ficheros): perfil whitelist, prefs validadas vs plan,
  cambio de correo verificado, export, borrado 2 pasos anonimizado.
- Pruebas: `typecheck` ✅, `test:unit` 123 asserts ✅, `test` 16/16 ✅,
  `scripts/smoke_account.mjs` 11/11 ✅, humo correo+borrado (DB verificada) ✅,
  goldens intactos ✅.
- Incidencia: `PgUserRepository.update` no persistía `email` (humo lo cazó).
- Docs: `ACCOUNT_AND_PREFERENCES.md`. Fila anónima de prueba conservada (diseño).

## 2026-10-26 — Fase H validación final ✅

- Expiración lazy en resolver (deuda F cerrada, verificada con sub vencida).
- `npm audit` 0 vulns (override multer 2.5.0; rebuild + batería re-verde).
- Migraciones: rerun idempotente, init.sql cubre 20/20 tablas.
- Frontend: 0 ficheros tocados (fuentes previas a sesión + registro de ediciones).
- Reglas 1/2/7 limpias (1 violación regla 2 cazada y corregida: puerto
  `SandboxEventBuilder`).
- Batería: typecheck ✅, 126 asserts ✅, 16/16 DB ✅, goldens ✅,
  smokes totp/billing/account ✅. DB: 50 investigaciones, 0 usuarios activos.
- Docs: `TESTING_STRATEGY_SAAS.md`, `SECURITY_THREAT_MODEL.md`,
  `SECURITY_OPERATIONS.md`, `MIGRATION_PLAN_SAAS.md`.

## Estado final SaaS (A–H completas)

Ver informe §23 en el mensaje de cierre. Riesgos aceptados: anónimo ilimitado
en investigate (demo), CORS abierto, rate-limit 1 réplica, SMTP log,
Wompi pendiente de credenciales. Bloqueantes prod en SECURITY_OPERATIONS.
