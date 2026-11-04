-- 009: cuenta y preferencias (Fase G SaaS). Idempotente.
-- Aplica: `npm run migrate`. Espejo para DBs frescas en db/init.sql.
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id    UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  data       JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ NULL;

ALTER TABLE one_time_tokens ADD COLUMN IF NOT EXISTS new_email TEXT NULL;
ALTER TABLE one_time_tokens DROP CONSTRAINT IF EXISTS one_time_tokens_kind_check;
ALTER TABLE one_time_tokens ADD CONSTRAINT one_time_tokens_kind_check CHECK (
  kind IN ('email_verify', 'password_reset', 'email_change', 'account_delete')
);
