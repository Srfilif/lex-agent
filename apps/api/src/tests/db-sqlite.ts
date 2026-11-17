// E2E sqlite (sin framework: ts-node + asserts, sale 1 si algo falla).
// Uso: npm run test:sqlite   (Node 22.5+ con node:sqlite; BD temporal desechable)
// Cubre cada rama sqlite de los repositorios contra el schema real.
import 'reflect-metadata';
import { existsSync, readFileSync, unlinkSync } from 'fs';
import { join } from 'path';

process.env.DATABASE_PROVIDER = 'sqlite';
const SQLITE_TEST = join(__dirname, '..', '..', '..', '..', '.npm-tmp', 'db-sqlite-test.sqlite');
process.env.SQLITE_PATH = SQLITE_TEST;

import { Db } from '../db';
import { loadAppConfig } from '../shared/config';
import { newUuid } from '../shared/db/dialect';
import { AuthSession } from '../modules/identity/domain/session';
import { TotpConfig } from '../modules/identity/domain/totp';
import { User } from '../modules/identity/domain/user';
import { parseDisplayName } from '../modules/identity/domain/value-objects';
import {
  PgRecoveryCodeRepository,
  PgSecurityEventRepository,
  PgOneTimeTokenRepository,
  PgSessionRepository,
  PgTotpRepository,
  PgUserRepository,
} from '../modules/identity/infrastructure/persistence/pg-identity.repositories';
import {
  PgAccountPrivacyRepository,
  PgMemoryRepository,
  PgPreferencesRepository,
} from '../modules/account/infrastructure/persistence/pg-account.repositories';
import {
  PgConversationRepository,
  PgMessageRepository,
  PgProjectRepository,
  PgShareRepository,
} from '../modules/chat/infrastructure/persistence/pg-chat.repositories';
import { PgProjectFileRepository } from '../modules/chat/infrastructure/persistence/pg-project-files.repository';
import { PgCorpusRepository } from '../modules/corpus/infrastructure/pg-corpus.repository';
import {
  PgPaymentRepository,
  PgPlanRepository,
  PgSubscriptionEventRepository,
  PgSubscriptionRepository,
  PgUsageRepository,
  PgWebhookRepository,
} from '../modules/billing/infrastructure/persistence/pg-billing.repositories';
import { SearchContracts } from '../modules/secop/application/search-contracts';
import { PgSecopRepository } from '../modules/secop/infrastructure/persistence/pg-secop.repository';
import { OpsMetricas } from '../modules/ops/application/ops-metricas';
import { PgOpsMetricsRepository } from '../modules/ops/infrastructure/persistence/pg-ops-metrics.repository';
import { Investigate } from '../modules/research/application/investigate';
import { PgInvestigationRepository } from '../modules/research/infrastructure/persistence/pg-investigation.repository';

let fails = 0;
function eq(name: string, a: unknown, b: unknown): void {
  const x = JSON.stringify(a);
  const y = JSON.stringify(b);
  const ok = x === y;
  console.log(`${ok ? 'PASS' : 'FAIL'} sqlite:${name}${ok ? '' : ` (${x} !== ${y})`}`);
  if (!ok) fails++;
}
function ok(name: string, cond: boolean, extra?: unknown): void {
  console.log(`${cond ? 'PASS' : 'FAIL'} sqlite:${name}${cond || extra === undefined ? '' : ` (${JSON.stringify(extra)})`}`);
  if (!cond) fails++;
}
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

