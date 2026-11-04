// Regresión DB (sin framework: ts-node + pg, sale 1 si algo falla).
// Uso: npm test   (requiere `docker compose up -d db`)
// Origen: Día 2, FTS 'spanish' no hallaba 'contratación' al buscar
// 'contratacion' → se creó la config lex_spanish (unaccent + spanish_stem).
import { Pool } from 'pg';
import { loadAppConfig } from '../shared/config';

const pool = new Pool({ connectionString: loadAppConfig(__dirname).databaseUrl });
let fails = 0;

async function check(name: string, sql: string): Promise<void> {
  try {
    const r = await pool.query(sql);
    const ok = r.rows[0]?.ok === true;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
    if (!ok) fails++;
  } catch (e) {
    console.log(`FAIL ${name}: ${(e as Error).message}`);
    fails++;
  }
}

async function main(): Promise<void> {
  await check(
    'config lex_spanish existe',
    `SELECT count(*) = 1 AS ok FROM pg_ts_config WHERE cfgname = 'lex_spanish'`,
  );
  await check(
    'lex_spanish usa unaccent',
    `SELECT count(*) >= 1 AS ok FROM pg_ts_config_map m
     JOIN pg_ts_config c ON c.oid = m.mapcfg
     WHERE c.cfgname = 'lex_spanish'
       AND EXISTS (SELECT 1 FROM pg_ts_dict t
                   WHERE t.oid = m.mapdict AND t.dictname = 'unaccent')`,
  );
  await check(
    'sin acento halla contratacion',
    `SELECT to_tsvector('lex_spanish', 'contratación ficticia')
       @@ plainto_tsquery('lex_spanish', 'contratacion ficticia') AS ok`,
  );
  await check(
    'con acento también halla',
    `SELECT to_tsvector('lex_spanish', 'contratación ficticia')
       @@ plainto_tsquery('lex_spanish', 'contratación') AS ok`,
  );
  await check(
    'tablas documents + chunks existen',
    `SELECT count(*) = 2 AS ok FROM information_schema.tables
     WHERE table_name IN ('documents', 'chunks')`,
  );
  await check(
    'índice HNSW de embeddings existe',
    `SELECT count(*) = 1 AS ok FROM pg_indexes
     WHERE indexname = 'idx_chunks_embedding'`,
  );
  await check(
    'tablas identidad existen',
    `SELECT count(*) = 5 AS ok FROM information_schema.tables
     WHERE table_name IN ('schema_migrations', 'users', 'one_time_tokens',
                          'auth_sessions', 'security_events')`,
  );
  await check(
    'users exige email único',
    `SELECT count(*) >= 1 AS ok FROM pg_indexes
     WHERE tablename = 'users' AND indexdef LIKE '%UNIQUE%'`,
  );
  await check(
    'tablas totp existen',
    `SELECT count(*) = 2 AS ok FROM information_schema.tables
     WHERE table_name IN ('totp_configs', 'recovery_codes')`,
  );
  await check(
    'tablas billing existen',
    `SELECT count(*) = 5 AS ok FROM information_schema.tables
     WHERE table_name IN ('plans', 'plan_entitlements', 'subscriptions',
                          'usage_events', 'usage_periods')`,
  );
  await check(
    'catálogo semilla (3 planes)',
    `SELECT count(*) = 3 AS ok FROM plans WHERE code IN ('free', 'plus', 'pro')`,
  );
  await check(
    'investigaciones.user_id existe',
    `SELECT count(*) = 1 AS ok FROM information_schema.columns
     WHERE table_name = 'investigaciones' AND column_name = 'user_id'`,
  );
  await check(
    'tablas pagos existen',
    `SELECT count(*) = 3 AS ok FROM information_schema.tables
     WHERE table_name IN ('payments', 'webhook_events', 'subscription_events')`,
  );
  await check(
    'planes con precio sandbox',
    `SELECT count(*) = 2 AS ok FROM plans
     WHERE code IN ('plus', 'pro') AND price_minor IS NOT NULL AND currency = 'COP'`,
  );
  await check(
    'user_preferences existe',
    `SELECT count(*) = 1 AS ok FROM information_schema.tables
     WHERE table_name = 'user_preferences'`,
  );
  await check(
    'kinds 009 (email_change, account_delete)',
    `SELECT count(*) = 1 AS ok FROM pg_constraint
     WHERE conname = 'one_time_tokens_kind_check'
       AND pg_get_constraintdef(oid) LIKE '%account_delete%'`,
  );
  await check(
    'tablas chat existen',
    `SELECT count(*) = 2 AS ok FROM information_schema.tables
     WHERE table_name IN ('conversations', 'messages')`,
  );
  await check(
    'tablas proyectos+enlaces existen',
    `SELECT count(*) = 2 AS ok FROM information_schema.tables
     WHERE table_name IN ('projects', 'share_links')`,
  );
  await check(
    'conversations.project_id existe',
    `SELECT count(*) = 1 AS ok FROM information_schema.columns
     WHERE table_name = 'conversations' AND column_name = 'project_id'`,
  );
  await check(
    'share token único',
    `SELECT count(*) >= 1 AS ok FROM pg_indexes
     WHERE tablename = 'share_links' AND indexdef LIKE '%UNIQUE%'`,
  );
  await check(
    'tablas archivos proyecto existen',
    `SELECT count(*) = 2 AS ok FROM information_schema.tables
     WHERE table_name IN ('project_files', 'project_chunks')`,
  );
  await check(
    'project_chunks con embedding+fts',
    `SELECT count(*) = 2 AS ok FROM information_schema.columns
     WHERE table_name = 'project_chunks' AND column_name IN ('embedding', 'fts')`,
  );
  await check(
    '013 free solo spark-1.3',
    `SELECT value = 'muse-spark-1.3' AS ok FROM plan_entitlements
     WHERE plan_code = 'free' AND key = 'modelos'`,
  );
  await check(
    '013 plus suma wonder',
    `SELECT value = 'muse-spark-1.3,muse-wonder-1.0' AS ok FROM plan_entitlements
     WHERE plan_code = 'plus' AND key = 'modelos'`,
  );
  await check(
    '013 pro tres modelos',
    `SELECT value = 'muse-spark-1.3,muse-wonder-1.0,muse-spark-1.2' AS ok
     FROM plan_entitlements WHERE plan_code = 'pro' AND key = 'modelos'`,
  );
  await check(
    '014 conversations resumen',
    `SELECT count(*) = 2 AS ok FROM information_schema.columns
     WHERE table_name = 'conversations' AND column_name IN ('summary', 'summary_count')`,
  );
  await check(
    '014 user_memories existe',
    `SELECT count(*) = 1 AS ok FROM information_schema.tables
     WHERE table_name = 'user_memories'`,
  );
  await check(
    '014 memories fk+índice',
    `SELECT (SELECT count(*) FROM information_schema.table_constraints
      WHERE table_name = 'user_memories' AND constraint_type = 'FOREIGN KEY') = 1
     AND (SELECT count(*) FROM pg_indexes
      WHERE tablename = 'user_memories' AND indexname = 'idx_mem_user') = 1 AS ok`,
  );
  await check(
    '015 project_files.sospechoso',
    `SELECT count(*) = 1 AS ok FROM information_schema.columns
     WHERE table_name = 'project_files' AND column_name = 'sospechoso'`,
  );
  await check(
    '016 conversations.topics',
    `SELECT count(*) = 1 AS ok FROM information_schema.columns
     WHERE table_name = 'conversations' AND column_name = 'topics'`,
  );
  await check(
    'D documents columnas cobertura',
    `SELECT count(*) = 5 AS ok FROM information_schema.columns
     WHERE table_name = 'documents' AND column_name IN
       ('jurisdiccion', 'tema', 'vigencia', 'autoridad', 'fecha_consulta')`,
  );
  await check(
    'D corpus 3 docs con chunks',
    `SELECT count(*) = 3 AS ok FROM documents d
     WHERE (SELECT count(*) FROM chunks c WHERE c.doc_id = d.id) > 0`,
  );
  await check(
    'D vigencia sin valores inventados',
    `SELECT count(*) = 0 AS ok FROM documents
     WHERE vigencia NOT IN ('texto_original', 'modificado', 'consolidado',
                            'vigencia_verificada', 'vigencia_desconocida')`,
  );
  await check(
    'D jurisdiccion/tema honestos',
    `SELECT count(*) = 3 AS ok FROM documents
     WHERE jurisdiccion = 'CO' AND tema IS NOT NULL`,
  );
  await check(
    '017 auth_sessions.mfa_ok',
    `SELECT count(*) = 1 AS ok FROM information_schema.columns
     WHERE table_name = 'auth_sessions' AND column_name = 'mfa_ok'`,
  );
  await pool.end();
  if (fails) {
    console.log(`${fails} regresión(es) rota(s)`);
    process.exit(1);
  }
  console.log('regresión DB verde');
}

void main();
