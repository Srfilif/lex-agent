# AUTHORIZATION_AND_RBAC.md — roles mínimos reales (Fase D)

## Modelo

Dos roles en `users.role` (`user`|`admin`), verificados en servidor desde el
access JWT + sesión DB. El rol enviado por el cliente se ignora
(`ValidationPipe whitelist`; humo: `role:admin` por body → queda `user`).

- Autenticación (`AuthGuard`): quién es. Autorización (`RolesGuard` + `@Roles`):
  qué puede hacer. Sin `@Roles` → basta autenticarse.
- Separación lista para Fases E–G: membresía/entitlements/estado se añaden
  como guards o chequeos de caso de uso, no como `if` en controladores.

## Endpoints admin (`/admin/users`, solo `admin`)

| Método | Ruta | Efecto |
|---|---|---|
| GET | `/admin/users?limit&offset&search` | lista paginada (búsqueda por email, LIKE escapado) |
| PATCH | `/admin/users/:id/status` | `active`/`disabled`; bloquear revoca sesiones |
| PATCH | `/admin/users/:id/role` | `user`/`admin` |
| POST | `/admin/users/:id/totp/reset` | borra 2FA + códigos + sesiones (desbloqueo) |

Protecciones: nadie se deshabilita/cambia rol a sí mismo (400
`operacion_no_permitida`); `deleted` no reversible por admin; todo cambio
emite `security_events` con `meta.admin`.

## Matriz verificada (humo)

Anónimo → 401; `user` → 403; `admin` → 200. Bloqueado → login 403 +
sesiones revocadas. Unitarias: guard (4) + transiciones `enable`/`setRole` (2).
