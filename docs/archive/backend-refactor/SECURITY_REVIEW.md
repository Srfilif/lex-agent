# SECURITY_REVIEW.md — backend local monousuario (hackatón)

## Estado

- Sin autenticación/autorización (H9, aceptado): API y UI en localhost, un solo operador. **Bloqueante antes de exponer o multiusuario** (módulo H post-MVP).
- Secretos: solo `.env` local (ignorado); `META_API_KEY` nunca en logs (solo `keyConfigured: bool`); `sync`/`ingest` enmascaran DSN.

## Mejoras del refactor (verificadas)

- 500s sanitizados (`HttpExceptionFilter`, unitaria): sin detalles pg/internos.
- Validación de entrada (DTOs + `ValidationPipe` + `ParseUUIDPipe`): tope de longitudes, tipos estrictos, 400 uniformes.
- LIKE escapado (`escapeLike`, H7): `%`/`_` de usuario literales (verificado: 0 resultados).
- `LIMIT` interpolado endurecido (`safeLimit` 1–100).
- Todo el SQL restante parametrizado (`$1…`); greps confirman cero concatenación de input en SQL salvo `LIMIT` validado.

## Pendientes conocidos

- Sin rate-limit (DoS de bolsillo vía `/agent/investigate` — cada llamada cuesta $; solo importa si se expone).
- CORS abierto (`enableCors()` sin origen): correcto para demo local; restringir con dominios al desplegar.
- Juez LLM = mismo modelo que investiga (sesgo; ver CITATION_VERIFICATION.md).
- `Db.raw` aún expuesto (H12): usar solo desde repositorios/CLI migrados; cerrar cuando `secop/agent/verify/report` tengan repositorio propio.
