# Informe de Auditoría Jurídica Integral — Kelsyx (Kelsyx)

- **Fecha:** 2026-11-18 (rebranding a Kelsyx el mismo día; versiones legales
  v1.0 sin cambios: el nuevo nombre no altera obligaciones ni finalidades).
  **Jurisdicción principal:** República de Colombia.
- **Alcance auditado:** monorepo `apps/api` (NestJS 11), `apps/web` (React 19 +
  Vite), `apps/landing` (Next.js 15), `db/`, `docs/`, `tests/`, `scripts/`.
- **Método:** auditoría paralela por agentes (técnica, datos/consumo, normativa,
  jurisprudencia, licenciamiento + crítica adversarial), verificación directa de
  archivos y git, cotejo del texto oficial PolyForm, corroboración directa de
  dos sentencias en relatoría, pruebas ejecutadas (ver §G).

## A. Resumen ejecutivo

Kelsyx es un asistente de investigación jurídica colombiana con RAG
(chat con citas, proyectos con archivos .txt/.md, memoria opt-in,
investigaciones, SECOP), cuentas con TOTP, facturación solo-sandbox (sin cobro
real) y landing informativa. Operador observado: Andrés Felipe Ángel (persona
natural, Colombia; srfilif@gmail.com; srfilif.dev).

Estado inicial: sin términos, sin política de datos, sin autorización previa,
sin banner de cookies, sin canal habeas data; licencia MIT en HEAD con cambio
a PolyForm ya iniciado en worktree sin documentar ni commitear.

Estado final: documentos legales creados y coherentes; consentimiento previo
con doble casilla, registro de versión/fecha y puerta para cuentas previas;
aviso de cookies real (rechazo funcional); páginas legales en landing y
enlaces en footer/registro/cuenta; licenciamiento PolyForm verificado,
documentado y con atribuciones de terceros. **Clasificación: APTO CON
RESTRICCIONES** (ver §I).

## B. Hallazgos

| Hallazgo | Norma o fundamento | Riesgo | Prioridad | Solución |
|---|---|---|---|---|
| Registro sin autorización previa de datos ni aceptación de términos | Ley 1581 arts. 9, 12; CP art. 15 | Sanción SIC; tratamiento ilícito | CRÍTICO | Doble casilla en registro + estampa versión/fecha (019, DTO, ConsentGate) |
| Sin prueba de autorización accesible | Ley 1581 art. 9; Ley 527 arts. 6, 10 | Indefensión ante SIC/reclamos | CRÍTICO | Columnas terms/privacy_version+at; export; evento auditado |
| Transferencias internacionales (Meta/Google/SMTP) sin autorización ni DPA | Ley 1581 art. 26; Dec. 1074 Cap. 25 | Transferencia ilícita | CRÍTICO | Autorización expresa en política + registro; DPA pendientes del titular |
| Sin política/aviso de privacidad ni canal habeas data | Ley 1581 arts. 8, 14–16; Dec. 1377 | Quejas SIC; derechos sin canal | ALTO | PRIVACY_POLICY + /privacidad + canal correo + plazos; falta formulario/RNBD |
| Tokens/tema en localStorage sin información ni control | Ley 1581 (finalidad, información) | Opacidad; consentimiento viciado | ALTO | COOKIE_POLICY + aviso real con rechazo funcional + /cookies |
| Contenidos de usuarios pueden traer sensibles/de menores sin filtro | Ley 1581 (sensibles); niñez | Tratamiento indebido de terceros | ALTO | Prohibición en AUP + reporte + advertencias; sin filtro automático (límite declarado) |
| Checkout sandbox con precios COP sin marco de consumo | Ley 1480 (al activar cobro) | Venta futura sin retracto/PQR | MEDIO | Términos regulan gratuidad y aviso previo a planes pagos; retracto/PQR al monetizar |
| Baneos/sanciones sin debido proceso documentado | CP art. 29; C-593/14; SU420/19 | Tutelas; sanciones inválidas | MEDIO | AUP: gradualidad, cargos, descargos, apelación humana |
| Sin community guidelines ni canal de reporte de contenidos | SU420/19; T-145/16; T-050/16 | Tutela por indefensión | MEDIO | Notice-and-action en AUP + canal correo |
| Cambio MIT→PolyForm sin documentar ni commitear | Titularidad; buena fe | Inseguridad sobre licencia aplicable | MEDIO | LICENSE verificado + LICENSE_CHANGE.md + metadatos (falta commit del titular) |
| Sin NOTICE de terceros (MIT/Apache/ISC/BSD/OFL exigen conservar avisos) | Licencias permisivas | Incumplimiento en distribución | MEDIO | THIRD_PARTY_NOTICES.md (directas; transitivas pendientes) |
| README→SECURITY.md roto; sin política de reporte | Buenas prácticas; confianza | Reportes perdidos | BAJO | SECURITY.md creado (corrige enlace) |
| Identificación del proveedor incompleta (solo gmail/sitio) | Ley 1480 info; Ley 1581 art. 12 | Requerimientos SIC | BAJO | Marcadores [PENDIENTE] en términos/política; completar antes de operar comercial |
| Docker tags flotantes; CDN/hosting no auditado | Integridad; seguridad | Deriva de versiones; cookies no vistas | BAJO | Inventariado en THIRD-PARTY + informe; pinear en despliegue |
| Umbral RNBD y circulares SIC sin cotejo directo (red sandbox bloqueó SUIN/SIC) | Ley 1581 art. 25 | Conclusión prematura | INFORMATIVO | Marcado [PENDIENTE]; no se afirmó obligatoriedad |

