# scripts/ — operación de base de datos

Solo utilidades ops (los humos y evals viven en `tests/`).

- `node scripts/backup_db.mjs [salida]` — dump Postgres (custom format) a
  `backups/`. Nunca commitear los dumps (contienen datos de usuarios).
- `node scripts/restore_db.mjs <dump>` — restore de prueba a BD temporal
  con verificación de integridad.

Los humos (`tests/smoke/`), evals (`tests/eval/`) y E2E (`tests/e2e/`) están
documentados en `tests/README.md`.
