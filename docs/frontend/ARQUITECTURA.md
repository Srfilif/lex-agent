# Frontend — arquitectura y sistema visual (rediseño 2026-10-28)

React 19 + Vite + TypeScript estricto. **Cero dependencias nuevas**: sin
Tailwind/shadcn/router/query — el sistema propio (tokens CSS, hash-router,
fetch manual) ya cubría lo necesario y migrar duplicaba funcionalidad
existente (§3 del brief: no migrar innecesariamente).

## Estructura

```text
apps/web/src/
├── App.tsx                    # hash-router + nav + landmarks + tema
├── main.tsx
├── styles.css                 # tokens + componentes + responsive + a11y
├── api.ts                     # cliente público (health, search, cobertura)
├── auth.ts                    # sesión, refresh, errores HTTP
├── chatApi.ts                 # DTOs y llamadas autenticadas del chat
├── cuenta.ts                  # DTOs y llamadas de cuenta/facturación
├── shared/
│   ├── formato.ts             # tamanoLegible, fechaLegible (es-CO)
│   └── tema.ts                # aplicarTema (data-theme claro/oscuro/sistema)
└── components/
    ├── ChatShell.tsx          # contenedor: estado, stream, envío, share
    ├── Sidebar.tsx            # chats/proyectos/búsqueda + drawer móvil
    ├── ThreadHead.tsx         # título, mover, compartir, exportar
    ├── MessageBubble.tsx      # burbuja usuario/asistente + citas
    ├── AgentActivity.tsx      # estado de herramientas (⚙ …)
    ├── Composer.tsx           # textarea auto-ajustable + Enviar/Detener
    ├── WelcomePane.tsx        # bienvenida + 3 ejemplos reales (envían)
    ├── Markdown.tsx           # mini-Markdown seguro (tablas, citas, código)
    ├── Fragmento.tsx          # visor de cita + vigencia
    ├── ArchivosProyecto.tsx   # upload/list/borrado por proyecto
    ├── Storage.tsx            # todo lo subido (buscar/filtrar/descargar)
    ├── Investigar.tsx         # flujo /agent/investigate + informe
    ├── Cuenta.tsx             # tabs de cuenta (composición, ~70 líneas)
    ├── cuenta/
    │   ├── comun.tsx          # Bloque + describeError
    │   ├── Perfil.tsx         # perfil + cambio de correo
    │   ├── PreferenciasView.tsx # prefs + tema + recuerdos
    │   ├── RecuerdosView.tsx  # memoria CRUD
    │   ├── Seguridad.tsx      # TOTP + contraseña + logout-all
    │   ├── Sesiones.tsx       # sesiones activas + revocación
    │   └── Datos.tsx          # exportar + borrar cuenta
    ├── Facturacion.tsx        # planes, suscripción, uso
    ├── AdminPanel.tsx         # administración
    ├── AuthView.tsx           # registro/login/recuperación/2FA
    ├── SharedView.tsx         # lectura pública por token
    ├── Secop.tsx              # contratos SECOP
    └── CorpusFooter.tsx       # cobertura viva del corpus
```

Capas pragmáticas (sin módulos vacíos): `chatApi/cuenta/api/auth` son
infraestructura HTTP; `shared/` utilidades puras; `components/` presentación.
`ChatShell` conserva la orquestación del stream (estado + AbortController);
el render se delega a componentes sin estado.

## Rutas (hash, sin librería)

`#/chat` · `#/investigar` · `#/cuenta` · `#/storage` ·
`#/settings/storage` (alias) · `#/s/:token` (compartido). Sincronía
bidireccional con el estado + soporte atrás/adelante. Hash y no paths
porque el estático se sirve sin fallback SPA.

## Tokens (`styles.css` `:root`)

`--bg --surface --ink --muted --line --panel --accent --accent-ink
--ok --warn --bad --topbar-* --radius-* --shadow-* --font-* --focus
--motion`. Cero hex fuera de tokens (salvo badge SECOP bicolor fijo).
Dark = solo redefinición de tokens, sin overrides por componente.

## Responsive

- >1200px: 3 columnas (sidebar 260px + hilo + visor 340px).
- ≤1200px: visor bajo el hilo a ancho completo.
- ≤760px: sidebar en drawer (overlay + foco en botón Contraer),
  composer sticky con `safe-area-inset`, táctiles ≥44px, sin overflow X.
- Sidebar contraíble también en escritorio (columna angosta con ☰).

## Accesibilidad

Skip-link (por foco, no ensucia el hash), `<main id="contenido">`,
foco al cambiar de vista, `aria-label` en nav/aside/busques,
`role=status` en actividad, `:focus-visible`, `prefers-reduced-motion`,
contraste vía tokens (texto sobre color usa `--accent-ink` en dark).

## Verificación

`npm run typecheck` + `npm run build` (CI), E2E headless (`e2e_storage`,
`e2e_stop`, `e2e_visual`), sonda SSR de Markdown (tablas/quotes/escapes).

## Pendiente (fuera de este pase)

- ~~Partir `Cuenta.tsx`~~ hecho 2026-10-28 (`components/cuenta/`, E2E 5/5).
- Toasts unificados (hoy avisos inline por vista).
- Virtualización del hilo para conversaciones >200 mensajes.
