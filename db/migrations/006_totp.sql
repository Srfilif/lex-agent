-- 006: TOTP + códigos de recuperación (Fase C SaaS). Idempotente.
-- Aplica: `npm run migrate`. Espejo para DBs frescas en db/init.sql.
CREATE TABLE IF NOT EXISTS totp_configs (
  user_id      UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  secret_enc   TEXT NOT NULL, -- v1:<ivB64u>.<ctB64u> (AES-256-GCM, clave externa)
  status       TEXT NOT NULL CHECK (status IN ('pending', 'active')),
  last_counter BIGINT NOT NULL DEFAULT -1, -- anti-replay TOTP
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS recovery_codes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  code_hash  TEXT NOT NULL UNIQUE, -- sha256 del código normalizado
  used_at    TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rec_user ON recovery_codes (user_id);
