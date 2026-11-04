-- 005: identidad y sesiones (Fase B SaaS). Idempotente: re-ejecutable sin daño.
-- Aplica: `npm run migrate` (registra en schema_migrations). DBs frescas lo
-- traen vía db/init.sql; el runner lo registra sin re-crear.

CREATE TABLE IF NOT EXISTS schema_migrations (
  name       TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT NOT NULL UNIQUE, -- siempre en minúsculas (dominio Email)
  display_name    TEXT NOT NULL DEFAULT '',
  password_hash   TEXT NOT NULL,        -- $scrypt$v=1$n=..$sal$hash
  email_verified_at TIMESTAMPTZ NULL,
  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'disabled', 'deleted')),
  role            TEXT NOT NULL DEFAULT 'user'
                  CHECK (role IN ('user', 'admin')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

CREATE TABLE IF NOT EXISTS one_time_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('email_verify', 'password_reset')),
  token_hash  TEXT NOT NULL UNIQUE, -- sha256 hex del token (nunca el token)
  expires_at  TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ott_user_kind ON one_time_tokens (user_id, kind);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  refresh_hash TEXT NOT NULL UNIQUE, -- sha256 hex del refresh token
  family       UUID NOT NULL,        -- familia de rotación
  prev_hash    TEXT NULL,            -- hash anterior (detección de reúso)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL, -- caducidad absoluta
  revoked_at   TIMESTAMPTZ NULL,
  revoke_reason TEXT NULL,
  device_label TEXT NULL,
  user_agent   TEXT NULL,            -- truncado a 300 en repo
  ip           TEXT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON auth_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_family ON auth_sessions (family);
CREATE INDEX IF NOT EXISTS idx_sessions_prev ON auth_sessions (prev_hash);

CREATE TABLE IF NOT EXISTS security_events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NULL REFERENCES users (id) ON DELETE SET NULL,
  type       TEXT NOT NULL,
  success    BOOLEAN NOT NULL DEFAULT true,
  ip         TEXT NULL,
  user_agent TEXT NULL,
  meta       JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_secev_user_time ON security_events (user_id, created_at DESC);
