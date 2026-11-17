# Frontend — arquitectura y sistema visual (rediseño LegalTech, 2026-11)

React 19 + Vite + TypeScript estricto. La navegación sigue con History API
propia y clientes `fetch` tipados. La capa visual usa **shadcn/ui sobre
Tailwind CSS v4** (primitivas Radix) y `lucide-react` para iconos.

**Por qué shadcn/ui:** encaja con Vite + React 19, permite migrar por
componentes sin reescribir las vistas y expone el código de cada primitiva
en `components/ui/`. Los tokens propios siguen siendo la fuente de verdad:
`index.css` los proyecta al tema de shadcn y `styles.css` se importa en la
capa `legacy`, de modo que los contratos, rutas y estilos de layout
existentes se conservan. Los controles de navegación y las tarjetas de
layout muy específicas siguen siendo nativos.

## Estructura

```text
apps/web/src/
├── App.tsx                    # router (History API), sesión, tema, semilla del chat
├── main.tsx
├── index.css                  # Tailwind, tema shadcn y puente de tokens
├── styles.css                 # design system legacy: tokens, layout y responsive
├── api.ts                     # cliente público (health, search, cobertura, SECOP)
├── auth.ts                    # sesión, refresh, errores HTTP
├── chatApi.ts                 # DTOs y llamadas autenticadas del chat
├── cuenta.ts                  # DTOs y llamadas de cuenta/facturación
├── shared/
│   ├── formato.ts             # tamanoLegible, fechaLegible (es-CO)
│   └── tema.ts                # aplicarTema (claro/oscuro/sistema)
└── components/
    ├── AppShell.tsx           # rail, topbar, buscador global (Ctrl/⌘+K), salud API
    ├── Dashboard.tsx          # inicio con datos reales del usuario
    ├── Biblioteca.tsx         # corpus: documentos, filtros y fragmentos
    ├── ChatShell.tsx          # orquestación del chat/stream/fuentes/proyectos
    ├── Sidebar.tsx            # conversaciones, proyectos, búsqueda, CRUD
    ├── ThreadHead.tsx         # título, proyecto, compartir, exportar
    ├── MessageBubble.tsx      # respuesta, herramientas, citas, acciones
    ├── AgentActivity.tsx      # herramientas del agente
    ├── Composer.tsx           # compositor, detener, contador, panel de fuentes
    ├── WelcomePane.tsx        # empty state con ejemplos que envían
    ├── Markdown.tsx           # mini-Markdown seguro (tablas, citas, código)
    ├── Fragmento.tsx          # visor de cita: metadatos, vigencia, origen
    ├── ArchivosProyecto.tsx   # upload/list/borrado por proyecto
    ├── Storage.tsx            # documentos: buscar/filtrar/descargar/borrar
    ├── Investigar.tsx         # /agent/investigate + informe verificado + SECOP
    ├── Cuenta.tsx             # tabs de cuenta
    ├── cuenta/                # perfil, preferencias, seguridad, sesiones, datos
    ├── Facturacion.tsx        # planes, suscripción, uso, pagos, historial
    ├── AdminPanel.tsx         # usuarios, roles, estado, reset TOTP, grant
    ├── AuthView.tsx           # registro/login/recuperación/2FA
    ├── SharedView.tsx         # lectura pública por token
    ├── Secop.tsx              # contratos SECOP
    ├── CorpusFooter.tsx       # cobertura viva del corpus
    └── ui/                    # primitivas shadcn/ui (button, dialog, tabs, table…)
```

Capas: `api/auth/chatApi/cuenta` son infraestructura HTTP tipada;
`shared/` utilidades puras; `components/` presentación. `ChatShell`
conserva la orquestación del stream (estado + `AbortController`); el
render se delega en componentes sin estado de negocio.

## Rutas (History API, sin librería)

`/login` · `/register` · `/forgot-password` · `/reset-password`
(`/reset-password/:token` o `?token=`) · `/inicio` · `/chat` ·
`/investigar` · `/biblioteca` · `/storage` · `/cuenta` · `/admin` ·
`/settings/storage` (alias) · `/s/:token` (compartido). Sincronía
bidireccional con el estado y soporte atrás/adelante. `/` redirige a
`/login` o `/inicio` según la sesión; las rutas privadas sin sesión abren
`/login?next=...`. Los enlaces heredados con hash o `?share=` se
normalizan a la ruta real. El servidor debe aplicar fallback SPA a
`index.html` (Vite dev/preview ya lo hace).

