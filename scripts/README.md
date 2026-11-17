# scripts/ — desarrollo local y operación

- `node scripts/dev.mjs` (`npm run dev` desde la raíz): API + web sin Docker
  con el `.env` de la raíz (deriva `VITE_API_URL` del `PORT`).
- Los humos y evals viven en `tests/`.

- `node scripts/backup_db.mjs [salida]` — dump Postgres (custom format) a
  `backups/`. Nunca commitear los dumps (contienen datos de usuarios).
- `node scripts/restore_db.mjs <dump>` — restore de prueba a BD temporal
  con verificación de integridad.

Los humos (`tests/smoke/`), evals (`tests/eval/`) y E2E (`tests/e2e/`) están
documentados en `tests/README.md`.
