# lex-web — Frontend React

Espacio de trabajo LegalTech: inicio, asistente jurídico con streaming SSE,
panel de fuentes, investigación, biblioteca del corpus, documentos, cuenta y
administración.

React 19 + Vite + TypeScript estricto. La navegación usa History API propia:
`/login`, `/register`, `/forgot-password`, `/reset-password`, `/inicio`,
`/chat`, `/investigar`, `/biblioteca`, `/storage`, `/cuenta`, `/admin` y
`/s/:token` (compartido). La UI usa shadcn/ui sobre Tailwind CSS v4, con los
tokens del sistema visual existente como fuente de verdad; los iconos son de
`lucide-react`.

## Scripts (`npm run` desde `apps/web/`)

- `dev` — Vite dev en puerto 5173.
- `build` — `tsc --noEmit` + build a `dist/`.
- `preview` — sirve `dist/` en puerto 4173 (lo que usa Docker).
- `typecheck` — `tsc --noEmit`.

## Entorno

- `VITE_API_URL` — base de la API (default `http://localhost:3000`).

## Estructura (`src/`)

- `App.tsx`, `main.tsx`, `index.css`, `styles.css` — shell, rutas, tema y design system.
- `components/ui/` — primitivas shadcn/ui; `components.json` y `lib/utils.ts` — configuración.
- `api.ts`, `chatApi.ts`, `auth.ts`, `cuenta.ts` — clientes HTTP tipados.
- `components/AppShell.tsx` — rail, topbar, buscador global (Ctrl/⌘+K).
- `components/Dashboard.tsx` — inicio con datos reales.
- `components/Biblioteca.tsx` — corpus y búsqueda de fragmentos.
- `components/` — chat (`ChatShell`, `Sidebar`, `MessageBubble`, `Composer`,
  `ThreadHead`, `WelcomePane`, `Fragmento`, `Markdown`), `Investigar`,
  `Storage`, `ArchivosProyecto`, `Cuenta` (+ `cuenta/`), `Facturacion`,
  `AdminPanel`, `AuthView`, `SharedView`, `Secop`, `CorpusFooter`.
- `shared/` — utilidades de formato y tema.

El detalle de arquitectura, tokens, responsive, accesibilidad y pendientes
está en [docs/frontend/ARQUITECTURA.md](../../docs/frontend/ARQUITECTURA.md).

Nota: el `Dockerfile` sirve con `vite preview`, que aplica fallback SPA a
`index.html` (necesario para abrir `/login` o `/chat` directamente). En
producción, el servidor estático debe configurar la misma reescritura hacia
`index.html`.
