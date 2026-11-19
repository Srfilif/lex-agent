-- 020: control de acceso (whitelist + códigos de invitación). Idempotente.
-- Los ids se generan en aplicación (uuid); solo la forma vive aquí.

CREATE TABLE IF NOT EXISTS access_whitelist (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern    TEXT NOT NULL UNIQUE, -- correo exacto o *@dominio, minúsculas
  label      TEXT NULL,
  created_by UUID NULL REFERENCES users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS access_codes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash   TEXT NOT NULL UNIQUE, -- sha256 hex del código normalizado
  label       TEXT NULL,
  max_uses    INTEGER NOT NULL DEFAULT 1 CHECK (max_uses >= 1),
  used_count  INTEGER NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  expires_at  TIMESTAMPTZ NULL,
  revoked_at  TIMESTAMPTZ NULL,
  created_by  UUID NULL REFERENCES users (id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
