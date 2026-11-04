# ACCOUNT_AND_PREFERENCES.md — perfil, preferencias y privacidad (Fase G)

Módulo `account/` (hoja: importa identity + billing). Rutas disjuntas del
`/account` de identity (`GET me`, `security/*`).

## Endpoints (todos Bearer)

| Método | Ruta | Notas |
|---|---|---|
| PATCH | `/account/me` | solo `display_name` (rol/plan/estado ignorados) |
| GET/PATCH | `/account/preferences` | tema, idioma, zona, notifs, IA |
| POST | `/account/email/request` | password + nueva; verifica la nueva |
| POST | `/account/email/confirm` | token 24h; revoca las demás sesiones |
| GET | `/account/export` | agregado propio (sin hashes ni ajenos) |
| POST | `/account/delete-request` | token 24h al correo (antispam 24h) |
| POST | `/account/delete-confirm` | password + token → borrado |

## Preferencias

Defaults: `system/es/America-Bogota`, notifs seguridad on, IA
`{model:null, detail:normal, markdown}`. `ai.model` se valida contra los
modelos del plan (400 si no permitido): una preferencia jamás concede acceso.
`timezone` con regex IANA ligera; idioma `es|en`.

## Retención y borrado (política explícita)

Borrado = lógico + anonimización en una transacción (verificado):
anonimiza `users` (`deleted_{id}@deleted.local`, `*deleted*`, `deleted`),
borra preferencias/tokens/TOTP/recovery, revoca sesiones, cancela suscripción,
anonimiza `security_events` (filas, 1 año), quita `user_id` de payloads webhook
(Fase F ✓), desvincula investigaciones. Conserva: pagos/uso/suscripciones
(obligación legal, titular anonimizado), sesiones revocadas 90 días.
Exportación: usuario, prefs, sesiones, TOTP, subs+eventos, pagos, uso,
auditoría propia e investigaciones (sin hashes).

## Decisiones

- Cambio a correo existente → 409 (revela existencia a cuenta autenticada;
  estándar documentado).
- Borrado conserva la fila `users` anonimizada (integridad FK de facturación).