async function main(): Promise<void> {
  if (existsSync(SQLITE_TEST)) unlinkSync(SQLITE_TEST);
  const cfg = loadAppConfig(__dirname);
  const db = new Db(cfg);
  await db.onModuleInit();
  await db.raw.exec(readFileSync(join(__dirname, '..', '..', '..', '..', 'db', 'sqlite', 'schema.sql'), 'utf8'));

  const tables = await db.raw.query(
    "SELECT count(*) AS n FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
  );
  eq('schema 27 tablas', Number((tables.rows[0] as { n: number }).n), 27);
  const seed = await db.raw.query('SELECT (SELECT count(*) FROM plans) AS p, (SELECT count(*) FROM plan_entitlements) AS e');
  eq('seed planes/entitlements', [Number((seed.rows[0] as { p: number }).p), Number((seed.rows[0] as { e: number }).e)], [3, 12]);

  const now = new Date();
  const users = new PgUserRepository(db);
  const sessions = new PgSessionRepository(db);
  const ott = new PgOneTimeTokenRepository(db);
  const totp = new PgTotpRepository(db);
  const recs = new PgRecoveryCodeRepository(db);
  const secev = new PgSecurityEventRepository(db);

  // identity: usuarios
  const uid = newUuid();
  const user = await users.insert({ id: uid, email: 'qa@lex.local', displayName: 'QA', passwordHash: 'h', now });
  eq('user insert', [user.id, user.email], [uid, 'qa@lex.local']);
  const found = await users.findByEmail('qa@lex.local');
  ok('user fechas Date', found?.snapshot.createdAt instanceof Date && found.snapshot.updatedAt instanceof Date);
  eq('user verified null', found?.snapshot.emailVerifiedAt, null);
  const byId = await users.findById(uid);
  eq('user findById', byId?.snapshot.id, uid);
  const uObj = User.rehydrate({
    id: uid, email: 'qa@lex.local', displayName: 'QA New', passwordHash: 'h',
    emailVerifiedAt: now, status: 'active', role: 'user', createdAt: now, updatedAt: now,
  });
  uObj.setDisplayName(parseDisplayName('QA Dos'), new Date());
  await users.update(uObj);
  eq('user update', (await users.findById(uid))?.snapshot.displayName, 'QA Dos');
  eq('user count search (LIKE)', await users.count('lex'), 1);
  eq('user list', (await users.list({ search: 'lex', limit: 10, offset: 0 })).length, 1);

  // identity: sesiones
  const mkSession = (fam: string, hash: string): AuthSession =>
    AuthSession.create({ id: newUuid(), userId: uid, refreshHash: hash, family: fam, expiresAt: new Date(now.getTime() + 86400000), now, mfaOk: true });
  const s1 = mkSession('fam-a', 'h1');
  await sessions.insert(s1);
  const s2 = mkSession('fam-a', 'h2');
  await sessions.insert(s2);
  const s3 = mkSession('fam-b', 'h3');
  await sessions.insert(s3);
  const sf = await sessions.findById(s1.id);
  eq('session mfaOk boolean', sf?.snapshot.mfaOk, true);
  ok('session fechas Date', sf?.snapshot.expiresAt instanceof Date && sf.snapshot.createdAt instanceof Date);
  eq('session findByRefreshHash', (await sessions.findByRefreshHash('h2'))?.snapshot.id, s2.id);
  eq('session listByUser', (await sessions.listByUser(uid)).length, 3);
  const touched = AuthSession.rehydrate({ ...s1.snapshot, lastSeenAt: new Date(now.getTime() + 1000) });
  await sessions.save(touched);
  eq('session save', (await sessions.findById(s1.id))?.snapshot.lastSeenAt.getTime(), now.getTime() + 1000);
  const s0 = AuthSession.create({ id: newUuid(), userId: uid, refreshHash: 'h0', family: 'fam-0', expiresAt: new Date(now.getTime() + 86400000), now, mfaOk: false });
  await sessions.insert(s0);
  eq('session mfaOk false', (await sessions.findById(s0.id))?.snapshot.mfaOk, false);
  eq('session revokeFamily', await sessions.revokeFamily('fam-a', new Date(), 'test'), 2);
  eq('session revokeAllExcept', await sessions.revokeAllForUserExcept(uid, 'keep', new Date(), 't'), 2);
  eq('session revokeAll', await sessions.revokeAllForUser(uid, new Date(), 't'), 0);

  // identity: OTT / TOTP / recovery / eventos
  const exp = new Date(now.getTime() + 3600000);
  await ott.issue(uid, 'email_verify', 'tokhash1', exp);
  const of = await ott.findByHash('email_verify', 'tokhash1');
  ok('ott fechas Date', of?.expiresAt instanceof Date && of.consumedAt === null);
  await ott.consume(of?.id as string, new Date());
  ok('ott consumedAt Date', ((await ott.findByHash('email_verify', 'tokhash1'))?.consumedAt ?? null) instanceof Date);
  await ott.deleteForUser(uid, 'email_verify');
  eq('ott deleteForUser', await ott.findByHash('email_verify', 'tokhash1'), null);
  const t = TotpConfig.rehydrate({ userId: uid, secretEnc: 'enc', status: 'pending', lastCounter: -1, createdAt: now, confirmedAt: null });
  await totp.savePending(t);
  eq('totp pending', (await totp.findByUser(uid))?.snapshot.status, 'pending');
  const t2 = TotpConfig.rehydrate({ ...t.snapshot, status: 'active', confirmedAt: now, lastCounter: 7 });
  await totp.save(t2);
  const tf = await totp.findByUser(uid);
  eq('totp active+counter', [tf?.snapshot.status, tf?.snapshot.lastCounter], ['active', 7]);
  ok('totp fechas Date', tf?.snapshot.createdAt instanceof Date && tf.snapshot.confirmedAt instanceof Date);
  await totp.delete(uid);
  eq('totp delete', await totp.findByUser(uid), null);
  await recs.replaceAll(uid, ['rh1', 'rh2']);
  const rc1 = await recs.findByHash('rh1');
  eq('recovery find', rc1?.userId, uid);
  eq('recovery markUsed', await recs.markUsed(rc1?.id as string, new Date()), true);
  eq('recovery markUsed dup', await recs.markUsed(rc1?.id as string, new Date()), false);
  eq('recovery countLeft', await recs.countLeft(uid), 1);
  await secev.record({ userId: uid, type: 'login', success: true, ip: '127.0.0.1', userAgent: 't', meta: { a: 1 } });
  const sevRow = await db.raw.query('SELECT success FROM security_events LIMIT 1');
  eq('security success 0/1', (sevRow.rows[0] as { success: number }).success, 1);

  // account: preferencias / recuerdos / privacidad
  const prefs = new PgPreferencesRepository(db);
  const mems = new PgMemoryRepository(db);
  const privacy = new PgAccountPrivacyRepository(db);
  await prefs.save(uid, { theme: 'dark', docs_page_size: 10 });
  eq('prefs JSON roundtrip', await prefs.get(uid), { theme: 'dark', docs_page_size: 10 });
  await mems.add(uid, 'hecho uno');
  await mems.add(uid, 'hecho dos');
  const m3 = await mems.add(uid, 'hecho tres');
  ok('memory id uuid-sqlite', UUID_RE.test(m3.id), m3.id);
  ok('memory fecha Date', m3.createdAt instanceof Date);
  eq('memory count', await mems.count(uid), 3);
  eq('memory dropOldest', await mems.dropOldest(uid, 2), 1);
  eq('memory remove resto', (await mems.list(uid)).length, 2);
  await mems.remove(uid, m3.id);
  eq('memory count final', await mems.count(uid), 1);
  await privacy.markDeletionRequested(uid, new Date());
  ok('privacy fecha Date', (await privacy.getDeletionRequested(uid)) instanceof Date);
  await privacy.clearDeletionRequested(uid);
  eq('privacy clear', await privacy.getDeletionRequested(uid), null);

  // chat: conversaciones / mensajes / proyectos / shares
  const convs = new PgConversationRepository(db);
  const msgs = new PgMessageRepository(db);
  const projs = new PgProjectRepository(db);
  const shares = new PgShareRepository(db);
  const conv = await convs.create(uid, 'Hilo QA', now);
  eq('conv topics []', conv.topics, []);
  ok('conv fechas Date', conv.createdAt instanceof Date && conv.updatedAt instanceof Date && conv.archivedAt === null);
  conv.topics = ['ley 80', 'caducidad'];
  conv.title = 'Hilo QA 2';
  await convs.save(conv);
  eq('conv topics roundtrip', (await convs.findById(conv.id))?.topics, ['ley 80', 'caducidad']);
  eq('conv listByUser', (await convs.listByUser(uid, { limit: 10, offset: 0, archived: false })).length, 1);
  const msg = await msgs.append({
    conversationId: conv.id,
    role: 'assistant', content: 'Respuesta sobre el contrato 123', citations: [{ n: 1, chunk_id: 'c1', secop_ref: null, ruta: 'R', titulo: 'T' }],
    usage: { prompt: 10, completion: 20, total: 30 }, costUsd: 0.001, model: 'm',
  });
  ok('msg id uuid-sqlite', UUID_RE.test(msg.id), msg.id);
  ok('msg fecha Date', msg.createdAt instanceof Date);
  eq('msg citations roundtrip', msg.citations.length, 1);
  eq('msg usage roundtrip', msg.usage, { prompt: 10, completion: 20, total: 30 });
  eq('msg count', await msgs.countByConversation(conv.id), 1);
  eq('msg list', (await msgs.listByConversation(conv.id, { limit: 50 })).length, 1);
  const hits = await msgs.searchByUser(uid, 'contrato', 10);
  eq('msg search snippet', hits.length === 1 && hits[0].snippet.includes('contrato'), true);
  const proj = await projs.create(uid, 'Proyecto QA', 'instr', now);
  eq('proj findById', (await projs.findById(proj.id))?.name, 'Proyecto QA');
  eq('proj list count', (await projs.listByUser(uid))[0]?.conversationCount, 0);
  const share = await shares.create(conv.id, newUuid());
  eq('share findActive', (await shares.findActiveByConversation(conv.id))?.id, share.id);
  eq('share byToken', (await shares.findActiveByToken(share.token))?.id, share.id);
  eq('share revoke', await shares.revokeByConversation(conv.id, new Date()), 1);
  eq('share revoked null', await shares.findActiveByConversation(conv.id), null);

  // chat: archivos de proyecto + chunks
  const pfiles = new PgProjectFileRepository(db);
  const pf = await pfiles.create({ projectId: proj.id, userId: uid, filename: 'ley.txt', mime: 'text/plain', sizeBytes: 100, sha256: 'abc', storagePath: 'p/abc', chunkCount: 2, sospechoso: false });
  eq('pfile sospechoso false', pf.sospechoso, false);
  eq('pfile byHash', (await pfiles.findByProjectAndHash(proj.id, 'abc'))?.id, pf.id);
  eq('pfile list', (await pfiles.listByProject(proj.id)).length, 1);
  await pfiles.saveChunks(pf.id, proj.id, [
    { n: 1, ruta: 'A', texto: 'el contrato estatal requiere licitación', textoContexto: 'ctx', embedding: [1, 0, 0, 0] },
    { n: 2, ruta: 'B', texto: 'los plátanos maduran al sol', textoContexto: 'ctx', embedding: [0, 1, 0, 0] },
  ]);
  eq('pfile chunk_count', (await pfiles.findById(pf.id))?.chunkCount, 2);
  const pfts = await pfiles.ftsRanked(proj.id, 'licitación contrato', 10);
  eq('pfile fts LIKE', pfts.length >= 1, true);
  const pvec = await pfiles.vectorRanked(proj.id, [1, 0, 0, 0], 10);
  eq('pfile vector coseno orden', pvec.length, 2);
  const pby = await pfiles.chunksByIds(pvec);
  eq('pfile chunksByIds IN', pby.length, 2);
  eq('pfile chunkById', (await pfiles.chunkById(pby[0].chunkId))?.chunkId, pby[0].chunkId);
  eq('pfile usage', await pfiles.usageByProject(proj.id), { count: 1, bytes: 100 });
  await pfiles.delete(pf.id);
  eq('pfile delete', await pfiles.findById(pf.id), null);
  eq('pfile chunks fuera', (await pfiles.chunksByIds(pvec)).length, 0);

  // corpus: documentos + retrieval híbrido
  const corpus = new PgCorpusRepository(db);
  await corpus.saveDocumentWithChunks(
    { titulo: 'Ley 80 de 1993', emisor: 'Congreso', tipo: 'ley', fecha: '1993-10-28', numero: '80', tema: 'contratacion', autoridad: 'vinculante', url_original: 'http://x', hash: 'h80', vigencia: 'texto_original' },
    [
      { ruta: 'Art. 24', offset_inicio: 0, offset_fin: 10, texto: 'del principio de transparencia en la contratación', texto_contexto: 'ctx', embedding: [1, 0, 0, 0] },
      { ruta: 'Art. 25', offset_inicio: 0, offset_fin: 10, texto: 'de la economía en la contratación estatal', texto_contexto: 'ctx', embedding: [0.9, 0.1, 0, 0] },
    ],
  );
  eq('corpus findByHash', (await corpus.findDocumentByHash('h80'))?.titulo, 'Ley 80 de 1993');
  eq('corpus structured', (await corpus.structuredByArticle('24', '80', {})).length >= 1, true);
  const cfts = await corpus.ftsRanked('transparencia contratación', {}, 10);
  eq('corpus fts LIKE halla', cfts.length >= 1, true);
  const cfilt = await corpus.ftsRanked('transparencia', { emisor: 'congreso' }, 10);
  eq('corpus filtro emisor LIKE', cfilt.length >= 1, true);
  const cvec = await corpus.vectorRanked([1, 0, 0, 0], {}, 10);
  eq('corpus vector orden', cvec.length, 2);
  const cids = await corpus.chunksByIds(cvec);
  eq('corpus chunksByIds IN', cids.length, 2);
  eq('corpus chunkById', (await corpus.chunkById(cids[0].chunk_id))?.chunk_id, cids[0].chunk_id);
  const stats = await corpus.documentStats();
  const st80 = stats.find((s) => s.numero === '80');
  eq('corpus stats CAST', [stats.length, st80?.chunks], [1, 2]);
  const cref = await corpus.chunkRef(cids[0].chunk_id);
  eq('corpus chunkRef', typeof cref?.texto === 'string' && cref.texto.length > 0, true);
  eq('corpus chunkRef malo→null', await corpus.chunkRef('no-es-uuid'), null);

  // billing: planes / suscripciones / uso / pagos / webhooks
  const plans = new PgPlanRepository(db);
  const subs = new PgSubscriptionRepository(db);
  const usage = new PgUsageRepository(db);
  const pays = new PgPaymentRepository(db);
  const hooks = new PgWebhookRepository(db);
  const subevs = new PgSubscriptionEventRepository(db);
  const actives = await plans.listActive();
  eq('billing planes activos', actives.length, 3);
  eq('billing plan active bool', actives[0]?.plan.active, true);
  const free = actives.find((a) => a.plan.code === 'free');
  eq('billing entitlement', free?.entitlements['investigaciones_mes'], '20');
  const until = new Date(now.getTime() + 30 * 86400 * 1000);
  const sub = await subs.grant(uid, 'plus', until, now);
  eq('billing grant', [sub.snapshot.planCode, sub.snapshot.status], ['plus', 'active']);
  const live = await subs.findLiveByUser(uid);
  ok('billing sub fechas Date', live?.snapshot.periodStart instanceof Date && live.snapshot.createdAt instanceof Date);
  eq('billing sub cancel bool', live?.snapshot.cancelAtPeriodEnd, false);
  eq('billing covers', live?.covers(new Date(now.getTime() + 1000)), true);
  live?.scheduleCancel(new Date());
  if (live) await subs.save(live);
  eq('billing save cancel', (await subs.findLiveByUser(uid))?.snapshot.cancelAtPeriodEnd, true);
  const ev = { userId: uid, kind: 'investigacion' as const, units: 1, tokensIn: 10, tokensOut: 20, costUsd: 0.001, idempotencyKey: 'k1', refType: null as string | null, refId: null as string | null };
  eq('billing consume ok', (await usage.consume(ev, '2026-11', 5, 1000, 1, 30)).outcome, 'ok');
  eq('billing consume dup', (await usage.consume(ev, '2026-11', 5, 1000, 1, 30)).outcome, 'duplicado');
  eq('billing consume quota', (await usage.consume({ ...ev, idempotencyKey: 'k2' }, '2026-11', 1, 1000, 1, 30)).outcome, 'cuota_investigaciones');
  eq('billing periodUsage', await usage.periodUsage(uid, '2026-11'), { period: '2026-11', investigations: 1, tokens: 30 });
  eq('billing record', await usage.record({ ...ev, idempotencyKey: 'k3', units: 2, tokensIn: 5, tokensOut: 5 }, '2026-11'), 'ok');
  eq('billing periodUsage tras record', await usage.periodUsage(uid, '2026-11'), { period: '2026-11', investigations: 3, tokens: 40 });
  const pay = await pays.insertPending({ userId: uid, subscriptionId: sub.snapshot.id, provider: 'sandbox', providerPaymentId: 'pp1', planCode: 'plus', amountMinor: 29900, currency: 'COP', now });
  eq('billing pay find', (await pays.findByProviderId('sandbox', 'pp1'))?.snapshot.id, pay.snapshot.id);
  eq('billing pay list', (await pays.listByUser(uid, 10)).length, 1);
  eq('billing webhook primero', await hooks.tryInsert('sandbox', 'ev1', 't', { a: 1 }), 'insertado');
  eq('billing webhook dup', await hooks.tryInsert('sandbox', 'ev1', 't', { a: 1 }), 'duplicado');
  await subevs.append({ subscriptionId: sub.snapshot.id, userId: uid, type: 'created', fromStatus: null, toStatus: 'active', meta: { by: 'test' } });
  const sevl = await subevs.listBySubscription(sub.snapshot.id, 10);
  eq('billing subev meta JSON', (sevl[0]?.meta as { by?: string })?.by, 'test');

  // secop: filtros LIKE + año + orden
  await db.raw.query(
    `INSERT INTO secop_contratos (id, nombre_entidad, proveedor_adjudicado, objeto_del_contrato, modalidad_de_contratacion, estado_contrato, fecha_de_firma, valor_del_contrato, id_contrato)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    ['s1', 'Alcaldía de Bogotá', 'Constructora XYZ', 'Pavimentar la avenida principal', 'Licitación', 'Firmado', '2024-05-01', 1000, 'C-001'],
  );
  const secop = new SearchContracts(new PgSecopRepository(db));
  const sc1 = await secop.contratos({ entidad: 'bogotá' });
  eq('secop filtro LIKE', sc1.contratos.length, 1);
  const sc2 = await secop.contratos({ anio: 2024 });
  eq('secop filtro año', sc2.contratos.length, 1);
  ok('secop fecha_consulta ISO', /^\d{4}-\d{2}-\d{2}T/.test(sc2.fecha_consulta), sc2.fecha_consulta);

  // ops + agent.obtener
  const ops = new OpsMetricas(new PgOpsMetricsRepository(db));
  const met = await ops.resumen();
  eq('ops usuarios_total', met.usuarios_total >= 1, true);
  eq('ops tasa null sin chats', met.tasa_abstencion_30d, null);
  await usage.record({ ...ev, kind: 'chat' as const, idempotencyKey: 'kc1' }, '2026-11');
  await usage.record({ ...ev, kind: 'chat' as const, idempotencyKey: 'kc2' }, '2026-11');
  await usage.record({ ...ev, kind: 'abstencion' as const, idempotencyKey: 'ka1' }, '2026-11');
  const met2 = await ops.resumen();
  eq('ops tasa ratio', met2.tasa_abstencion_30d, 0.5);
  await db.raw.query(
    'INSERT INTO investigaciones (pregunta, traza, respuesta, usage, costo_usd, user_id) VALUES ($1,$2,$3,$4,$5,$6)',
    ['q?', JSON.stringify([{ paso: 1 }]), JSON.stringify({ resumen: 'r' }), JSON.stringify({ prompt: 1, completion: 2, total: 3 }), 0.01, uid],
  );
  const agent = new Investigate(
    new PgInvestigationRepository(db),
    {} as never,
    {} as never,
    {} as never,
  );
  const invRow = await db.raw.query('SELECT id FROM investigaciones LIMIT 1');
  const invId = (invRow.rows[0] as { id: string }).id;
  const obt = await agent.obtener(invId);
  eq('agent obtener JSON', [(obt?.traza as unknown[]).length, (obt?.respuesta as { resumen?: string })?.resumen], [1, 'r']);

  // formato ISO en timestamps por defecto
  const tsRow = await db.raw.query('SELECT created_at FROM users LIMIT 1');
  ok('timestamps ISO-Z', ISO_RE.test(String((tsRow.rows[0] as { created_at: string }).created_at)), (tsRow.rows[0] as { created_at: string }).created_at);

  // FK reales: sesión de usuario fantasma debe fallar
  let fkOk = false;
  try {
    await sessions.insert(AuthSession.create({ id: newUuid(), userId: newUuid(), refreshHash: 'hx', family: 'f', expiresAt: exp, now }));
  } catch {
    fkOk = true;
  }
  eq('FK enforced', fkOk, true);

  // export + borrado total (incluye rama JSON de webhooks)
  await sessions.insert(
    AuthSession.create({ id: newUuid(), userId: uid, refreshHash: 'h-final', family: 'fam-z', expiresAt: exp, now }),
  );
  await hooks.tryInsert('sandbox', 'ev-strip', 't', { metadata: { user_id: uid } });
  const exp0 = await privacy.exportData(uid);
  eq('export prefs objeto', typeof (exp0.preferences as Record<string, unknown>)?.theme, 'string');
  const del = await privacy.deleteAccount(uid, new Date());
  eq('delete sessionsRevoked', del.sessionsRevoked, 1);
  eq('delete subscriptionCanceled', del.subscriptionCanceled, true);
  eq('delete investigationsDetached', del.investigationsDetached, 1);
  eq('delete webhooksStripped', del.webhooksStripped, 1);
  eq('delete usuario anonimizado', (await users.findById(uid))?.status, 'deleted');

  await db.raw.end();
  if (fails) {
    console.log(`${fails} chequeo(s) sqlite roto(s)`);
    process.exit(1);
  }
  console.log('sqlite verde');
}

main().catch((e: Error) => {
  console.error(`FAIL sqlite harness: ${e.message}`);
  console.error((e.stack ?? '').split('\n').slice(1, 5).join('\n'));
  process.exit(1);
});

