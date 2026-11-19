-- Kelsyx — esquema sqlite (DATABASE_PROVIDER=sqlite, dev local sin Postgres).
-- Espejo de db/init.sql (estado final). Lo aplica `npm run migrate` una vez
-- (tracking: schema_migrations='sqlite_schema'). Diferencias deliberadas:
--   - Sin extensiones (vector/pg_trgm/unaccent) ni tsvector/lex_spanish/HNSW.
--   - embedding = TEXT con JSON '[...]'; la similitud se calcula en JS.
--   - topics TEXT[] → TEXT con JSON; BOOLEAN → INTEGER 0/1.
--   - Timestamps = TEXT ISO-UTC ('...T...Z'), igual que los params Date.
-- No editar a mano en caliente: borra el .sqlite y re-ejecuta migrate/seed.

CREATE TABLE IF NOT EXISTS documents (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || '4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  titulo        TEXT NOT NULL,
  emisor        TEXT NOT NULL,
  tipo          TEXT NOT NULL,
  fecha         TEXT,
  numero        TEXT,
  jurisdiccion  TEXT DEFAULT 'CO',
  tema          TEXT,
  url_original  TEXT NOT NULL,
  fecha_consulta TEXT NOT NULL,
  version       TEXT DEFAULT 'texto_original',
  hash_contenido TEXT UNIQUE NOT NULL,
  estado_procesamiento TEXT NOT NULL DEFAULT 'pendiente',
  autoridad     TEXT NOT NULL DEFAULT 'interpretativa'
                CHECK (autoridad IN ('vinculante', 'interpretativa', 'opinion')),
  vigencia      TEXT NOT NULL DEFAULT 'vigencia_desconocida'
                CHECK (vigencia IN ('texto_original', 'modificado', 'consolidado',
                                    'vigencia_verificada', 'vigencia_desconocida')),
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_documents_tipo ON documents (tipo);
CREATE INDEX IF NOT EXISTS idx_documents_tema ON documents (tema);
CREATE INDEX IF NOT EXISTS idx_documents_numero ON documents (numero);

CREATE TABLE IF NOT EXISTS chunks (
  chunk_id       TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || '4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  doc_id         TEXT NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
  ruta           TEXT NOT NULL,
  offset_inicio  INTEGER NOT NULL,
  offset_fin     INTEGER NOT NULL,
  pagina         INTEGER,
  texto          TEXT NOT NULL,
  texto_contexto TEXT NOT NULL DEFAULT '',
  embedding      TEXT,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_chunks_doc ON chunks (doc_id);

CREATE TABLE IF NOT EXISTS secop_contratos (
  id                         TEXT PRIMARY KEY,
  nombre_entidad             TEXT,
  nit_entidad                TEXT,
  departamento               TEXT,
  ciudad                     TEXT,
  proceso_de_compra          TEXT,
  id_contrato                TEXT,
  referencia_del_contrato    TEXT,
  estado_contrato            TEXT,
  descripcion_del_proceso    TEXT,
  objeto_del_contrato        TEXT,
  tipo_de_contrato           TEXT,
  modalidad_de_contratacion  TEXT,
  fecha_de_firma             TEXT,
  fecha_de_inicio_del_contrato TEXT,
  fecha_de_fin_del_contrato  TEXT,
  proveedor_adjudicado       TEXT,
  documento_proveedor        TEXT,
  valor_del_contrato         NUMERIC,
  valor_facturado            NUMERIC,
  valor_pagado               NUMERIC,
  dias_adicionados           NUMERIC,
  urlproceso                 TEXT,
  ultima_actualizacion       TEXT,
  synced_at                  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_secop_entidad ON secop_contratos (nombre_entidad);
CREATE INDEX IF NOT EXISTS idx_secop_proveedor ON secop_contratos (proveedor_adjudicado);
CREATE INDEX IF NOT EXISTS idx_secop_firma ON secop_contratos (fecha_de_firma DESC);
CREATE INDEX IF NOT EXISTS idx_secop_valor ON secop_contratos (valor_del_contrato);

CREATE TABLE IF NOT EXISTS schema_migrations (
  name       TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || '4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  email           TEXT NOT NULL UNIQUE,
  display_name    TEXT NOT NULL DEFAULT '',
  password_hash   TEXT NOT NULL,
  email_verified_at TEXT NULL,
  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'disabled', 'deleted')),
  role            TEXT NOT NULL DEFAULT 'user'
                  CHECK (role IN ('user', 'admin')),
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deletion_requested_at TEXT NULL,
  terms_version       TEXT NULL,
  terms_accepted_at   TEXT NULL,
  privacy_version     TEXT NULL,
  privacy_accepted_at TEXT NULL
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

CREATE TABLE IF NOT EXISTS one_time_tokens (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || '4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  user_id     TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('email_verify', 'password_reset', 'email_change', 'account_delete')),
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TEXT NOT NULL,
  consumed_at TEXT NULL,
  new_email   TEXT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_ott_user_kind ON one_time_tokens (user_id, kind);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || '4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  user_id      TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  refresh_hash TEXT NOT NULL UNIQUE,
  family       TEXT NOT NULL,
  prev_hash    TEXT NULL,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  last_seen_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  expires_at   TEXT NOT NULL,
  revoked_at   TEXT NULL,
  revoke_reason TEXT NULL,
  device_label TEXT NULL,
  user_agent   TEXT NULL,
  ip           TEXT NULL,
  mfa_ok       INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON auth_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_family ON auth_sessions (family);
CREATE INDEX IF NOT EXISTS idx_sessions_prev ON auth_sessions (prev_hash);

CREATE TABLE IF NOT EXISTS security_events (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || '4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  user_id    TEXT NULL REFERENCES users (id) ON DELETE SET NULL,
  type       TEXT NOT NULL,
  success    INTEGER NOT NULL DEFAULT 1,
  ip         TEXT NULL,
  user_agent TEXT NULL,
  meta       TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_secev_user_time ON security_events (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS totp_configs (
  user_id      TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  secret_enc   TEXT NOT NULL,
  status       TEXT NOT NULL CHECK (status IN ('pending', 'active')),
  last_counter INTEGER NOT NULL DEFAULT -1,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  confirmed_at TEXT NULL
);

CREATE TABLE IF NOT EXISTS recovery_codes (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || '4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  code_hash  TEXT NOT NULL UNIQUE,
  used_at    TEXT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_rec_user ON recovery_codes (user_id);

CREATE TABLE IF NOT EXISTS plans (
  code        TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  active      INTEGER NOT NULL DEFAULT 1,
  version     INTEGER NOT NULL DEFAULT 1,
  price_minor INTEGER NULL,
  currency    TEXT NOT NULL DEFAULT 'COP',
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS plan_entitlements (
  plan_code TEXT NOT NULL REFERENCES plans (code),
  key       TEXT NOT NULL,
  value     TEXT NOT NULL,
  PRIMARY KEY (plan_code, key)
);
CREATE TABLE IF NOT EXISTS subscriptions (
  id                   TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || '4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  user_id              TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  plan_code            TEXT NOT NULL REFERENCES plans (code),
  status               TEXT NOT NULL CHECK (status IN
                         ('trialing', 'active', 'past_due', 'canceled', 'expired')),
  current_period_start TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  current_period_end   TEXT NOT NULL,
  cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
  created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_subs_user ON subscriptions (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_subs_user_viva ON subscriptions (user_id)
  WHERE status IN ('trialing', 'active', 'past_due');
CREATE TABLE IF NOT EXISTS usage_events (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || '4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  user_id         TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  kind            TEXT NOT NULL,
  units           INTEGER NOT NULL DEFAULT 0,
  tokens_in       INTEGER NOT NULL DEFAULT 0,
  tokens_out      INTEGER NOT NULL DEFAULT 0,
  cost_usd        NUMERIC,
  idempotency_key TEXT NOT NULL UNIQUE,
  ref_type        TEXT NULL,
  ref_id          TEXT NULL,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_usage_user_time ON usage_events (user_id, created_at DESC);
CREATE TABLE IF NOT EXISTS usage_periods (
  user_id        TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  period         TEXT NOT NULL,
  investigations INTEGER NOT NULL DEFAULT 0,
  tokens         INTEGER NOT NULL DEFAULT 0,
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (user_id, period)
);
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
  ('plus', 'modelos', 'muse-spark-1.3,muse-wonder-1.0'),
  ('pro', 'investigaciones_mes', '2000'),
  ('pro', 'tokens_mes', '20000000'),
  ('pro', 'max_pasos', '10'),
  ('pro', 'modelos', 'muse-spark-1.3,muse-wonder-1.0,muse-spark-1.2')
ON CONFLICT (plan_code, key) DO NOTHING;
UPDATE plans SET price_minor = 29900 WHERE code = 'plus' AND price_minor IS NULL;
UPDATE plans SET price_minor = 79900 WHERE code = 'pro' AND price_minor IS NULL;

CREATE TABLE IF NOT EXISTS payments (
  id                  TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || '4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  user_id             TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  subscription_id     TEXT NULL REFERENCES subscriptions (id) ON DELETE SET NULL,
  provider            TEXT NOT NULL,
  provider_payment_id TEXT NOT NULL,
  plan_code           TEXT NOT NULL,
  amount_minor        INTEGER NOT NULL CHECK (amount_minor >= 0),
  currency            TEXT NOT NULL,
  status              TEXT NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (provider, provider_payment_id)
);
CREATE INDEX IF NOT EXISTS idx_pay_user ON payments (user_id);
CREATE TABLE IF NOT EXISTS webhook_events (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || '4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  provider          TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  type              TEXT NOT NULL,
  payload           TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'processed'
                    CHECK (status IN ('processed', 'ignored', 'failed')),
  received_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (provider, provider_event_id)
);
CREATE TABLE IF NOT EXISTS subscription_events (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || '4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  subscription_id TEXT NOT NULL REFERENCES subscriptions (id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  type            TEXT NOT NULL,
  from_status     TEXT NULL,
  to_status       TEXT NULL,
  meta            TEXT NOT NULL DEFAULT '{}',
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_subsev_sub ON subscription_events (subscription_id, created_at);

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id    TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  data       TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS conversations (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || '4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  user_id     TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  title       TEXT NOT NULL DEFAULT 'Nueva conversación',
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  archived_at TEXT NULL,
  project_id  TEXT NULL REFERENCES projects (id) ON DELETE SET NULL,
  summary     TEXT NULL,
  summary_count INTEGER NOT NULL DEFAULT 0,
  topics      TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_conv_user ON conversations (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conv_project ON conversations (project_id);

CREATE TABLE IF NOT EXISTS messages (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || '4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  conversation_id TEXT NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content         TEXT NOT NULL,
  citations       TEXT NOT NULL DEFAULT '[]',
  usage           TEXT NULL,
  cost_usd        NUMERIC NULL,
  model           TEXT NULL,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_msg_conv ON messages (conversation_id, created_at, id);

CREATE TABLE IF NOT EXISTS projects (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || '4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  user_id      TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  instructions TEXT NOT NULL DEFAULT '',
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_proj_user ON projects (user_id, updated_at DESC);
CREATE TABLE IF NOT EXISTS share_links (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || '4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  conversation_id TEXT NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  token           TEXT NOT NULL UNIQUE,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  revoked_at      TEXT NULL
);
CREATE INDEX IF NOT EXISTS idx_share_conv ON share_links (conversation_id);

CREATE TABLE IF NOT EXISTS project_files (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || '4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  project_id   TEXT NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  filename     TEXT NOT NULL,
  mime         TEXT NOT NULL,
  size_bytes   INTEGER NOT NULL,
  sha256       TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('ready', 'failed')),
  error        TEXT NULL,
  chunk_count  INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  sospechoso   INTEGER NOT NULL DEFAULT 0,
  UNIQUE (project_id, sha256)
);
CREATE INDEX IF NOT EXISTS idx_pfile_proj ON project_files (project_id);
CREATE TABLE IF NOT EXISTS project_chunks (
  chunk_id        TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || '4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  file_id         TEXT NOT NULL REFERENCES project_files (id) ON DELETE CASCADE,
  project_id      TEXT NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  n               INTEGER NOT NULL,
  ruta            TEXT NOT NULL,
  texto           TEXT NOT NULL,
  texto_contexto  TEXT NOT NULL,
  embedding       TEXT
);
CREATE INDEX IF NOT EXISTS idx_pchunk_proj ON project_chunks (project_id);
CREATE INDEX IF NOT EXISTS idx_pchunk_file ON project_chunks (file_id);

CREATE TABLE IF NOT EXISTS investigaciones (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || '4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  pregunta   TEXT NOT NULL,
  traza      TEXT NOT NULL,
  respuesta  TEXT NOT NULL,
  usage      TEXT NOT NULL,
  costo_usd  NUMERIC,
  user_id    TEXT NULL REFERENCES users (id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_inv_user ON investigaciones (user_id);

CREATE TABLE IF NOT EXISTS user_memories (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || '4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  fact       TEXT NOT NULL CHECK (fact <> '' AND length(fact) <= 500),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_mem_user ON user_memories (user_id, created_at);

-- Control de acceso (espejo de db/migrations/020_access.sql; ids desde app).
CREATE TABLE IF NOT EXISTS access_whitelist (
  id         TEXT PRIMARY KEY,
  pattern    TEXT NOT NULL UNIQUE,
  label      TEXT NULL,
  created_by TEXT NULL REFERENCES users (id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS access_codes (
  id          TEXT PRIMARY KEY,
  code_hash   TEXT NOT NULL UNIQUE,
  label       TEXT NULL,
  max_uses    INTEGER NOT NULL DEFAULT 1 CHECK (max_uses >= 1),
  used_count  INTEGER NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  expires_at  TEXT NULL,
  revoked_at  TEXT NULL,
  created_by  TEXT NULL REFERENCES users (id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
