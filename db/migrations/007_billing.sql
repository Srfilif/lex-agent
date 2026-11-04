-- 007: planes, suscripciones y medición de uso (Fase E SaaS). Idempotente.
-- Aplica: `npm run migrate`. Espejo para DBs frescas en db/init.sql.
CREATE TABLE IF NOT EXISTS plans (
  code        TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  active      BOOLEAN NOT NULL DEFAULT true,
  version     INT NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Límites como datos (nunca condicionales en código). Claves:
-- investigaciones_mes INT, tokens_mes INT, max_pasos INT, modelos CSV.
CREATE TABLE IF NOT EXISTS plan_entitlements (
  plan_code TEXT NOT NULL REFERENCES plans (code),
  key       TEXT NOT NULL,
  value     TEXT NOT NULL,
  PRIMARY KEY (plan_code, key)
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  plan_code            TEXT NOT NULL REFERENCES plans (code),
  status               TEXT NOT NULL CHECK (status IN
                         ('trialing', 'active', 'past_due', 'canceled', 'expired')),
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_end   TIMESTAMPTZ NOT NULL,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_subs_user ON subscriptions (user_id);
-- Invariante: una sola suscripción viva por usuario.
CREATE UNIQUE INDEX IF NOT EXISTS idx_subs_user_viva ON subscriptions (user_id)
  WHERE status IN ('trialing', 'active', 'past_due');

CREATE TABLE IF NOT EXISTS usage_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  kind            TEXT NOT NULL, -- investigacion | investigacion_tokens | verificacion
  units           INT NOT NULL DEFAULT 0,
  tokens_in       INT NOT NULL DEFAULT 0,
  tokens_out      INT NOT NULL DEFAULT 0,
  cost_usd        NUMERIC,
  idempotency_key TEXT NOT NULL UNIQUE,
  ref_type        TEXT NULL,
  ref_id          TEXT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_usage_user_time ON usage_events (user_id, created_at DESC);

-- Contadores mensuales para chequeo-y-descuento atómico.
CREATE TABLE IF NOT EXISTS usage_periods (
  user_id        UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  period         TEXT NOT NULL, -- YYYY-MM (UTC)
  investigations INT NOT NULL DEFAULT 0,
  tokens         BIGINT NOT NULL DEFAULT 0,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, period)
);

-- Atribución opcional investigación→usuario (anonimato legacy = NULL).
ALTER TABLE investigaciones ADD COLUMN IF NOT EXISTS user_id UUID NULL
  REFERENCES users (id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_inv_user ON investigaciones (user_id);

-- Catálogo semilla (idempotente).
INSERT INTO plans (code, name, description) VALUES
  ('free', 'Free', 'Plan gratuito: investigación esencial con límites mensuales.'),
  ('plus', 'Plus', 'Plan intermedio: más investigaciones y tokens.'),
  ('pro', 'Pro', 'Plan profesional: alto volumen y pasos extendidos.')
ON CONFLICT (code) DO NOTHING;
INSERT INTO plan_entitlements (plan_code, key, value) VALUES
  ('free', 'investigaciones_mes', '20'),
  ('free', 'tokens_mes', '200000'),
  ('free', 'max_pasos', '6'),
  ('free', 'modelos', 'muse-spark-1.3'),
  ('plus', 'investigaciones_mes', '200'),
  ('plus', 'tokens_mes', '2000000'),
  ('plus', 'max_pasos', '8'),
  ('plus', 'modelos', 'muse-spark-1.3'),
  ('pro', 'investigaciones_mes', '2000'),
  ('pro', 'tokens_mes', '20000000'),
  ('pro', 'max_pasos', '10'),
  ('pro', 'modelos', 'muse-spark-1.3')
ON CONFLICT (plan_code, key) DO NOTHING;
