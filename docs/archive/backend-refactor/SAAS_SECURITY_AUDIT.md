# SAAS_SECURITY_AUDIT.md — LexAgent: identidad, sesiones y SaaS (Fase A)

Fecha: 2026-10-26. Alcance: solo `apps/api` + docs backend. Frontend intacto.

## 1. Estado real verificado

- Backend NestJS en `apps/api/src`: `app.module.ts` (raíz), `main.ts` (CORS abierto,
  `ValidationPipe` global, `HttpExceptionFilter`), `SharedModule` global (`Db`, `ModelGateway`).
- Módulos: `modules/corpus` (hexagonal ejemplar) + `agent`, `secop`, `verify`, `report`
  planos con puertos `useExisting`. Sin dependencias circulares ni `forwardRef`.
- DB viva (`lexagent-db-1`): **4 tablas, 0 de identidad** — `documents`, `chunks`
  (1407), `secop_contratos`, `investigaciones`. Sin `users`, sesiones ni roles.
- Migraciones: convención manual (`db/migrations/00N_*.sql` + espejo en `db/init.sql`),
  **sin runner** (se aplican por `psql`). 002–004 ya aplicadas en la DB viva.
- Línea base verde: `typecheck` ✅, `test:unit` ✅, `test` (regresión DB) ✅,
  goldens `scripts/contract_check.py` ✅. 4/4 contenedores arriba.
- Medición de tokens: existe y es correcta (`shared/pricing.ts` + `usage`/`costo_usd`
  en `investigaciones` + `ModelGateway.totals` en memoria). **No hay atribución
  por usuario** (sin columna ni concepto de usuario).
- Dependencias: cero librerías cripto/auth/JWT/e-mail. Solo `node:crypto` disponible
  vía stdlib. Alpine en `apps/api/Dockerfile` (módulos nativos = riesgo de build).
- Secretos: solo `META_API_KEY` (+ opcionales). Sin secretos de firma/cifrado.
  `.env` ignorado; `keyConfigured: bool` en `/health`-style status (no filtra).

## 2. Hallazgos (severidad)

| # | Severidad | Hallazgo | Evidencia |
|---|-----------|----------|-----------|
| S1 | **Crítica** | Sin autenticación ni autorización: toda la API pública | `main.ts` sin guards; 0 tablas identidad |
| S2 | **Crítica** | `POST /agent/investigate` = gasto LLM sin autenticar ni rate-limit (DoS de bolsillo) | `agent.controller.ts`, `SECURITY_REVIEW.md` |
| S3 | Alta | Sin sesiones revocables ni auditoría de accesos | no existe `auth_sessions`/`security_events` |
| S4 | Alta | CORS abierto (`enableCors()` sin origen) | `main.ts:10` — aceptable solo en local |
| S5 | Alta | Sin runner de migraciones: deriva entre `init.sql`, `00N` y DBs vivas | §1; riesgo de aplicar 2 veces / olvidar |
| S6 | Media | Juez LLM = mismo modelo que investiga (sesgo de autoevaluación) | `CITATION_VERIFICATION.md`, preexistente |
| S7 | Media | Contadores de uso en memoria (`ModelGateway.totals`) — se pierden al reiniciar | `model-gateway.ts:62` |
| S8 | Baja | `Db.raw` aún expuesto fuera de repositorios (`agent`, `verify`, `secop`) | `SECURITY_REVIEW.md` H12, en retirada |

S1–S4 son **bloqueantes antes de exponer**; en local monousuario son riesgo aceptado
(hackatón). Ninguna vulnerabilidad explotable desde fuera en el despliegue actual
(localhost), por lo que no hay mitigación de emergencia previa a Fase B.

## 3. Decisiones de arquitectura objetivo (resumen)

- **D1. Cero dependencias nuevas.** Cripto con `node:crypto`: `scrypt` (passwords),
  HMAC-SHA256 (JWT HS256 enrollado a mano, ~60 líneas, algoritmo fijado),
  AES-256-GCM (secretos TOTP, Fase C), `randomBytes`/`randomUUID` (tokens).
  Motivo: Alpine sin toolchain (argon2/bcrypt nativos romperían el build);
  superficie auditable mínima; sin supply-chain nueva. `scrypt` N=2¹⁵,r=8,p=1.
- **D2. Sesiones opacas + access JWT corto.** Access 15 min (stateless, revocable
  vía `sid` contra `auth_sessions`), refresh opaco rotatorio con familia +
  detección de reutilización. Refresh en cookie `HttpOnly` (`SameSite=Lax`,
  `Secure` configurable) **y** en cuerpo JSON (clientes no-web).
- **D3. Compatibilidad aditiva.** Endpoints existentes (`/health`, `/search`,
  `/secop/*`, `/agent/*`, `/report/*`) **siguen públicos sin cambios** (el frontend
  los consume sin auth). Todo lo nuevo (`/auth/*`, `/account/*`, `/billing/*`)
  es aditivo. Detalle: `API_COMPATIBILITY_SAAS.md` (Fase B).
- **D4. Sin Prisma** (hereda ADR-001): SQL parametrizado tras puertos.
- **D5. Runner de migraciones mínimo** (`npm run migrate`, idempotente, tabla
  `schema_migrations`, baseline documentado: ≤004 manual, ≥005 por runner).
- **D6. E-mail desacoplado**: puerto `EmailSender` + adaptador log en local;
  SMTP real queda como adaptador futuro (sin credenciales inventadas).
- **D7. Rate-limit en memoria** (bucket por clave) + documento de migración a
  Redis para multirréplica. Suficiente para despliegue unitario actual.
- **D8. Wompi/sandbox**: solo puerto + adaptador sandbox + máquina de estados
  probada; sin credenciales → "pendiente de validación real" (Fase F).

## 4. Tablas existentes: preservar

`documents`, `chunks` (incl. `lex_spanish`, HNSW 1024), `secop_contratos`,
`investigaciones`. Cambios permitidos solo **aditivos y nulables**:
`investigaciones.user_id` (Fase E, atribución opcional). Nada más.

## 5. Endpoints afectados

Ningún endpoint existente cambia de forma o auth (D3). Nuevos: `/auth/*`,
`/account/*` (Fase B–C, G), `/billing/*` (Fase E–F), `/admin/*` mínimo (Fase D).

## 6. Plan por fases (detalle: `IMPLEMENTATION_ROADMAP_SAAS.md`)

A ✅ auditoría → B identidad+sesiones → C TOTP → D RBAC → E planes/entitlements+
metering → F suscripciones/pagos-sandbox → G perfil/preferencias → H validación.
Regla: no avanzar de fase con la suite en rojo ni goldens rotos.
