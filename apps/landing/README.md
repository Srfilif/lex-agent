# lex-landing — landing pública

Landing independiente de Lex Colombia. Vive en su propia app Next.js para
tener renderizado en servidor, metadatos reales y una URL canónica, sin
mezclar el framework con la SPA del producto.

## Stack

- Next.js 15 (App Router) + React 19 + TypeScript estricto.
- CSS Modules + tokens propios. Sin Tailwind ni librería de componentes.
- `next/font/google`: Instrument Serif (display) e Inter (texto).
- Renderizado en servidor; el único componente cliente es el selector de tema
  claro/oscuro, que persiste la preferencia en `localStorage`.

## Scripts

```bash
npm install
npm run dev        # http://localhost:3001
npm run build
npm run start      # producción en :3001
npm run typecheck
```

## Entorno

Crea `.env.local` a partir de `.env.example`:

| Variable | Uso | Default |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | Destino de todos los CTA y enlaces al producto | `http://localhost:5173` |
| `NEXT_PUBLIC_SITE_URL` | Canonical, Open Graph, sitemap y robots | `http://localhost:3001` |

En producción, `NEXT_PUBLIC_SITE_URL` debe ser la URL pública exacta, con
protocolo y sin barra final.

## Rutas

- `/` — landing.
- `/aviso-legal` — condiciones y límites del servicio.
- `/opengraph-image` — imagen social 1200×630 generada con `next/og`.
- `/sitemap.xml`, `/robots.txt`, `/manifest.webmanifest`.

## SEO

- `metadata` en `app/layout.tsx`: título, descripción, canonical, Open Graph,
  Twitter, robots y manifest.
- JSON-LD en `app/page.tsx`: Organization, WebSite, SoftwareApplication y
  FAQPage con las mismas preguntas visibles.
- HTML semántico, un solo `h1`, landmarks, `skip-link`, foco visible y
  `prefers-reduced-motion`.
- El contenido evita testimonios, métricas de clientes, precios o cifras de
  corpus inventadas. Las limitaciones (vigencia, formatos, cobertura) están
  declaradas en la propia página y en el aviso legal.

## Despliegue

El build prerenderiza las páginas. Se puede desplegar como servicio Node de
Next o en un hosting compatible con Next. La landing no comparte build,
dependencias ni sesión con `apps/web`; solo enlaza a la URL del producto.
