# SECURITY_THREAT_MODEL.md — modelo de amenazas (Fase H)

Activos: cuentas/sesiones, secretos TOTP, cuotas pagadas, integridad de
facturación, corpus/investigaciones. Atacante: red local/Internet (si se
expone), usuario malicioso autenticado, proveedor comprometido (webhooks).

| Amenaza | Mitigación implementada | Residual |
|---|---|---|
| Fuerza bruta login/TOTP/recovery | rate-limit + scrypt + ventana ±1 + anti-replay | 1 réplica (Redis futuro) |
| Enumeración cuentas | mensajes uniformes + hash dummy | 409 en cambio-email authed (documentado) |
| Robo refresh | HttpOnly+Lax, rotación, reúso→revoca familia | XSS mitigado, no eliminado |
| Reutilización TOTP/recovery | `last_counter`, un-uso atómico | — |
| Filtración secretos | AES-GCM clave externa, sha256 opacos, sin logs | dev defaults + warn |
| Escalado rol/plan | whitelist DTOs, servidor decide | — |
| Gasto LLM ajeno | cuotas atómicas autenticadas | **anónimo ilimitado** (decisión demo) |
| Webhook forjado | HMAC cuerpo crudo, 401 | secreto dev en local |
| Doble cobro/cargo | idempotencia + tx + mismatch→failed | — |
| CSRF refresh | SameSite=Lax | — |
| DoS bolsillo investigate | 429 pre-vuelo authed | anónimo expuesto |
| Deps vulnerables | `npm audit` 0 (override multer) | re-auditar al actualizar |

Fuera de alcance actual: WAF, IDS, 2FA admin obligatoria, hardware keys,
auditoría externa. Antes de exponer: §SECURITY_OPERATIONS (checklist).
