-- 017: mfa_ok en sesiones (I2: 2FA obligatoria para admin). Aditivo, idempotente.
-- true solo si la sesión se emitió tras verificar TOTP/código de recuperación.
-- Sesiones password-only quedan en false (default); admin con
-- ADMIN_MFA_REQUIRED exige true. Aplica: `npm run migrate`.
-- Espejo para DBs frescas en db/init.sql.
ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS mfa_ok BOOLEAN NOT NULL DEFAULT false;
