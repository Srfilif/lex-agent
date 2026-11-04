# API_COMPATIBILITY.md — contratos congelados + deltas deliberados (Bloque C)

Formas canónicas: `API_SPECIFICATION.md` (raíz). Goldens ejecutables: `docs/backend-refactor/goldens.json` + `scripts/contract_check.py` (9 casos, normaliza `ms/time/db/fecha_consulta/totals`).

## Contratos preservados byte a byte (goldens verdes)

`GET /health`, `GET /search` (vacía incluida: 200 `{error, hits: []}`), `GET /search/chunk/:id` válido, `GET /secop/contracts` con filtros, 404 `{statusCode, message}` en ids bien formados inexistentes.

## Deltas deliberados (entradas inválidas; el frontend envía valores válidos)

| Caso | Antes | Ahora | Motivo (H6) |
|---|---|---|---|
| `top_k`/`limit`/`anio`/valores no numéricos | vacío o 500 | 400 `{statusCode, message}` | error claro en vez de silencio/500 |
| `POST /agent/investigate` sin `pregunta` | 200 `{error}` | 400 | coherencia con el resto |
| UUID malformado (`report`, `investigaciones`, `chunk/:id`) | 404 o 500 | 400 uniforme | identificador malformado ≠ inexistente |
| 500 inesperados | mensaje interno de Nest/pg | `{statusCode: 500, message: 'Internal server error'}` | no filtrar detalles (H-seguridad) |
| Campos larguísimos (q≤500, pregunta≤2000, etc.) | se procesaban | 400 | endurecimiento básico |

Rango (`top_k`, `limit`, `max_pasos`) sigue pinzado en silencio como antes: sin cambios ahí.
