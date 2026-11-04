# ROADMAP — De LexAgent actual a un ChatGPT jurídico con RAG

Fecha: 2026-10-27. Estado verificado contra código (no contra memoria).
Objetivo: sistema conversacional completo (chats, proyectos, archivos, streaming)
consumiendo el Model API actual, enfocado en contenido jurídico con citas verificables.

## 1. Lo que YA existe (no reconstruir)

**Backend `apps/api`** (SaaS A–H verificado): identidad completa (registro, login,
sesiones rotatorias revocables, TOTP, recovery, RBAC admin), planes/entitlements,
cuotas atómicas con atribución al agente, checkout sandbox + webhooks firmados,
perfil/preferencias/export/borrado. RAG: búsqueda híbrida FTS+vector (`lex_spanish`,
HNSW 1024), SECOP sincronizado, agente investigador one-shot con 4 tools,
verificador de citas con juez LLM, informes Markdown. 126 asserts, 16/16 DB,
goldens intactos, `npm audit` 0.

**Chat backend Fase 1 (B1–B4, verificado 2026-10-27)**: migración 010
(conversations/messages), módulo `modules/chat` (CRUD, multi-turno con ventana
24000 chars, SSE `meta→tool→token→citas→done`, agente con 2 tools
buscar_normas/consultar_contratos + citas, título auto best-effort, cuotas
`reserveChat/recordChat`). Decisiones verificadas contra Meta API: presupuestos
amplios (razonamiento 100–1200 tokens trunca respuestas cortas), respuesta
final no-stream sin tools (el modelo inventa tool_calls en streams sin tools),
stream HTTP 200. Humo `tests/smoke/smoke_chat.mjs` 15/15 verde; 19 asserts nuevos
del agente en unitarias.

**Frontend `apps/web`**: página única React 19 sin router: pregunta → investigar
(bloqueante) → informe con veredictos + SECOP + visor de fragmentos. Sin auth,
sin chat, sin streaming, sin librería Markdown.

## 2. Faltantes backend (API)

| ID | Faltante | Por qué importa | Tamaño |
|---|---|---|---|
| B1 ✅ | Conversaciones persistentes: hilos, mensajes, títulos auto, renombrar/archivar/borrar, paginación (mig 010) | hecho 2026-10-27, humo 15/15 | M |
| B2 ✅ | Chat multi-turno real (`POST /chat/send`): historial, system jurídico, ventana 24000 chars | hecho 2026-10-27 | M |
| B3 ✅ | Streaming SSE (`POST /chat/stream`, 200): meta/tool/token/citas/done | hecho 2026-10-27 | M |
| B4 ✅ | Agente conversacional con RAG: 2 tools + citas + anti-truncado + anti-tools-fantasma | hecho 2026-10-27, 19 asserts | L |
| B5 ✅ | Proyectos: agrupar chats + instrucciones personalizadas (+ archivos del proyecto → ver B6) | hecho 2026-10-27: backend (mig 011, CRUD, mover, system inyectado) humo verde + UI servida en :4173 | M |
| B6 ✅ | Archivos de usuario: upload .txt/.md (PDF/DOCX rechazados honesto), chunk+embed por proyecto, FTS+vector+RRF aislado, citas unificadas, `project_id` en send/stream, query acortada | hecho 2026-10-27: mig 012, cuotas 20/50MB, dedup sha256, humo files 15/15 + chat 34/34, E2E RAG cita archivo verde. Storage global 2026-10-27: `GET /chat/files` + descarga + pestaña Archivos (`#/storage`, alias `#/settings/storage`) con buscar/filtrar/descargar/borrar; humo +7, E2E 14/14 | L |
| B7 ✅ | Multi-modelo: catálogo `CHAT_MODELS` + `modelos` por plan (mig 013), `resolveModel` puro, fallback en gateway (red/5xx/429/404), `GET /chat/modelos`, selector UI | hecho 2026-10-27: wonder-1.0/spark-1.2 verificados con chat real; humo 39/39, E2E 10/10 con respuesta wonder citada; tarifa wonder/spark-1.2 = spark-1.3 hasta calibrar | S |
| B8 ✅ | Memoria: resumen rodante por hilo (mig 014) + compactación automática con degradación a truncado + memoria cruzada opt-in (`ai.crossMemory`, hechos manuales/auto, tope 50 FIFO, export/borrado) | hecho 2026-10-27: humo +9, E2E 13/13 (hilo 3×7900 compacta, summary_count≥1 verificado); extracción auto unit-testeada, en vivo el modelo no devolvió hechos | M |
| B9 ✅ | Buscar en chats, compartir enlace, exportar conversación, regenerar | hecho 2026-10-27: backend (search/export/share público/regenerate) humo verde + UI servida en :4173 | S |
| B10 ✅ | Guardarraíles chat: presupuesto prompt/mensaje (`CHAT_MAX_PROMPT_TOKENS`), timeouts gateway+embed, moderación pre-vuelo por instrucciones (crisis/ilícito, sin sobre-bloqueo temático), disclaimer garantizado con tools, anti-inyección (system+framing+scan con aviso, mig 015) | hecho 2026-10-27: humo 51/51 + 16/16, E2E 8/8; output-moderation y multi-turno jailbreak fuera de alcance | M |
| B11 ✅ | Títulos+temas (1 llamada JSON atribuida `titulo`, mig 016) + sugerencias on-demand (`GET .../sugerencias`, atribuidas, rate 10/min) + chips clicables y badges en header | hecho 2026-10-27: humo 53/53, E2E 7/7; fix real: fetch de chips solo al terminar el stream (mid-stream perdía 1 llamada) | S |

