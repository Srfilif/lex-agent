# Avisos de terceros (THIRD-PARTY NOTICES)

El código propio de Kelsyx se distribuye bajo PolyForm Noncommercial 1.0.0
(ver [LICENSE](LICENSE)). Los componentes de terceros listados abajo conservan
sus propias licencias y avisos de copyright. Al redistribuir el software deben
conservarse estos avisos según lo exija cada licencia.

Última revisión: 2026-11-18. Alcance: dependencias directas declaradas en los
`package.json` de `apps/api`, `apps/web` y `apps/landing`. Las dependencias
transitivas se rigen por sus propios archivos LICENSE en `node_modules`
(pendiente inventario completo: ver LEGAL_AUDIT_REPORT.md).

## Licencias permisivas (resumen de obligaciones)

- **MIT / ISC / BSD:** conservar aviso de copyright y texto del permiso.
- **Apache-2.0:** conservar avisos, incluir texto de la licencia e indicar
  cambios realizados en archivos modificados.
- **MIT-0 (MIT No Attribution):** sin obligación de atribución.
- **OFL-1.1 (SIL Open Font License):** conservar aviso de copyright y licencia;
  las fuentes no pueden venderse por sí solas y no pueden distribuirse
  modificadas bajo su nombre reservado sin autorización.

## apps/api (lex-api)

| Paquete | Licencia | Titular |
|---|---|---|
| @nestjs/common, @nestjs/core, @nestjs/platform-express | MIT | Kamil Mysliwiec |
| class-transformer, class-validator | MIT | TypeStack contributors |
| ioredis | MIT | Zihua Li |
| nodemailer | MIT-0 | Andris Reinman |
| pg | MIT | Brian Carlson |
| reflect-metadata | Apache-2.0 | Ron Buckton |
| rxjs | Apache-2.0 | Ben Lesh |
| ts-node | MIT | Blake Embrey |
| typescript, @types/node, @types/pg | Apache-2.0 / MIT | Microsoft Corp. / DefinitelyTyped contributors |

## apps/web

| Paquete | Licencia | Titular |
|---|---|---|
| react, react-dom, @types/react, @types/react-dom | MIT | Meta / DefinitelyTyped contributors |
| vite, @vitejs/plugin-react, @tailwindcss/vite | MIT | Evan You y colaboradores |
| tailwindcss, tw-animate-css | MIT | Tailwind Labs / Luca Bosin |
| radix-ui, cmdk, shadcn, class-variance-authority | MIT / Apache-2.0 | WorkOS / Paco Coursey / shadcn / Joe Bell |
| lucide-react | ISC | Eric Fennis / Lucide contributors |
| cn | MIT | (ver package.json del paquete) |
| @fontsource-variable/geist | OFL-1.1 | Google Inc. (fuente Geist) |
| typescript | Apache-2.0 | Microsoft Corp. |

## apps/landing

| Paquete | Licencia | Titular |
|---|---|---|
| next | MIT | Vercel, Inc. |
| react, react-dom, @types/react, @types/react-dom, @types/node | MIT | Meta / DefinitelyTyped contributors |
| typescript | Apache-2.0 | Microsoft Corp. |

## Infraestructura y fuentes (no son paquetes npm)

- Imágenes Docker: `pgvector/pgvector:pg16`, `redis:7-alpine`, `ollama/ollama`,
  `node:22-alpine` — rigen sus propias licencias (pendiente verificación contra
  el pin desplegado).
- Fuentes servidas vía `next/font/google` (Instrument Serif, Inter) — licencias
  de Google Fonts (OFL-1.1).
- Modelos y APIs: Meta Model API, Google Gemini embeddings, Ollama bge-m3 —
  rigen sus términos de servicio, ajenos a este repositorio.
- Datos públicos SECOP (datos.gov.co) y corpus jurídico en `data/` (no
  distribuido) — rigen las condiciones de cada fuente oficial.

Ninguna licencia permisiva listada impone condiciones al código propio del
proyecto ni impide distribuirlo bajo PolyForm Noncommercial 1.0.0.
