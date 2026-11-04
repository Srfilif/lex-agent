# DATABASE_SCHEMA_SAAS.md — esquema SaaS (aditivo, idempotente)

Fuente ejecutable: `db/migrations/00{5..9}_*.sql` + espejo en `db/init.sql`
(solo para volúmenes frescos). Runner: `npm run migrate` (tabla
`schema_migrations`, baseline: ≤004 aplicados a mano, ≥005 por runner).
Todo `IF NOT EXISTS`; re-ejecutable sin daño.

## 005_identity (Fase B)

```sql
users(id UUID PK DEFAULT gen_random_uuid(), email TEXT NOT NULL UNIQUE, -- minúsculas
  display_name TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,                 -- $scrypt$v=1$n=..$sal$hash
  email_verified_at TIMESTAMPTZ NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled','deleted')),
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
one_time_tokens(id UUID PK DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('email_verify','password_reset')),
  token_hash TEXT NOT NULL UNIQUE,             -- sha256(token), nunca el token
  expires_at TIMESTAMPTZ NOT NULL, consumed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now());
auth_sessions(id UUID PK DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_hash TEXT NOT NULL UNIQUE,           -- sha256(refresh)
  family UUID NOT NULL, prev_hash TEXT NULL,   -- rotación + detección reúso
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,             -- absoluta
  revoked_at TIMESTAMPTZ NULL, revoke_reason TEXT NULL,
  device_label TEXT NULL, user_agent TEXT NULL, ip TEXT NULL);
security_events(id UUID PK DEFAULT gen_random_uuid(),
  user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  type TEXT NOT NULL, success BOOLEAN NOT NULL DEFAULT true,
  ip TEXT NULL, user_agent TEXT NULL, meta JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now());
-- índices: users(email), one_time_tokens(user_id,kind), auth_sessions(user_id),
-- auth_sessions(family), auth_sessions(prev_hash), security_events(user_id,created_at)
```

Retención: sesiones revocadas/expiradas purgables tras 90 días (job futuro);
`security_events` 1 año; tokens de un uso se borran al consumir/expirar (purga).

## 006_totp (Fase C, previsto)

```sql
totp_configs(user_id UUID PK REFERENCES users(id) ON DELETE CASCADE,
  secret_enc TEXT NOT NULL, -- v1:gcm:iv:ct (AES-256-GCM, clave externa)
  status TEXT NOT NULL CHECK (status IN ('pending','active')),
  last_counter BIGINT NOT NULL DEFAULT -1,   -- anti-replay
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ NULL);
recovery_codes(id UUID PK DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL UNIQUE, used_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now());
```

## 007_billing / 008_payments / 009_account (previsto, Fases E–G)

`plans` (catálogo seed), `plan_entitlements(plan,clave,valor)`,
`subscriptions(user_id, plan, status, current_period_end, cancel_at_period_end,
provider, provider_sub_id)`, `subscription_events`, `usage_events(idempotency_key
UNIQUE, user_id, kind, units, tokens_in/out, cost_usd, ref)`, `usage_periods`,
`payments(provider, provider_payment_id UNIQUE, amount, currency, status)`,
`webhook_events(provider_event_id UNIQUE, type, payload, processed_at)`,
`user_preferences(user_id PK, data JSONB)`, + `investigaciones.user_id` nulable.
Detalle al implementar cada fase.
