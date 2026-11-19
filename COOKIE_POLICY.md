# Política de Cookies y Almacenamiento Local — Kelsyx

- **Versión:** v1.0 — 2026-11-18.
- **Alcance:** aplicaciones web (React) y landing (Next.js) de Kelsyx.

La plataforma **no usa cookies de analítica, publicidad ni seguimiento de
terceros** en el código auditado. Solo emplea almacenamiento técnico
estrictamente necesario y una preferencia opcional de tema. No hay banner que
bloquee el acceso: el aviso informativo permite aceptar, rechazar lo opcional
y configurar, y el rechazo se cumple realmente (ver §4).

## 1. Cookie propia de sesión

| Nombre | Tipo | Finalidad | Duración | Base |
|---|---|---|---|---|
| `lex_refresh` | Cookie HTTP, HttpOnly, Secure (en prod), SameSite=Lax, ruta `/auth` | Mantener la sesión (refresh token) | Según `refreshTtlDays` configurado | Estrictamente necesaria para el servicio solicitado |

Sin esta cookie (o el token equivalente) no es posible mantener la sesión
iniciada. Se elimina al cerrar sesión.

## 2. Almacenamiento local de la app web (`localStorage`)

| Clave | Finalidad | Necesaria |
|---|---|---|
| `lex_access_token` | Token de acceso a la API | Sí (sesión) |
| `lex_refresh_token` | Renovación de sesión | Sí (sesión) |
| `lex_user_email` | Mostrar el correo de la cuenta | Sí (sesión) |
| `lex_theme` | Preferencia claro/oscuro | **No** (opcional) |
| `lex_cookie_choice` | Su elección sobre este aviso | Sí (recordar preferencia) |

En la landing solo se usan `lex_theme` y `lex_cookie_choice`. No se usa
`sessionStorage` ni identificadores publicitarios.

## 3. Terceros

Ninguna cookie de terceros en el código auditado. Las fuentes tipográficas de
Google Fonts y los enlaces externos (GitHub, YouTube, srfilif.dev) pueden
aplicar sus propias políticas al visitarlos. [PENDIENTE: VERIFICAR CAPA DE
DESPLIEGUE/CDN — headers y cookies del hosting/CDN no auditados].

## 4. Su control (mecanismo real)

- **Rechazar lo opcional:** borra `lex_theme`, impide que se vuelva a guardar
  (bandera `lex_theme_optout`) y deja el tema por defecto del sistema.
- **Aceptar:** permite guardar la preferencia de tema al cambiarla.
- **Cambiar de opinión:** desde Cuenta → Preferencias (app) o el enlace
  "Cookies" del pie de página (landing) puede reabrir la configuración.
- **Sesión:** cerrar sesión elimina tokens y la cookie de refresh.

## 5. Cambios

Si en el futuro se añaden analíticas o terceros, se actualizará esta política,
se pedirá consentimiento previo para lo no esencial y se bloqueará su carga
hasta obtenerlo. Última revisión: 2026-11-18.
