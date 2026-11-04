# API_COMPATIBILITY_SAAS.md — compatibilidad aditiva (Fase B)

Principio (D3): **nada existente cambia**. Todo SaaS es aditivo.

## Preservado (goldens `scripts/contract_check.py` → "contratos intactos")

`GET /health`, `GET /search` (+vacía), `GET /search/chunk/:id`,
`GET /secop/contracts`, `POST /agent/investigate`, `GET /agent/investigaciones/:id`,
`GET /report/:id` — misma forma, mismos códigos, **siguen públicos**.
El frontend actual funciona sin cambios y sin auth.

## Nuevo (sin colisión de rutas)

`/auth/*` (13), `/account/me`, `/account/security/totp/*`, `/admin/*`, `/billing/*`.
Convenciones propias documentadas:

- POST → 201 (default Nest; igual que el existente `/agent/investigate`).
- Errores auth: `{statusCode, message, code}` — el campo extra `code`
  (`credenciales_invalidas`, `reuso_detectado`…) es **solo** en rutas nuevas.
- `GET /account/me` y `/auth/sessions*` exigen `Authorization: Bearer`.

## Deltas aditivos Fase E (autenticados con cuota)

- `POST /agent/investigate` con Bearer y cuota llena → 429
  `{statusCode, message, code:'cuota_agotada'}` (antes: siempre 201).
  Anónimos y con cupo: idéntico.
- Respuesta de investigate autenticada añade `quota:{investigaciones_restantes}`
  (campo nuevo, frontend lo ignora).
- `GET /report/:id` con Bearer atribuye el juez; respuesta idéntica.
- `GET /billing/plans` añade `price_minor`/`currency` (Fase F; ruta nueva en E,
  sin consumidores legacy).
- `main.ts` sin cambios de comportamiento salvo `rawBody: true` (aditivo).

## Decisiones que NO se tomaron (y por qué)

- No se protegió `/agent/investigate` con auth: rompería el frontend/demo.
  El control de gasto llega en Fase E (cuotas por usuario autenticado;
  anónimo = legacy documentado). Recomendación prod: exigir auth o exponer
  tras gateway con API key (ver `SECURITY_OPERATIONS.md` en Fase H).
- No se versionó la API (`/v1`): sin ruptura no hay necesidad.
