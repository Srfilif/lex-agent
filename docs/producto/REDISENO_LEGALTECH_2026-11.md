# Rediseño LegalTech — auditoría, cambios y pendientes (2026-11)

## 1. Diagnóstico inicial

### Arquitectura real encontrada

- **API**: NestJS 11 + TypeScript, PostgreSQL 16/pgvector (o SQLite en dev).
  Autenticación JWT con refresh, TOTP, sesiones, planes y facturación sandbox.
  RAG híbrido FTS + vectorial, agente investigador con verificación de citas,
  SECOP, chat SSE multi-turno, proyectos y archivos.
- **Web**: React 19 + Vite + TypeScript estricto, router manual con History
  API, clientes `fetch` tipados, CSS propio con tokens. Sin librería de
  componentes.
- **Datos/operación**: Docker Compose, migraciones, seed, evals y E2E Playwright.

### Inventario funcional verificado

| Área | Estado real |
|---|---|
| Chat con streaming SSE | Funcional; citas, herramientas, regenerar, detener, reintentar |
| Historial | Listar/renombrar/archivar/borrar/compartir/exportar/buscar |
| Proyectos | CRUD + instrucciones + archivos .txt/.md indexados |
| Fuentes | `GET /chat/citas/:id`, `GET /search/chunk/:id`, vigencia/autoridad |
| Investigación | `POST /agent/investigate` + `GET /report/:id` con verificación |
| Corpus | `GET /search` (filtros tipo/emisor/número/jurisdicción/tema), `GET /search/documentos` |
| SECOP | Búsqueda con señales; enlace a origen |
| Cuenta | Perfil, preferencias, seguridad/TOTP, sesiones, exportar/borrar |
| Facturación | Planes, suscripción, uso, checkout sandbox, pagos, historial |
| Administración | Usuarios, rol, estado, reset TOTP, grant manual |
| Documentos | Listar/descargar/borrar; upload solo desde proyecto (.txt/.md) |

### Problemas de producto/diseño detectados

1. La navegación era una barra superior con botones y el chat ocupaba toda la
   pantalla; no existía un inicio que orientara al usuario.
2. Tipografía y paleta eran funcionales pero no transmitían una identidad
   LegalTech; sombras, bordes y estados eran irregulares.
3. El chat no jerarquizaba la respuesta, las fuentes ni las acciones; el panel
   de fuentes competía con el hilo y no tenía cabecera propia.
4. La cobertura del corpus solo se veía en el pie; no había exploración
   documental ni filtros.
5. Los estados vacíos eran textos sueltos; faltaban skeletons en varias vistas.
6. Emojis como iconos (menú, archivar, borrar) y controles pequeños en móvil.
7. No había búsqueda global ni atajos; el buscador de chats estaba escondido.
8. La vista pública y el login no compartían la identidad del producto.
9. Funciones pedidas en el brief sin soporte backend (generación documental,
   análisis de PDF/DOCX, guardado de investigaciones, comparación normativa).

## 2. Decisiones de implementación

- **Conservar** React/Vite, clientes HTTP y todos los contratos; la
  navegación se migró a rutas reales (`/login`, `/chat`, etc.).
- **No migrar** a Tailwind/shadcn/HeroUI: ya existía un sistema de tokens;
  migrar duplicaba mantenimiento sin beneficio funcional (regla del brief).
- **Añadir** `lucide-react` como única dependencia nueva (iconos consistentes,
  tree-shaken). No se añadió Motion: transiciones CSS respetan
  `prefers-reduced-motion`.
- **Tokens** nuevos para superficies, texto, semánticos, radios, elevaciones,
  escala tipográfica y espaciado; tema oscuro solo por tokens.
- **Datos reales**: el dashboard y la biblioteca consumen endpoints existentes;
  no se inventaron endpoints, métricas ni fuentes.

## 3. Cambios entregados

### Sistema de diseño
- `styles.css` reescrito: tokens, primitivas (botones, inputs, chips, badges,
  paneles, tablas, skeletons, empty states, modales), temas claro/oscuro,
  responsive y accesibilidad.
- Tipografía editorial para marca/documento; sans de sistema para UI.
- Paleta institucional verde profundo + cobre sobre neutros grafito, semánticos accesibles, sombras discretas.

### Shell y navegación
- `AppShell`: rail colapsable, secciones, topbar, breadcrumb, estado real de
  `/health`, menú de usuario y tema persistido en `/account/preferences`.
- Buscador global `Ctrl/⌘+K`: acciones de navegación + historial real
  (`GET /chat/search`).
- Drawer móvil con overlay y foco; chat con panel de conversaciones y fuentes.

