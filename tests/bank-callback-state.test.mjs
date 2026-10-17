// SEC03: handler real, BD relacional y OAuth sintéticos; sin red ni Postgres vivo.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { transformSync } from 'esbuild';
import { webcrypto, createHash } from 'node:crypto';
const repo = new URL("../", import.meta.url);
const now = Date.parse('2026-10-17T12:00:00.000Z');
class Clock extends Date { constructor(...a) { super(...(a.length ? a : [now])); } static now() { return now; } }
const clone = x => structuredClone(x);
const sources = ['supabase/functions/_shared/entrada.ts', 'supabase/functions/_shared/ratelimit.ts', 'supabase/functions/bank-callback/reconnect.ts', 'supabase/functions/bank-callback/index.ts'];
const sourceText = Object.fromEntries(sources.map(p => [p, fs.readFileSync(new URL(p, repo), 'utf8')]));
function compile(s) {
  const imports = (s.match(/^import .*;\r?$/gm) || []).map(x => x.trim());
  assert.ok(imports.every(x => /^import .* from ["'](?:https:\/\/esm.sh\/@supabase\/supabase-js@2|\.\.\/_shared\/(?:enablebanking|token_store|entrada|ratelimit)\.ts|\.\/reconnect\.ts)["'];$/.test(x)));
  const clean = s.replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '');
  assert.ok(!/^\s*import\b/m.test(clean));
  return transformSync(clean, { loader: "ts", format: "cjs" }).code;
}
function fixture(opt = {}, handlerSource = sourceText[sources.at(-1)]) {
  let row = { id: 'fixture-link', user_id: 'fixture-user', state: 'fixture-state' + (opt.app ? '.app' : ''), state_issued_at: new Clock(now - (opt.expired ? 1800001 : 60000)).toISOString(), status: 'pending', session_id: 'fixture-old-session', account_uid: 'fixture-old-account', iban: 'FIXTURE-IBAN', accounts: [{ uid: 'fixture-old-account', iban: 'FIXTURE-IBAN', currency: 'EUR' }], last_sync: '2026-10-16T12:00:00Z', aspsp_name: 'Fixture Bank' };
  if (opt.legacy) row.state_issued_at = null;
  const initial = clone(row), events = [], logs = [];
  let handler, reads = 0, barrierResolve;
  const barrier = new Promise(resolve => barrierResolve = resolve);
  const replace = () => { row = { ...row, state: 'fixture-new-state', state_issued_at: '2026-10-17T12:00:00.000Z', status: 'pending' }; events.push({ op: 'external-reconnect' }); };
  const db = {
    async rpc(name, args) { events.push({ op: 'rate', name, args: clone(args) }); const ip = args.p_bucket.startsWith('bank-callback-ip:'); return { data: !((ip && opt.denyIp) || (!ip && opt.denyUser)), error: null }; },
    from(table) {
      let op = 'read', payload, returning = false, executed;
      const filters = [];
      const q = {
        select() { returning = true; return q; },
        eq(k, v) { filters.push([k, v]); return q; },
        is(k, v) { filters.push([k, v]); return q; },
        update(p) { op = 'update'; payload = clone(p); return q; },
        insert(p) { op = 'insert'; payload = clone(p); return q; },
        maybeSingle() { return execute(true); },
        then(ok, bad) { return execute(false).then(ok, bad); },
      };
      const execute = single => executed ||= (async () => {
        if (op === 'read') {
          const matches = row && filters.every(([k, v]) => row[k] === v);
          const snapshot = matches ? clone(row) : null;
          events.push({ op: 'lookup', matched: !!matches, snapshotState: snapshot?.state ?? null });
          if (opt.parallelReads && ++reads <= 2) { if (reads === 2) barrierResolve(); await barrier; }
          return { data: single ? snapshot : snapshot ? [snapshot] : [], error: null };
        }
        if (table !== 'bank_links') { events.push({ op: 'diagnostic', table }); return { data: null, error: null }; }
        const consume = Object.keys(payload).length === 1 && payload.state === null;
        if (consume && opt.beforeConsume === 'replace') replace();
        if (consume && opt.beforeConsume === 'issuance') { row.state_issued_at = new Clock(now).toISOString(); events.push({ op: 'external-issuance' }); }
        if (consume && opt.beforeConsume === 'delete') { row = null; events.push({ op: 'external-delete' }); }
        const fault = consume ? opt.consumeFault : opt.finalFault;
        if (fault === 'error-with-row') return { data: [{ id: initial.id }], error: { code: 'fixture-incoherent-error' } };
        if (fault === 'throw-before') { events.push({ op: 'consume-throw-before' }); throw Error('fixture transport unavailable'); }
        if (fault === 'error-before') { events.push({ op: consume ? 'consume-error-before' : 'link-error-before' }); return { data: null, error: { code: '42501', message: 'fixture denied' } }; }
        const match = row && filters.every(([k, v]) => row[k] === v);
        if (match) Object.assign(row, payload);
        const returned = match ? [clone(row)] : [];
        events.push({ op: consume ? 'consume' : 'link-update', filters: clone(filters), affected: match ? 1 : 0, patch: payload, returning });
        if (fault === 'throw-after') throw Error('fixture response lost after commit');
        if (fault === 'error-after') return { data: null, error: { code: 'fixture-response-lost' } };
        if (fault === 'absent') return undefined;
        if (fault === 'null') return null;
        if (fault === 'missingrows') return { data: null, error: null };
        if (fault === 'rows-empty') return { data: [], error: null };
        if (fault === 'rows-other') return { data: [{ id: 'fixture-other' }], error: null };
        if (fault === 'rows-multiple') return { data: [{ id: initial.id }, { id: initial.id }], error: null };
        return { data: returning ? returned : null, error: null };
      })();
      return q;
    },
  };
  const context = vm.createContext({
    Deno: { serve: fn => handler = fn, env: { get: key => ({ APP_URL: 'https://app.example.invalid/', SUPABASE_URL: 'https://db.example.invalid', SUPABASE_SERVICE_ROLE_KEY: 'fixture-service-role' })[key] } },
    createClient: () => db, Request, Response, Headers, URL, TextEncoder, crypto: webcrypto, Date: Clock,
    setTimeout, clearTimeout, console: { error: (...a) => logs.push(a), log: (...a) => logs.push(a) },
    fetch: () => { throw Error('UNEXPECTED NETWORK'); },
    ebConfig: () => ({ appId: 'fixture-app', pem: 'fixture-pem' }), makeJWT: async () => 'fixture-jwt',
    encryptSessionId: async id => 'fixture-encrypted:' + id,
    ebApi: async (_jwt, endpoint, options) => {
      assert.equal(endpoint, '/sessions'); assert.equal(options.method, 'POST');
      const n = events.filter(e => e.op === 'oauth-exchange').length + 1;
      events.push({ op: 'oauth-exchange', request: n });
      if (opt.reconnectDuringExchange) replace();
      return { session_id: 'fixture-session-' + n, accounts: [{ uid: 'fixture-account-' + n, account_id: { iban: 'FIXTURE-IBAN' }, currency: 'EUR' }] };
    },
  }, { codeGeneration: { strings: false, wasm: false } });
  for (const p of sources) vm.runInContext(compile(p === sources.at(-1) ? handlerSource : sourceText[p]), context, { filename: p, timeout: 2000 });
  assert.equal(typeof handler, 'function');
  const request = async (state = initial.state) => {
    const response = await handler(new Request('https://callback.example.invalid/?' + new URLSearchParams({ code: 'fixture-code', state }), { headers: { 'x-forwarded-for': '192.0.2.1' } }));
    return { status: response.status, location: response.headers.get('location') };
  };
  const evidence = responses => ({ responses, oauthExchanges: events.filter(e => e.op === 'oauth-exchange').length, consumeAffected: events.filter(e => e.op === 'consume').reduce((a, e) => a + e.affected, 0), linkUpdates: events.filter(e => e.op === 'link-update' && e.affected).length, stateAfter: row?.state ?? null, statusAfter: row?.status ?? null, sessionAfter: row?.session_id ?? null, events, logs });
  return { request, evidence, initial, row: () => clone(row), db, replace };
}
const index = sourceText[sources.at(-1)];
const mutants = {
  'sin-state': ['.eq("id", link.id).eq("state", state);', '.eq("id", link.id);', 'concurrent'],
  'acepta-cero': ['|| consumed.data.length !== 1 || consumed.data[0]?.id !== link.id', '|| consumed.data.length > 1 || (consumed.data.length === 1 && consumed.data[0]?.id !== link.id)', 'zero'],
  'acepta-error': ['if (consumed?.error || !Array.isArray(consumed?.data)', 'if (!Array.isArray(consumed?.data)', 'error'],
  'exito-sin-guardar': ['if (linkError) throw new CallbackFallo("error", "enlace no guardado");', 'if (false) throw new CallbackFallo("error", "enlace no guardado");', 'save'],
};
const mutantName = process.env.SEC03_MUTANT;
let handlerSource = index;
if (mutantName) {
  assert.ok(mutants[mutantName], 'mutante conocido');
  const [from, to] = mutants[mutantName]; assert.equal(index.split(from).length, 2, 'ancla única'); handlerSource = index.replace(from, to);
}
const selected = mutantName ? mutants[mutantName][2] : null;
let pass = 0, fail = 0;
async function test(name, group, fn) {
  if (selected && group !== selected) return;
  try { await fn(); pass++; console.log('PASS ' + name); }
  catch (e) { fail++; console.error('FAIL ' + name + ': ' + e.message); }
}
const make = opt => fixture(opt, handlerSource);
const okLocation = app => app ? 'https://app.example.invalid/back.html?ok=1' : 'https://app.example.invalid/?bank=ok';
const errorLocation = app => app ? 'https://app.example.invalid/back.html?msg=error' : 'https://app.example.invalid/?bank=error&msg=error';
function closed(res, app) { assert.equal(res.status, 302); assert.equal(res.location, errorLocation(app)); }
function noOAuth(e) { assert.equal(e.oauthExchanges, 0, 'solo el ganador puede llegar a OAuth'); assert.equal(e.linkUpdates, 0); }
for (const app of [false, true]) {
  await test('concurrente: un ganador, web/APK=' + app, 'concurrent', async () => {
    const f = make({ app, parallelReads: true }); const rs = await Promise.all([f.request(), f.request()]); const e = f.evidence(rs);
    assert.equal(e.oauthExchanges, 1, 'exactamente un intento OAuth'); assert.equal(e.consumeAffected, 1); assert.equal(e.linkUpdates, 1);
    assert.equal(rs.filter(r => r.location === okLocation(app)).length, 1); closed(rs.find(r => r.location !== okLocation(app)), app);
    assert.equal(e.events.filter(x => x.op === 'lookup' && x.matched).length, 2, 'ambos snapshots se capturaron antes de consumir');
  });
  await test('replay secuencial no puede canjear otra vez, APK=' + app, 'normal', async () => {
    const f = make({ app }); const first = await f.request(), second = await f.request(); const e = f.evidence([first, second]);
    assert.equal(first.location, okLocation(app)); assert.equal(e.oauthExchanges, 1); assert.equal(e.linkUpdates, 1); assert.equal(second.status, 302); assert.ok(second.location.endsWith('msg=state'));
  });
  for (const consumeFault of ['error-before', 'error-with-row', 'throw-before', 'throw-after', 'error-after', 'missingrows', 'rows-empty', 'rows-other', 'rows-multiple', 'absent', 'null']) {
    await test('consumo cerrado ' + consumeFault + ', APK=' + app, consumeFault === 'error-with-row' ? 'error' : 'fault', async () => {
      const f = make({ app, consumeFault }); const r = await f.request(), e = f.evidence([r]); closed(r, app); noOAuth(e);
      assert.equal(e.events.filter(x => x.op === 'consume').length, ['error-before', 'error-with-row', 'throw-before'].includes(consumeFault) ? 0 : 1, 'sin retry ni restauración');
      assert.ok(!JSON.stringify(e.logs).includes('fixture denied')); assert.ok(!JSON.stringify(e.logs).includes('fixture response lost'));
    });
  }
  await test('error de escritura final nunca es éxito, APK=' + app, 'save', async () => {
    const f = make({ app, finalFault: 'error-before' }); const r = await f.request(), e = f.evidence([r]); closed(r, app); assert.equal(e.oauthExchanges, 1); assert.equal(e.linkUpdates, 0); assert.equal(e.stateAfter, null); assert.equal(e.sessionAfter, f.initial.session_id);
  });
  await test('legacy null consume y conserva cursor, APK=' + app, 'normal', async () => {
    const f = make({ app, legacy: true }); const r = await f.request(), e = f.evidence([r]); assert.equal(r.location, okLocation(app)); assert.equal(e.oauthExchanges, 1); assert.equal(f.row().last_sync, f.initial.last_sync); assert.equal(f.row().accounts[0].iban, f.initial.iban);
  });
}
for (const beforeConsume of ['delete', 'replace', 'issuance']) await test('cero filas tras ' + beforeConsume + ' cierra antes de OAuth', 'zero', async () => {
  const f = make({ beforeConsume }); const r = await f.request(), e = f.evidence([r]); closed(r, false); noOAuth(e); assert.equal(e.consumeAffected, 0);
  if (beforeConsume === 'replace') { assert.equal(e.stateAfter, 'fixture-new-state'); assert.equal(e.statusAfter, 'pending'); }
  if (beforeConsume === 'issuance') assert.equal(e.stateAfter, f.initial.state);
});
for (const deny of ['denyIp', 'denyUser']) await test('denegación ' + deny + ' conserva autorización', 'rate', async () => {
  const f = make({ [deny]: true }); const r = await f.request(), e = f.evidence([r]); closed(r, false); noOAuth(e); assert.equal(e.consumeAffected, 0); assert.deepEqual(f.row(), f.initial);
  const rates = e.events.filter(x => x.op === 'rate'); assert.equal(rates.length, deny === 'denyIp' ? 1 : 2);
  assert.deepEqual(rates[0].args, { p_bucket: 'bank-callback-ip:' + createHash('sha256').update('192.0.2.1').digest('hex').slice(0, 32), p_limit: 60, p_window_secs: 60 });
  if (deny === 'denyUser') assert.deepEqual(rates[1].args, { p_bucket: 'bank-callback:fixture-user', p_limit: 10, p_window_secs: 600 });
  assert.equal(e.events.filter(x => x.op === 'lookup').length, deny === 'denyIp' ? 0 : 1);
  assert.equal(e.events.filter(x => x.op === 'diagnostic').length, 0);
});
await test('caducado no alcanza cuota de usuario ni consumo', 'normal', async () => {
  const f = make({ expired: true }); const r = await f.request(), e = f.evidence([r]); assert.ok(r.location.endsWith('msg=caducado')); noOAuth(e); assert.deepEqual(f.row(), f.initial); assert.equal(e.events.filter(x => x.op === 'rate').length, 1);
});
await test('orden IP,lookup,usuario,consumo,OAuth,guardado y cursor', 'normal', async () => {
  const f = make(); const r = await f.request(), e = f.evidence([r]); assert.equal(r.location, okLocation(false));
  assert.deepEqual(e.events.filter(x => x.op !== 'diagnostic').map(x => x.op), ['rate', 'lookup', 'rate', 'consume', 'oauth-exchange', 'link-update']);
  assert.equal(f.row().last_sync, f.initial.last_sync); assert.equal(f.row().accounts.length, 1); assert.equal(f.row().account_uid, 'fixture-account-1');
});
console.log(JSON.stringify({ suite: 'bank-callback-state', mutant: mutantName || null, pass, fail, limitation: 'handler real; BD y OAuth sintéticos, sin Postgres/SDK/transporte vivos' }));
process.exitCode = fail ? 1 : 0;
