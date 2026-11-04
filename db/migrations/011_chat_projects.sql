-- 011: proyectos + enlaces compartidos (B5/B9). Idempotente.
-- Aplica: `npm run migrate`. Espejo para DBs frescas en db/init.sql.
CREATE TABLE IF NOT EXISTS projects (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  instructions TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_proj_user ON projects (user_id, updated_at DESC);

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS project_id UUID NULL REFERENCES projects (id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_conv_project ON conversations (project_id);

CREATE TABLE IF NOT EXISTS share_links (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  token           TEXT NOT NULL UNIQUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at      TIMESTAMPTZ NULL
);
CREATE INDEX IF NOT EXISTS idx_share_conv ON share_links (conversation_id);
