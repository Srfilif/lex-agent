-- 014: memoria de chat (B8). Aditivo, idempotente.
-- conversations.summary (+summary_count): resumen rodante de los mensajes
-- más antiguos para compactar contexto en hilos largos.
-- user_memories: hechos duraderos del usuario (memoria cruzada opt-in;
-- solo se lee/escribe con ai.crossMemory=true). Borrado explícito en
-- deleteAccount (la fila users se anonimiza, no se borra: CASCADE no dispara).
-- Aplica: `npm run migrate`. Espejo para DBs frescas en db/init.sql.
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS summary TEXT NULL;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS summary_count INTEGER NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS user_memories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  fact       TEXT NOT NULL CHECK (fact <> '' AND char_length(fact) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mem_user ON user_memories (user_id, created_at);