## C. Normativa aplicable (verificada)

Corroboración cruzada 3+ fuentes por norma; textos SUIN/SIC no cotejados en
origen por bloqueo de red (TLS/timeout) — pendiente cotejo directo de los
artículos marcados (*).

- **CP art. 15:** habeas data (conocer, actualizar, rectificar; garantías de
  recolección/tratamiento/circulación). Implementación parcial → completa con
  autorización + canal + export/borrado.
- **Ley 1581/2012** (D.O. 48.587): arts. 4 (principios), 8 (derechos), 9
  (autorización previa/expresa/informada), 14 (consultas 10+5), 15 (reclamos
  15+8), 16 (procedibilidad SIC), 17 (deberes responsable, 17.k manual), 18
  (encargado), 25 (RNBD), Tít. VII (SIC sancionadora); arts. 10*, 12*, 23*, 26*
  pendientes de cotejo literal.
- **Decreto 1377/2013** (compilado): autorización, aviso de privacidad,
  transferencia/transmisión (arts. 24–25); numerales de aviso/política (*).
- **Decreto 1074/2015** (D.O. 49.523): Cap. 25 (compila 1377), Cap. 26 RNBD
  (ex-886/2014, mod. 090/2018, 1115/2017); umbral vigente en disputa (*).
- **Ley 1480/2011** (D.O. 48.220): hoy sin relación de consumo electrónica
  (sandbox sin cobro); al monetizar aplican info (3, 23–28), retracto (47, 5
  días), reversión (51 + Dec. 587/2016); art. 50* no verificado.
- **Ley 527/1999** (D.O. 43.673): arts. 2, 5, 6, 10 — el click-wrap con prueba
  accesible es válido; hoy se conserva (versión/fecha/evento). Arts. 7–9*.
- **SIC:** Circular Única Tít. V, Guía accountability, Ext. 002/2024 (IA),
  003/2024, 003/2020 — vigencia/ámbito no verificados (*); rnbd.sic.gov.co.
- **Ley 1266/2008:** excluida (sin datos financieros/crediticios).

## D. Jurisprudencia (relatoría oficial; URLs corteconstitucional.gov.co)

Re-verificadas en esta sesión: SU420/19 y T-414/92 (fetch directo). Resto
inspeccionado en relatoría por auditoría paralela. **No citar:** T-063A/17
(nula, Auto 285/2018), T-115/18 (pensión invalidez, no olvido), SU-082/95 (sin
cuerpo accesible), fallo Cali 2021 (sin número), ni baneos digitales
específicos (sin fallo verificable).

