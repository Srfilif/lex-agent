-- 012: archivos de usuario por proyecto (B6). Idempotente.
-- Aplica: `npm run migrate`. Espejo para DBs frescas en db/init.sql.
CREATE TABLE IF NOT EXISTS project_files (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  filename     TEXT NOT NULL,
  mime         TEXT NOT NULL,
  size_bytes   INTEGER NOT NULL,
  sha256       TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('ready', 'failed')),
  error        TEXT NULL,
  chunk_count  INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, sha256)
);
CREATE INDEX IF NOT EXISTS idx_pfile_proj ON project_files (project_id);

CREATE TABLE IF NOT EXISTS project_chunks (
  chunk_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id         UUID NOT NULL REFERENCES project_files (id) ON DELETE CASCADE,
  project_id      UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  n               INTEGER NOT NULL,
  ruta            TEXT NOT NULL,
  texto           TEXT NOT NULL,
  texto_contexto  TEXT NOT NULL,
  embedding       vector(1024),
  fts             tsvector GENERATED ALWAYS AS (
                    to_tsvector('lex_spanish', coalesce(texto_contexto, '') || ' ' || texto)
                  ) STORED
);
CREATE INDEX IF NOT EXISTS idx_pchunk_proj ON project_chunks (project_id);
CREATE INDEX IF NOT EXISTS idx_pchunk_file ON project_chunks (file_id);
CREATE INDEX IF NOT EXISTS idx_pchunk_fts ON project_chunks USING GIN (fts);
CREATE INDEX IF NOT EXISTS idx_pchunk_embedding ON project_chunks USING hnsw (embedding vector_cosine_ops);
