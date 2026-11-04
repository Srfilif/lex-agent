-- 016: temas por conversación (B11). Aditivo, idempotente.
-- conversations.topics: etiquetas cortas detectadas junto al título
-- (misma llamada barata). Se muestran en el hilo; no filtran nada aún.
-- Aplica: `npm run migrate`. Espejo para DBs frescas en db/init.sql.
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS topics TEXT[] NOT NULL DEFAULT '{}';
