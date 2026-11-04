# SECURITY_OPERATIONS.md — operación segura (Fase H)

## Secretos (nunca en código/logs/docs)

`META_API_KEY`, `AUTH_JWT_SECRET` (≥32), `TOTP_ENCRYPTION_KEY` (64 hex),
`BILLING_WEBHOOK_SECRET`, `DB_PASSWORD`. Solo `.env` local (ignorado) o
gestor/KMS en despliegue. Rotación: JWT (invalidar sesiones: logout-all
masivo), TOTP (re-cifrar `secret_enc` con `v2`), webhooks (rotar en proveedor
+ config). Compromiso: rotar + revocar + auditar `security_events`.

## Checklist pre-exposición (bloqueante)

Estado 2026-10-27 (I1/I2 implementado; verificado en local):

1. ✅ Secretos prod exigidos: `NODE_ENV=production` falla rápido sin
   `AUTH_JWT_SECRET`/`TOTP_ENCRYPTION_KEY`/`BILLING_WEBHOOK_SECRET`/`SMTP_URL`
   (probado: el boot aborta con el mensaje exacto).
2. ✅ `AUTH_SECURE_COOKIES=true` exigido en prod + CORS por `CORS_ORIGINS`
   (prod exige https; vacío = mismo origen).
3. ✅ `/agent/investigate` anónimo bloqueado en prod por defecto
   (`ALLOW_ANON_INVESTIGATE`, default false en producción).
4. ✅ Rate-limit Redis (`REDIS_URL`, Lua atómico, fail-open avisado);
   memoria solo si se omite (1 réplica). Probado en vivo: 5×201→429.
5. ✅ `SmtpEmailSender` (nodemailer) con `SMTP_URL`/`SMTP_FROM`; prod lo
   exige. Composición probada sin red (streamTransport). Falta credencial
   SMTP real del proveedor elegido.
6. ✅ `scripts/backup_db.mjs` + `scripts/restore_db.mjs` (custom format,
   restore a BD temporal con verificación). Probado: 8.2 MB, restore íntegro.
   Pendiente: cifrado del dump en reposo + programación (cron) fuera del repo.
7. ✅ Purga `npm run purge` (sesiones muertas >90d, `security_events` >1año;
   probado: 0 filas). Programarla por cron semanal fuera del repo.
8. ✅ `npm audit` 0 vulns (2026-10-27); goldens + humos verdes; CI
   (`.github/workflows/ci.yml`) con typecheck/unit/build; staging con
   `docker-compose.staging.yml` (prod-like, secretos por entorno).
9. ✅ 2FA obligatoria para `admin`: `auth_sessions.mfa_ok` (mig 017) +
   claim `mfa` + `RolesGuard` con `ADMIN_MFA_REQUIRED` (default true en
   prod, error `mfa_requerido`). Probado en unitarias.

## Probes y logs

- Liveness `GET /health` (siempre 200, `degraded` si DB cae), readiness
  `GET /ready` (200 `ready` / 503 `not_ready`; exige DB + migraciones).
- `NODE_ENV=production` activa `JsonLogger` (una línea JSON por evento,
  errores a stderr). Métricas/trazas distribuidas: pendientes (I1 resto).

## Respuesta a incidentes

Reúso refresh → familia revocada + `refresh_reuso` (investigar). Firma webhook
401 masiva → rotar secreto + revisar. `past_due` → dunning manual (sin job).
Borrado: verificar anonimización (§G). Logs: sin secretos por construcción.