## 3. Faltantes frontend (casi todo el producto visible)

| ID | Faltante | Notas |
|---|---|---|
| F1 ✅ | Auth UI: login/registro, refresh silencioso, TOTP setup, reset, sesiones | hecho 2026-10-27: TOTP ciclo completo (entrada manual) + login MFA + reset + sesiones; E2E headless verde |
| F2 ✅ | Shell: sidebar (chats, renombrar/borrar/archivar, ver archivados) + responsive + modo invitado | hecho 2026-10-27, sin router (estado local); typecheck+build verdes |
| F3 ✅ | Chat UI: streaming SSE, Markdown propio, citas clicables al fragmento, copiar/reintentar, costo+modelo visibles | hecho 2026-10-27, 0 deps nuevas; E2E headless 18/18 + renders revisados |
| F4 ✅ | Proyectos UI + uploads con progreso + visor de fuentes del proyecto | hecho 2026-10-27: ArchivosProyecto (FormData manual, 0 deps), chat nace en proyecto vía `project_id`, visor modo chat; E2E 13/13 + capturas revisadas |
| F5 ✅ | Ajustes: perfil, preferencias, seguridad, sesiones, export/borrado | hecho 2026-10-27 (vista Cuenta; theme+modelo con efecto real); E2E verde |
| F6 ✅ | Billing: planes, checkout, uso, pagos, suscripción | hecho 2026-10-27 (checkout sandbox completo con relay webhook); E2E verde |
| F7 ✅ | Admin: usuarios, roles, grants, reseteo TOTP | hecho 2026-10-27 (pestaña solo-admin; reset no probado con TOTP activo) |
| F8 | Deps nuevas a evaluar al implementar: router, render Markdown+GFM, cliente SSE sobre `fetch`+`ReadableStream`, uploader con reintentos | única adición de deps prevista |

## 4. Faltantes datos/corpus (calidad jurídica)

- **D1. Corpus mínimo** (parcial ✅ 2026-10-27): cobertura honesta expuesta
  (`GET /search/documentos` → 3 docs, 1407 fragmentos; footer vivo en UI;
  filtros `jurisdiccion`/`tema`; ingesta verificada en regresión DB).
  Siguen faltando sentencias C/SU/T, decretos, conceptos, doctrina: sin
  fuentes reales no se ingiere nada (no se fabrica norma).
- **D2. Vigencia normativa** (trazabilidad ✅ 2026-10-27): `vigencia`,
  `autoridad`, `fecha_consulta` en hits/`/search/chunk/:id`/citas del chat
  y visibles en Fragmento. Valor honesto: todo `vigencia_desconocida`.
  Falta fuente oficial de vigencias para marcar `vigencia_verificada`.
- **D3. Calidad retrieval** (parcial ✅ 2026-10-27): rerank determinista
  (cobertura léxica + frase + ruta + autoridad, puro, sin deps) + eval
  conversacional (`eval/conversacion.json` + `tests/eval/run_eval_conv.mjs`,
  9/9 el 2026-10-27). Falta: pipeline OCR (PDF/DOCX) y reranker neuronal
  (requiere nueva dependencia/servicio).

## 5. Faltantes infra/operación

- **I1** (mayoría ✅ 2026-10-27): Redis (rate-limit distribuido verificado
  en vivo 5×201→429; servicio en compose), SMTP real (`SmtpEmailSender`,
  falta credencial del proveedor), storage con puerto `FileStorage`
  (adaptador S3 futuro), backups probados con restore (`scripts/backup_db`
  + `restore_db`, 8.2 MB íntegros), logs JSON en prod, `/ready` + `/health`,
  staging (`docker-compose.staging.yml`), CI (typecheck/unit/build),
  purga (`npm run purge`), `npm audit` 0 vulns. Resta: colas/worker async
  para archivos, métricas/trazas, cifrado de dumps + cron fuera del repo.