### Inicio (nuevo)
- Saludo y contexto, pregunta directa que abre el chat con borrador.
- Consultas recientes, proyectos, actividad, documentos recientes.
- Cobertura real del corpus, uso/plan reales, avisos de transparencia.
- Skeletons y empty states; errores parciales honestos con reintento.

### Chat
- Composición de tres paneles; cabecera del hilo con proyecto/compartir/exportar.
- Mensajes del asistente con avatar, estado de generación, herramientas, citas
  clicables, copiar con confirmación, regenerar, reintentar.
- Compositor con autoajuste, contador, enviar/detener, atajo y acceso a fuentes.
- Empty state con capacidades y ejemplos que ejecutan consultas reales.
- Panel de fuentes dedicado, con metadatos (tipo, número, autoridad, vigencia,
  fecha de consulta, identificador), fragmento, contexto, copia y enlace oficial.
- Drawer de conversaciones/proyectos rediseñado con confirmaciones y búsqueda.

### Biblioteca jurídica (nueva)
- Lista del corpus real (`GET /search/documentos`) con filtros por tipo,
  entidad y vigencia, y búsqueda local por título/número/entidad.
- Detalle con metadatos y recuperación de fragmentos (`GET /search`) usando
  filtros del documento; resultados con relevancia, método y enlace oficial.
- Modal de fragmento completo con contexto. Se declara que no hay texto
  consolidado ni endpoint de documento individual.

### Investigación y documentos
- Investigar: hero de pregunta, ejemplos, estados de progreso/error, informe
  con veredictos, citas al fragmento, traza/costo y aviso de interpretación IA.
- Documentos: métricas reales, búsqueda/filtro, descarga, borrado con
  confirmación y sección explícita de análisis documental **pendiente**.
- SECOP conservado con la misma consulta y tabla.

### Cuenta y administración
- Cabecera de sección, tabs de cuenta y estilos unificados.
- Administración: métricas de la página, búsqueda, chips de rol/estado,
  confirmación de reset TOTP y grant auditado.
- Login/registro con composición de dos paneles y mensajes de confianza;
  vista pública compartida alineada con la identidad.

### Documentación
- `docs/frontend/ARQUITECTURA.md` actualizado.
- `apps/web/README.md` actualizado.
- Este informe de auditoría y pendientes.

## 4. Verificación ejecutada

```text
cd apps/web
npm run typecheck   # OK
npm run build       # OK (tsc + vite)
```

No se ejecutaron E2E porque requieren el stack completo (API `:3000`, web
`:4173`, PostgreSQL y Edge headless). No se modificó código del API ni
migraciones.

## 5. Pendientes que requieren backend (no simulados)

1. **Generación de documentos** (peticiones, tutelas, contratos, memoriales):
   no hay endpoint ni plantillas en el backend. Pendiente: endpoint de
   generación + editor enriquecido (TipTap u otro) + exportación.
2. **Análisis documental**: no hay extracción PDF/DOCX, resumen, partes,
   cláusulas, obligaciones, riesgos ni comparación. Hoy solo existe indexación
   TXT/MD por proyecto.
3. **Listado de investigaciones guardadas / colecciones / favoritos**: el API
   solo recupera investigación por id. Pendiente: endpoints de listado,
   colecciones, favoritos y notas.
4. **Seguimiento normativo**: no hay versionado, alertas, derogatorias ni
   comparación de versiones en el corpus.
5. **Búsqueda en biblioteca**: existe búsqueda de fragmentos, pero no un
   endpoint de documento por id ni de texto consolidado para navegar el
   documento completo.
6. **Documentos adjuntos en el compositor**: el chat usa archivos del proyecto;
   no hay endpoint de adjunto directo por mensaje. El compositor lo indica.
7. **Biblioteca**: favoritos, colecciones, notas y “documentos relacionados”
   no tienen endpoints. Tampoco hay documento individual ni texto consolidado;
   se muestran metadatos de cobertura y fragmentos de búsqueda.
8. **Metadatos normativos completos**: el corpus expone vigencia, autoridad y
   fecha de consulta; no expone fecha de expedición/publicación, modificaciones
   ni derogatorias, por lo que la UI no las inventa.
9. **Administración**: no hay endpoints de estado de indexación, procesamiento
   documental, consumo de modelos ni auditoría; se muestran usuarios, roles,
   estado y grant reales.
10. **Conversaciones fijadas y edición de preguntas**: sin endpoint de pin ni
    de edición/borrado de mensajes; no se simulan.
11. **Toasts globales y virtualización del hilo**: mejoras de UX/rendimiento
    pendientes, sin dependencia de backend.
12. **Validación jurídica**: la plataforma declara vigencia no garantizada y
    separa fuente/análisis; no se promete exactitud jurídica absoluta.