| Sentencia (ponente) | Regla aplicable | Relación con la plataforma | Medida |
|---|---|---|---|
| T-414/92 (Angarita, 1992) | Origen habeas data/libertad informática; control de conocer/actualizar/rectificar | Fundamento de todo tratamiento | Autorización + canal + export/borrado |
| C-748/11 (Pretelt, 2011) | Exequibilidad Ley 1581; deberes responsable/encargado | Estatuto aplicable a la base de cuentas | Política + manual + RNBD/DPA |
| T-729/02 (Montealegre, 2002) | Prohíbe publicar bases con datos en internet sin consentimiento | Sin perfiles/directorios públicos ni APIs que filtren | Privacidad por defecto; minimización |
| T-277/15 (Calle, 2015) | Intermediarios no son editores; rectificación contra la fuente (recotejar texto: artefacto en transcripción) | Búsqueda/corpus con datos de terceros | Notice-and-action dirigido a la fuente |
| T-040/13 (Pretelt, 2013) | Información exige veracidad e imparcialidad | Respuestas IA sobre hechos/terceros | Verificación obligatoria; canal rectificación |
| T-145/16 (Guerrero, 2016) | Injuria viral: indefensión, tutela contra particulares | Contenidos entre usuarios; enlaces compartidos | Canal denuncia; retiro injuria manifiesta |
| T-050/16 (Mendoza, 2016) | Intimidad, imagen propia (consentimiento), no escrache | Archivos/mensajes con fotos/datos ajenos | Prohibición AUP; retiro expedito |
| SU420/19 (Reyes, 2019, unificación) | Subsidiariedad: autor → plataforma (si reglas lo permiten) → tutela; indefensión caso a caso | Obliga a reglas + reclamo interno efectivo | AUP + tickets motivados por correo + revisión |
| C-593/14 (Pretelt, 2014) | Sanciones entre particulares exigen debido proceso (analogía) | Suspensión/cancelación de cuentas | Aviso, descargos, motivación, apelación |
| C-909/12 (Pinilla, 2012) | Prohíbe cláusulas abusivas en adhesión | Términos click-wrap | Auditoría: sin arbitraje impuesto ni exoneraciones ilegales |
| T-109/21 (Rojas, 2021, analógica) | Contrato realidad webcam | Sin subordinados hoy; riesgo si se añaden prestadores | No imponer subordinación sin asumir efectos |
| T-239/18 (Ortiz, 2018, analógica) | Debida diligencia violencia de género | Acoso en contenidos/comunidades | Protocolo anti-acoso con enfoque de género |
| C-1011/08 | Financiera: sin objeto (no hay scoring/reportes) | — | No aplica; se excluye |

## E. Licenciamiento

- **Anterior (HEAD):** MIT, `Copyright (c) 2026 Kelsyx contributors`
  (verificado `git show HEAD:LICENSE`).
