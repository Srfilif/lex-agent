-- 015: marca de inyección en archivos (B10). Aditivo, idempotente.
-- project_files.sospechoso: el texto contenía marcadores de inyección
-- indirecta ("ignora tus instrucciones", etc.). No bloquea (aviso honesto);
-- el agente trata todos los fragmentos como datos no confiables.
-- Aplica: `npm run migrate`. Espejo para DBs frescas en db/init.sql.
ALTER TABLE project_files ADD COLUMN IF NOT EXISTS sospechoso BOOLEAN NOT NULL DEFAULT false;
