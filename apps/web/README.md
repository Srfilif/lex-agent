# lex-web — Frontend React

App del chat jurídico: auth (login/registro/TOTP/sesiones), shell con
sidebar de chats, chat con streaming SSE y Markdown propio, proyectos con
archivos, cuenta (perfil/preferencias/seguridad/facturación/admin) y visor
de fragmentos con citas.

React 19 sin router: navegación por estado local (+ hash `#/storage` para
archivos). Cero dependencias de UI.

## Scripts (`npm run` desde `apps/web/`)

- `dev` — Vite dev en puerto 5173.
- `build` — `tsc --noEmit` + build a `dist/`.
- `preview` — sirve `dist/` en puerto 4173 (lo que usa Docker).
- `typecheck` — `tsc --noEmit`.

## Entorno

- `VITE_API_URL` — base de la API (default `http://localhost:3000`).

## Estructura (`src/`)

- `App.tsx`, `main.tsx`, `styles.css` — shell.
- `api.ts`, `chatApi.ts`, `auth.ts`, `cuenta.ts` — clientes HTTP.
- `components/` — `ChatShell`, `Sidebar`, `AuthView`, `Cuenta` (+ `cuenta/`),
  `Facturacion`, `AdminPanel`, `ArchivosProyecto`, `Storage`, `Fragmento`,
  `Markdown`, `Secop`, `Investigar`, `SharedView`, presentacionales.
- `shared/` — utilidades (tema, etc.).

Nota: el `Dockerfile` sirve con `vite preview` (válido para demo; para
producción real usar un servidor estático dedicado).
