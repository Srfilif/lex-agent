-- 013: modelos de chat por plan (B7). Solo datos, idempotente.
-- Verificados con chat real 2026-10-27: muse-spark-1.3 (defecto),
-- muse-wonder-1.0 (plus/pro), muse-spark-1.2 (fallback pro).
-- El orden del csv define defecto (primero) y cadena de fallback.
-- Aplica: `npm run migrate`. Espejo para DBs frescas en db/init.sql.
UPDATE plan_entitlements SET value = 'muse-spark-1.3'
 WHERE plan_code = 'free' AND key = 'modelos';
UPDATE plan_entitlements SET value = 'muse-spark-1.3,muse-wonder-1.0'
 WHERE plan_code = 'plus' AND key = 'modelos';
UPDATE plan_entitlements SET value = 'muse-spark-1.3,muse-wonder-1.0,muse-spark-1.2'
 WHERE plan_code = 'pro' AND key = 'modelos';
