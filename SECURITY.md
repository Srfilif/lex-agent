# Política de Seguridad — Kelsyx

- **Versión:** v1.0 — 2026-11-18.
- **Operación segura:** ver `docs/operaciones/SECURITY_OPERATIONS.md`.

Este documento cumple el rol de `SECURITY_POLICY.md` y corrige el enlace roto
`README → SECURITY.md`.

## 1. Reporte de vulnerabilidades

Escriba a srfilif@gmail.com, asunto "Vulnerabilidad Kelsyx", con
descripción, pasos de reproducción, impacto estimado y, si es posible,
corrección sugerida. Compromiso: acuse de recibo en 5 días hábiles y
actualización del estado en 30 días. **No** explote la falla más allá de lo
necesario para demostrarla, no acceda a datos ajenos ni los divulgue. El
operador no tomará acciones legales contra investigaciones de buena fe que
respeten estas reglas.

## 2. Controles implementados (verificados en código)

- Contraseñas con hash scrypt; TOTP cifrado (AES-GCM) + códigos de recuperación
  de un solo uso; JWT de corta duración con refresh rotatorio, familia de
  rotación y detección de reúso; cookie `lex_refresh` HttpOnly/SameSite=Lax.
- Rate-limit en registro/login; eventos de seguridad auditados (IP, agente de
  usuario); sesiones revocables individualmente y en conjunto.
- Archivos: solo `.txt`/`.md`, topes de tamaño y conteo, almacenamiento fuera
  del árbol web, hash SHA-256.
- Respaldos Postgres (`scripts/`, `backups/` ignorado por git); secretos solo
  por entorno (`.env` nunca commiteado); CORS restringido en producción.

## 3. Prácticas operativas

Secretos obligatorios en producción (`AUTH_JWT_SECRET`, `TOTP_ENCRYPTION_KEY`,
`BILLING_WEBHOOK_SECRET`), `AUTH_SECURE_COOKIES=true`, `ADMIN_MFA_REQUIRED`;
purga periódica de sesiones y eventos (`npm run purge`); auditorías `npm audit`
en CI; principio de mínimo privilegio en administración.

## 4. Gestión de incidentes

Contención → evaluación de alcance → notificación a titulares afectados sin
dilación indebida → reporte a la SIC cuando afecte datos personales →
corrección y lecciones aprendidas. [PENDIENTE: PLAN ESCRITO DE RESPUESTA CON
ROLES, PLANTILLAS Y CONTACTOS].

## 5. Limitaciones conocidas

[PENDIENTE: VERIFICAR TLS/CDN/HEADERS DEL DESPLIEGUE REAL, ENDURECIMIENTO DEL
HOSTING, MONITOREO 24/7 Y PRUEBAS DE PENETRACIÓN]. La modalidad gratuita no
incluye SLA de disponibilidad.
