-- Kelsyx AI — esquema base (Día 1). Fuente de verdad del modelo de datos.
-- Ver docs/arquitectura/RAG_DESIGN.md (metadatos, fragmentación) y docs/arquitectura/DATABASE_SCHEMA.md (resumen).

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Español insensible a acentos: 'contratacion' debe hallar 'contratación'.
CREATE TEXT SEARCH CONFIGURATION lex_spanish (COPY = spanish);
ALTER TEXT SEARCH CONFIGURATION lex_spanish
  ALTER MAPPING FOR hword, hword_part, word WITH unaccent, spanish_stem;

-- Documentos jurídicos del corpus (normas, sentencias, conceptos...)
CREATE TABLE documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo        TEXT NOT NULL,
  emisor        TEXT NOT NULL,           -- Corte Constitucional, Congreso, etc.
  tipo          TEXT NOT NULL,           -- constitucion, ley, decreto, sentencia, concepto, doctrina, opinion
  fecha         DATE,
  numero        TEXT,                    -- "80/1993", "C-123/24"...
  jurisdiccion  TEXT DEFAULT 'CO',
  tema          TEXT,                    -- contratacion_estatal, ...
  url_original  TEXT NOT NULL,
  fecha_consulta DATE NOT NULL,
  version       TEXT DEFAULT 'texto_original',
  hash_contenido TEXT UNIQUE NOT NULL,   -- sha256 del texto normalizado
  estado_procesamiento TEXT NOT NULL DEFAULT 'pendiente', -- pendiente, procesado, error
  autoridad     TEXT NOT NULL DEFAULT 'interpretativa'
                CHECK (autoridad IN ('vinculante', 'interpretativa', 'opinion')),
  vigencia      TEXT NOT NULL DEFAULT 'vigencia_desconocida'
                CHECK (vigencia IN ('texto_original', 'modificado', 'consolidado',
                                    'vigencia_verificada', 'vigencia_desconocida')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_documents_tipo ON documents (tipo);
CREATE INDEX idx_documents_tema ON documents (tema);
CREATE INDEX idx_documents_numero ON documents (numero);

-- Fragmentos estructurales citables (cada cita resuelve a un chunk_id)
CREATE TABLE chunks (
  chunk_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id         UUID NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
  ruta           TEXT NOT NULL,           -- 'Ley 80/1993 > Art. 24 > num. 1'
  offset_inicio  INT NOT NULL,
  offset_fin     INT NOT NULL,
  pagina         INT,
  texto          TEXT NOT NULL,
  texto_contexto TEXT NOT NULL DEFAULT '', -- encabezados/sección para contexto
  -- Dimensión provisional 1024 (e5-large / bge-m3). Migrar si el modelo final difiere (Q1).
  embedding      vector(1024),
  fts            tsvector GENERATED ALWAYS AS (
                   to_tsvector('lex_spanish', coalesce(texto_contexto, '') || ' ' || texto)
                 ) STORED,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_chunks_doc ON chunks (doc_id);
CREATE INDEX idx_chunks_fts ON chunks USING GIN (fts);
CREATE INDEX idx_chunks_embedding ON chunks USING hnsw (embedding vector_cosine_ops);

-- Caché sincronizado SECOP II Contratos Electrónicos (jbjy-vk9h).
-- Ver db/migrations/003_secop_contratos.sql (misma definición para DBs vivas).
CREATE TABLE secop_contratos (
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
  fecha_de_firma             TIMESTAMPTZ,
  fecha_de_inicio_del_contrato TIMESTAMPTZ,
  fecha_de_fin_del_contrato  TIMESTAMPTZ,
  proveedor_adjudicado       TEXT,
  documento_proveedor        TEXT,
  valor_del_contrato         NUMERIC,
  valor_facturado            NUMERIC,
  valor_pagado               NUMERIC,
  dias_adicionados           NUMERIC,
  urlproceso                 TEXT,
  ultima_actualizacion       TIMESTAMPTZ,
  synced_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_secop_entidad ON secop_contratos (nombre_entidad);
CREATE INDEX idx_secop_proveedor ON secop_contratos (proveedor_adjudicado);
CREATE INDEX idx_secop_firma ON secop_contratos (fecha_de_firma DESC);
CREATE INDEX idx_secop_valor ON secop_contratos (valor_del_contrato);

-- Migraciones 002-004 aplicadas arriba (DBs frescas nacen al día).
-- 005+ (identidad SaaS...): ver db/migrations/00[5-9]*.sql — se espejan abajo
-- para volúmenes frescos; DBs vivas usan `npm run migrate`.

CREATE TABLE IF NOT EXISTS schema_migrations (
  name       TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Identidad y sesiones (espejo de db/migrations/005_identity.sql).
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT NOT NULL UNIQUE,
  display_name    TEXT NOT NULL DEFAULT '',
  password_hash   TEXT NOT NULL,
  email_verified_at TIMESTAMPTZ NULL,
  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'disabled', 'deleted')),
  role            TEXT NOT NULL DEFAULT 'user'
                  CHECK (role IN ('user', 'admin')),
  terms_version       TEXT NULL, -- espejo de migrations/019_consents.sql
  terms_accepted_at   TIMESTAMPTZ NULL,
  privacy_version     TEXT NULL,
  privacy_accepted_at TIMESTAMPTZ NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

CREATE TABLE IF NOT EXISTS one_time_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('email_verify', 'password_reset')),
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ott_user_kind ON one_time_tokens (user_id, kind);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  refresh_hash TEXT NOT NULL UNIQUE,
  family       UUID NOT NULL,
  prev_hash    TEXT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL,
  revoked_at   TIMESTAMPTZ NULL,
  revoke_reason TEXT NULL,
  device_label TEXT NULL,
  user_agent   TEXT NULL,
  ip           TEXT NULL,
  mfa_ok       BOOLEAN NOT NULL DEFAULT false -- 017: sesión emitida tras MFA
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

-- TOTP (espejo de db/migrations/006_totp.sql).
CREATE TABLE IF NOT EXISTS totp_configs (
  user_id      UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  secret_enc   TEXT NOT NULL,
  status       TEXT NOT NULL CHECK (status IN ('pending', 'active')),
  last_counter BIGINT NOT NULL DEFAULT -1,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS recovery_codes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  code_hash  TEXT NOT NULL UNIQUE,
  used_at    TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rec_user ON recovery_codes (user_id);

-- Billing (espejo de db/migrations/007_billing.sql).
CREATE TABLE IF NOT EXISTS plans (
  code        TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  active      BOOLEAN NOT NULL DEFAULT true,
  version     INT NOT NULL DEFAULT 1,
  price_minor INT NULL, -- 008: ejemplo sandbox (NULL = gratis)
  currency    TEXT NOT NULL DEFAULT 'COP',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
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
CREATE UNIQUE INDEX IF NOT EXISTS idx_subs_user_viva ON subscriptions (user_id)
  WHERE status IN ('trialing', 'active', 'past_due');
CREATE TABLE IF NOT EXISTS usage_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  kind            TEXT NOT NULL,
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
CREATE TABLE IF NOT EXISTS usage_periods (
  user_id        UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  period         TEXT NOT NULL,
  investigations INT NOT NULL DEFAULT 0,
  tokens         BIGINT NOT NULL DEFAULT 0,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
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

-- Pagos (espejo de db/migrations/008_payments.sql).
CREATE TABLE IF NOT EXISTS payments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  subscription_id     UUID NULL REFERENCES subscriptions (id) ON DELETE SET NULL,
  provider            TEXT NOT NULL,
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
CREATE TABLE IF NOT EXISTS subscription_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions (id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  type            TEXT NOT NULL,
  from_status     TEXT NULL,
  to_status       TEXT NULL,
  meta            JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_subsev_sub ON subscription_events (subscription_id, created_at);

-- Cuenta (espejo de db/migrations/009_account.sql).
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

-- Chat (espejo de db/migrations/010_chat.sql).
CREATE TABLE IF NOT EXISTS conversations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  title       TEXT NOT NULL DEFAULT 'Nueva conversación',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ NULL
);
CREATE INDEX IF NOT EXISTS idx_conv_user ON conversations (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content         TEXT NOT NULL,
  citations       JSONB NOT NULL DEFAULT '[]',
  usage           JSONB NULL,
  cost_usd        NUMERIC NULL,
  model           TEXT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_msg_conv ON messages (conversation_id, created_at, id);

-- Proyectos + enlaces compartidos (espejo de db/migrations/011_chat_projects.sql).
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

-- Archivos de usuario por proyecto (espejo de db/migrations/012_project_files.sql).
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

-- Investigaciones del agente (ver db/migrations/004_investigaciones.sql).
CREATE TABLE investigaciones (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pregunta   TEXT NOT NULL,
  traza      JSONB NOT NULL,
  respuesta  JSONB NOT NULL,
  usage      JSONB NOT NULL,
  costo_usd  NUMERIC,
  user_id    UUID NULL REFERENCES users (id) ON DELETE SET NULL, -- 007 atribución
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inv_user ON investigaciones (user_id);

-- Memoria de chat (espejo de db/migrations/014_chat_memory.sql).
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS summary TEXT NULL;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS summary_count INTEGER NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS user_memories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  fact       TEXT NOT NULL CHECK (fact <> '' AND char_length(fact) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mem_user ON user_memories (user_id, created_at);

-- Marca de inyección en archivos (espejo de db/migrations/015_file_sospechoso.sql).
ALTER TABLE project_files ADD COLUMN IF NOT EXISTS sospechoso BOOLEAN NOT NULL DEFAULT false;

-- Temas por conversación (espejo de db/migrations/016_conv_topics.sql).
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS topics TEXT[] NOT NULL DEFAULT '{}';

-- Control de acceso (espejo de db/migrations/020_access.sql).
CREATE TABLE IF NOT EXISTS access_whitelist (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern    TEXT NOT NULL UNIQUE,
  label      TEXT NULL,
  created_by UUID NULL REFERENCES users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS access_codes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash   TEXT NOT NULL UNIQUE,
  label       TEXT NULL,
  max_uses    INTEGER NOT NULL DEFAULT 1 CHECK (max_uses >= 1),
  used_count  INTEGER NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  expires_at  TIMESTAMPTZ NULL,
  revoked_at  TIMESTAMPTZ NULL,
  created_by  UUID NULL REFERENCES users (id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