- **Nueva (worktree):** PolyForm Noncommercial 1.0.0, `Required Notice:
  Copyright © 2026 Andrés Felipe Ángel (https://srfilif.dev)` — texto idéntico
  al oficial (cotejado con
  https://polyformproject.org/licenses/noncommercial/1.0.0.txt).
- **Validez:** historial git (`.git/logs/HEAD`) con 6 commits de un único autor
  (SrFilif), sin contribuciones externas → el titular puede relicenciar
  prospectivamente. Copias MIT ya distribuidas (si el repo fue público)
  conservan MIT.
- **Naturaleza:** source-available, NO Open Source OSI (declarado en README,
  /licencia, /aviso-legal, LICENSE_CHANGE.md).
- **Dependencias directas:** MIT, Apache-2.0, ISC, MIT-0, OFL-1.1 — todas
  permisivas y compatibles (ver THIRD_PARTY_NOTICES.md). Sin copyleft.
- **Problemas:** cambio sin commit (decisión del titular); transitivas web/
  landing sin inventario individual; Docker flotantes; ToS de Meta/Gemini/
  SECOP/corpus sin auditar; `license` no-SPDX en package.json (válido en npm;
  alternativa `SEE LICENSE IN LICENSE`); link GitHub /licencia asume rama
  `main` (correcto: HEAD→main) con mayúscula `Srfilif` (GitHub insensible).
- **Archivos:** LICENSE (verificado, sin cambios), LICENSE_CHANGE.md (nuevo),
  THIRD_PARTY_NOTICES.md (nuevo), README + 4 package.json (pre-existentes en
  worktree), landing /licencia + /aviso-legal (pre-existentes; aviso enlazado).

## F. Documentación

| Documento | Estado |
|---|---|
| LICENSE (PolyForm íntegro) | Verificado contra oficial; sin cambios |
| LICENSE_CHANGE.md | Creado (anterior, nueva, fecha, motivos, alcance, no-comercial, restricciones, comercial, versiones previas, validez, no-OSI) |
| TERMS_OF_SERVICE.md v1.0 | Creado (15 secciones; Colombia; gratuidad; debido proceso; sin exoneraciones ilegales) |
| PRIVACY_POLICY.md v1.0 | Creado (14 secciones; Ley 1581; transferencias; derechos; retención) |
| DATA_PROCESSING_POLICY.md v1.0 | Creado (manual interno art. 17.k: roles, consultas/reclamos, incidentes, RNBD, IA) |
| COOKIE_POLICY.md v1.0 | Creado (técnicas reales; control; sin terceros) |
| ACCEPTABLE_USE_POLICY.md v1.0 | Creado (prohibiciones, sensibles/menores, notice-and-action, debido proceso) |
| SECURITY.md v1.0 | Creado (reporte, controles verificados, incidentes; corrige enlace README) |
| THIRD_PARTY_NOTICES.md | Creado (directas api/web/landing + infra/fuentes) |
| LEGAL_NOTICE.md | No creado (decisión): el aviso vive en landing /aviso-legal; identificación en Términos §1 y Privacidad §1. Duplicarlo arriesga contradicción |
| .env.example | Añadida VITE_LEGAL_URL documentada |
| README.md | Sección legal + LICENSE_CHANGE; enlace SECURITY.md ya válido |

## G. Cambios técnicos

Backend (`apps/api`): migración `019_consents.sql` (+ espejos `init.sql`,
`sqlite/schema.sql`); `domain/consent-versions.ts`; `User` (+consentimiento);
repo pg/sqlite (insert/update/mapeo); `RegisterDto` + `ConsentsDto`
(@Equals(true)); registro exige ambas aceptaciones y estampa versiones;
`Consents` (GET/POST `/account/consents` + evento `consentimiento_registrado`);
`/account/me` expone consentimiento; export incluye versiones; seed estampa
dev; smoke/e2e/eval actualizados con flags.

Frontend web: `legal.ts` (versiones, URLs, elección cookies real);
`ConsentGate.tsx` (cuentas pre-019); `CookieNotice.tsx` (rechazo funcional +
opt-out de tema); `AuthView` doble casilla; `App` (puerta, aviso en 4 ramas,
tema respeta opt-out); `Datos.tsx` (mis aceptaciones + configurar cookies);
CSS del aviso; `Me`/cliente de consentimientos.

Landing: `/terminos`, `/privacidad`, `/cookies`; `CookieNotice` + `ReabrirCookies`;
`cookies.ts`; `ThemeToggle` y theme-script respetan opt-out; footer y sitemap
ampliados; `/aviso-legal` enlaza políticas.

Pruebas observadas: `typecheck` api/web/landing ✓; `test:unit` ✓ (7
aserciones nuevas consent); `test:architecture` ✓; `test:sqlite` ✓ (4
nuevas); `next build` ✓ (13 rutas incl. nuevas); `npm run build` api+web ✓;
sonda DTO/casos de uso 13/13 ✓; sonda cookies sobre código real 10/10 ✓;
arranque Nest mapea GET+POST `/account/consents` ✓ (listen bloqueado por
sandbox: EACCES, sin servidor en vivo). Sin regresiones en suites del repo.

## H. Pendientes del propietario (solo el titular puede)

1. Identidad: documento, domicilio/ciudad, canal PQR formal, responsable
   interno de datos (marcadores [PENDIENTE] en términos/política).
2. Commit dedicado del relicenciamiento (+ tag) y decisión sobre copias MIT
   previas si el repo fue público.
3. DPA/DTA con Meta, Google, SMTP y hosting; país de cada uno; tier Standard
   vs Contributor efectivo; decisión de residencia de datos.
4. RNBD: determinar obligatoriedad con umbral vigente y, si aplica, inscribir.
5. Cotejo directo SUIN/SIC/relatoría de artículos (*), umbral RNBD, circulares
   y T-277/15; evaluación de impacto IA (Circ. 002/2024).
6. Despliegue: proveedor/ubicación, TLS/CDN/headers, pines Docker, formulario
   web PQR/habeas data, plan de respuesta a incidentes, backups y monitoreo.
7. Comercial futuro: precios, facturación, retracto/reversión operativos,
   garantía, SIC-consumidor; condiciones de licencias comerciales.
8. Revisión final por abogado colombiano habilitado (incertidumbre residual
   documentada, no opinión legal definitiva).

## I. Evaluación de lanzamiento

**Clasificación: APTO CON RESTRICCIONES.**

Justificación: el núcleo exigible está implementado y probado (términos,
política y autorización previa con prueba, cookies reales, debido proceso,
licencia documentada, sin regresiones). Las restricciones son los 8 pendientes
del §H, que requieren datos, contratos o decisiones del titular y no son
implementables por auditoría. No lanzar como operación comercial con cobro
hasta resolver H.3, H.4 y H.7; no admitir datos sensibles/confidenciales de
producción hasta H.3 y H.6; completar H.1 antes de cualquier despliegue
público. Publicar políticas no equivale a cumplirlas: operar los procedimientos
(plazos habeas data, incidentes, purgas) desde el día uno.
