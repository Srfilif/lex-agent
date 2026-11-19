-- 019: consentimiento legal por cuenta (términos + datos). Idempotente.
-- Estampa versión aceptada + fecha/hora (Ley 1581 art. 9: prueba de la
-- autorización previa, expresa e informada). Cuentas previas quedan NULL
-- (pendientes de re-aceptación vía POST /account/consents).

ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_version TEXT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_version TEXT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_accepted_at TIMESTAMPTZ NULL;
