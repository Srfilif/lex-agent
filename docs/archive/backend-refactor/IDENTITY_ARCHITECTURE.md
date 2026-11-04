# IDENTITY_ARCHITECTURE.md — módulo identity (Fase B, código real)

Ubicación: `apps/api/src/modules/identity/`. Patrón: mismo hexagonal que
`corpus` (dominio puro → aplicación → infraestructura → presentación).

```text
identity/
├── domain/            # puro: sin Nest/SQL/HTTP/cripto (verificado por grep)
│   ├── errors.ts      # DomainError(code, message)
│   ├── value-objects.ts # parseEmail / parsePassword / parseDisplayName
│   ├── user.ts        # User: estado, verifyEmail, disable, markDeleted
│   ├── session.ts     # AuthSession: active/expiry, touch, revoke, rotate
│   └── repositories.ts# USER/SESSION/ONE_TIME_TOKEN/SECURITY_EVENT_REPOSITORY
├── application/       # casos de uso @Injectable + puertos + AuthError(status)
│   ├── errors.ts ports.ts profile.ts
│   ├── register-login.ts  # RegisterUser, LoginUser
│   ├── sessions.ts        # RefreshSession, Logout, LogoutAll, ListSessions, RevokeSession
│   └── email-password.ts  # VerifyEmail, ResendVerification, RequestPasswordReset,
│                          # ResetPassword, ChangePassword
├── infrastructure/    # adaptadores node:crypto (cero deps) + pg
│   ├── crypto/        # scrypt, HS256 JWT, tokens/sha256, rate-limit memoria
│   ├── email/log-email.sender.ts
│   └── persistence/pg-identity.repositories.ts
└── presentation/http/ # AuthController, AccountController, AuthGuard,
                       # CurrentUser, AuthErrorFilter, dto.ts, cookies.ts
```

## Decisiones

- **Sin dependencias nuevas** (D1): `node:crypto` para todo (scrypt N=2¹⁵,
  HS256 enrollado con alg fijado, AES-GCM en Fase C). Motivo: build Alpine sin
  toolchain + superficie auditable.
- **Access JWT 15 min + DB-check en el guard**: revocación efectiva inmediata
  (el guard exige sesión activa; el JWT solo evita un lookup de identidad,
  no de validez).
- **Refresh opaco rotatorio** con familia + `prev_hash`; reúso → revoca familia
  + evento `refresh_reuso` + 401.
- **Login no exige e-mail verificado** (decisión documentada: fricción demo;
  endpoints sensibles futuros pueden exigirlo vía guard).
- **Rate-limit en memoria** por IP (login 10/60s, register 5/3600s…) —
  válido 1 réplica; Redis queda documentado para escalar.
- **E-mail = puerto + adaptador log** (sin SMTP local; credenciales no inventadas).

## Límites

- `identity` no importa otros módulos de negocio; exporta `AuthGuard`,
  `USER_REPOSITORY`, `SESSION_REPOSITORY` para Fases D–G.
- `AuthError(status, code, message)` → `AuthErrorFilter` (presentación);
  `DomainError` → 400. Respuestas de error: `{statusCode, message, code}`.