## Navegación

- Rail lateral colapsable en escritorio y drawer con overlay en móvil.
  Empieza con la marca, el CTA **Nueva consulta**, el buscador (`Ctrl+K`)
  y las secciones Trabajo / Conocimiento / Cuenta; el perfil queda fijo
  al pie con su menú de cuenta.
- Topbar con breadcrumb, tema claro/oscuro, notificaciones (incluye el
  estado real de `/health`) y perfil con menú de cuenta.
- Buscador global: `Ctrl+K` / `⌘K`; navegación + búsqueda en el historial
  (`GET /chat/search`) con debounce.
- Chat: panel de conversaciones + hilo + panel de fuentes. El panel de
  fuentes arranca cerrado en pantallas ≤1240px y se abre al pulsar una cita.

## Design system (`styles.css` `:root` + `index.css`)

Tokens: superficies (`--bg --surface --surface-2 --surface-sunken --panel`),
texto (`--ink --ink-soft --muted --faint`), líneas, marca
(`--accent --accent-soft --accent-line --gold`), semánticos (`--ok --warn
--bad` y sus `-soft`), radios (5/8/12/16), elevaciones (3 niveles), escala
tipográfica (`--text-2xs`…`--text-3xl`), espaciado (`--space-1..12`),
tipografías, foco y movimiento. Tema oscuro = redefinición de tokens,
sin overrides por componente. No hay hex sueltos fuera de tokens.

`index.css` declara las capas `theme, base, legacy, components, utilities`,
mapea los tokens a las variables de shadcn (`--color-background`,
`--color-primary`, etc.) y define el dark mode con
`[data-theme="dark"]`. `styles.css` queda en la capa `legacy` para que las
utilidades de Tailwind puedan ajustar las primitivas sin perder el layout
existente.

Tipografía: sans de sistema para UI y una serif editorial (Iowan/Palatino/
Georgia) solo para títulos de marca, documento y hero. Radios contenidos,
sombras discretas, un solo acento azul institucional + dorado para
autoridad jurídica.

## Responsive

- ≥1241px: rail 232px + panel de chat 272px + hilo + fuentes 350px.
- 1000–1240px: rail colapsado a iconos; fuentes como panel flotante.
- ≤860px: conversaciones en drawer; fuentes en hoja inferior; composer
  sticky con `safe-area-inset`; objetivos táctiles ≥34–44px.
- ≤760px: rail como drawer con overlay, topbar compacta.

## Accesibilidad

Skip-link por foco (sin cambiar la ruta), `<main id="contenido">`, foco al
cambiar de vista, `aria-label`/`aria-expanded`/`aria-pressed`, `role=status`
en streaming, `:focus-visible`, `prefers-reduced-motion`, contraste por
tokens y estados no dependientes solo del color.

## Verificación

`npm run typecheck` + `npm run build` en `apps/web`. Escenarios E2E
existentes en `tests/e2e/` dependen del stack completo y de Microsoft Edge.

## Landing pública (app separada)

`apps/landing` es una app Next.js 15 (App Router) independiente, con CSS
Modules, tipografía editorial, metadatos, JSON-LD, sitemap y robots. No
comparte build ni dependencias con la SPA: solo enlaza a su URL mediante
`NEXT_PUBLIC_APP_URL`. Detalle en `apps/landing/README.md`.

## Pendiente (fuera de este pase)

- Toasts globales (hoy avisos inline por vista).
- Virtualización del hilo para conversaciones >200 mensajes.
- Editor enriquecido (TipTap) y generación documental: no hay endpoint.
- Análisis documental (resumen, partes, cláusulas, riesgos, comparación):
  no hay endpoint; la UI solo declara la indexación TXT/MD real.
- Biblioteca: no existe endpoint de documento individual ni de texto
  consolidado; se muestran metadatos de cobertura y fragmentos de búsqueda.
- Investigaciones guardadas: solo existe recuperación por id; no hay listado.
- Notificaciones: no hay endpoint de bandeja; el panel muestra el estado del
  servicio y enlaza a las preferencias de notificación de la cuenta.
