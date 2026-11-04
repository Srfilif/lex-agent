-- 002: FTS español insensible a acentos (aplica init.sql actualizado a DBs vivas).
CREATE EXTENSION IF NOT EXISTS unaccent;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'lex_spanish') THEN
    CREATE TEXT SEARCH CONFIGURATION lex_spanish (COPY = spanish);
  END IF;
END $$;
ALTER TEXT SEARCH CONFIGURATION lex_spanish
  ALTER MAPPING FOR hword, hword_part, word WITH unaccent, spanish_stem;
ALTER TABLE chunks DROP COLUMN IF EXISTS fts;
ALTER TABLE chunks ADD COLUMN fts tsvector GENERATED ALWAYS AS (
  to_tsvector('lex_spanish', coalesce(texto_contexto, '') || ' ' || texto)
) STORED;
DROP INDEX IF EXISTS idx_chunks_fts;
CREATE INDEX idx_chunks_fts ON chunks USING GIN (fts);
