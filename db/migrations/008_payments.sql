-- 008: pagos y webhooks (Fase F SaaS). Idempotente.
-- Aplica: `npm run migrate`. Espejo para DBs frescas en db/init.sql.
ALTER TABLE plans ADD COLUMN IF NOT EXISTS price_minor INT NULL;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'COP';
-- Precios de EJEMPLO sandbox (no son precios Wompi reales ni oferta comercial).
UPDATE plans SET price_minor = 29900 WHERE code = 'plus' AND price_minor IS NULL;
UPDATE plans SET price_minor = 79900 WHERE code = 'pro' AND price_minor IS NULL;
-- free queda NULL (gratis, sin checkout).

-- Cobros únicos del proveedor (nunca datos de tarjeta).
CREATE TABLE IF NOT EXISTS payments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  subscription_id     UUID NULL REFERENCES subscriptions (id) ON DELETE SET NULL,
  provider            TEXT NOT NULL, -- 'sandbox' (Fase F); 'wompi' futuro
  provider_payment_id TEXT NOT NULL,
  plan_code           TEXT NOT NULL,
  amount_minor        INT NOT NULL CHECK (amount_minor >= 0),
  currency            TEXT NOT NULL,
  status              TEXT NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_payment_id)
);
CREATE INDEX IF NOT EXISTS idx_pay_user ON payments (user_id);

-- Registro de webhooks (idempotencia + auditoría + reintentos).
CREATE TABLE IF NOT EXISTS webhook_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider          TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  type              TEXT NOT NULL,
  payload           JSONB NOT NULL,
  status            TEXT NOT NULL DEFAULT 'processed'
                    CHECK (status IN ('processed', 'ignored', 'failed')),
  received_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_event_id)
);

-- Historial de suscripción (auditoría de transiciones).
CREATE TABLE IF NOT EXISTS subscription_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions (id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  type            TEXT NOT NULL, -- grant|checkout|pago_ok|pago_fallo|cancelacion|
                                 -- reactivacion|cambio_plan|reembolso|expiracion
  from_status     TEXT NULL,
  to_status       TEXT NULL,
  meta            JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_subsev_sub ON subscription_events (subscription_id, created_at);