- **I2** (parcial ✅ 2026-10-27): CORS prod (`CORS_ORIGINS`, https
  obligatorio), secretos prod con fail-fast (`NODE_ENV=production`),
  2FA admin obligatoria (`mfa_ok` mig 017 + `ADMIN_MFA_REQUIRED`),
  investigate anónimo bloqueado en prod. Resta: Wompi real (adaptador +
  credenciales, sandbox intacto), secretos en KMS (hoy env/KMS externo).
  Detalle: `docs/operaciones/SECURITY_OPERATIONS.md`.

## 6. Roadmap propuesto (orden de valor)

1. **Núcleo chat (B1+B2+B3+B4 + F2+F3 mínimo)** ✅ backend verificado
   2026-10-27 (humo 15/15) + frontend servido en :4173 y verificado E2E
   headless 18/18 con revisión visual de renders. Es el salto de "demo"
   a "producto".
2. **Cuenta usable en UI (F1+F5+F6+F7)** ✅ hecho 2026-10-27: vista
   Cuenta (perfil, preferencias, seguridad, sesiones, facturación, admin)
   servida en :4173 y verificada E2E headless (22+11 checks) con revisión
   visual de renders. Desbloquea beta cerrada con cobro.
3. **Proyectos + archivos (B5+B6+F4)** ✅ hecho 2026-10-27: segundo
   diferenciador verificado (batería verde + E2E 13/13 con cita RAG de
   archivo). Alcance: .txt/.md síncrono; PDF/DOCX/OCR y worker async
   siguen pendientes (parte de D3/I1).
4. **Profundizar (B7–B11, D1–D3)** ✅ hecho 2026-10-27: modelos,
   memoria, títulos/sugerencias, corpus con cobertura honesta, vigencia
   trazada, rerank determinista + eval conversacional 9/9. Resta OCR,
   fuente oficial de vigencias y más documentos (con fuentes reales).
5. **Producción (I1+I2)** ✅ base hecha 2026-10-27 (checklist
   `SECURITY_OPERATIONS.md` 9/9 verificado en local). Resta externo:
   credencial SMTP, Wompi real, KMS, worker async, métricas/trazas.

## 7. Riesgos principales

- **Costo por usuario**: el chat multi-turno + agente quema tokens; las cuotas
  actuales (20–2000 inv/mes) hay que recalibrarlas a mensajes/tokens.
- **Ventana de contexto**: sin B8, los hilos largos degradan o explotan en costo.
- **Calidad jurídica**: D1+D2 mandan más que cualquier feature; un chat rápido
  con corpus pobre destruye confianza.
- **Uploads maliciosos**: mitigación base B10 2026-10-27 (scan con aviso,
  fragmentos como datos no confiables, moderación pre-vuelo). Para beta
  abierta falta moderación de salida y revisión de jailbreak multi-turno.
- **Abstención con citas ruidosas** (hallazgo eval-conv 2026-10-27,
  mitigado 2026-10-27): al abstenerse el agente filtra las citas
  (`esAbstencion` en guardrails + `recordAbstencion` costo-cero para la
  tasa en `/ops/metricas`); respuestas parciales con contenido genuino
  conservan sus citas. Verificado en unitarias + en vivo (0 citas).
- **Mejoras código 2026-10-27** (sin contenido jurídico): botón Detener
  en chat (E2E 6/6), tablas GFM + blockquotes en Markdown (SSR 8/8),
  proximidad en rerank (órdenes golden intactos), métricas admin
  `GET /ops/metricas` (200/401/403 en vivo).

## 8. Preguntas abiertas (necesitan tu decisión)

1. ¿Streaming por SSE (recomendado: simple, compatible) o WebSockets? → **SSE, decidido e implementado 2026-10-27.**
2. ¿Solo modelo Meta o multi-proveedor desde el inicio (implica B7 antes)? → **B7 hecho 2026-10-27: multi-modelo dentro de Meta (spark-1.3/wonder-1.0/spark-1.2). Multi-proveedor sigue abierto (no bloquea).**
3. ¿Archivos por usuario desde el día 1, o solo dentro de proyectos? → **solo dentro de proyectos (implementado B6 2026-10-27; revisable).**
4. ¿Beta cerrada con cobro sandbox (rápido) o esperar a Wompi real?
