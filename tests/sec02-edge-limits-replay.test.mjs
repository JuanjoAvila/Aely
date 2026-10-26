// SEC02: handlers y limitador reales; SDK/RPC/proveedor cerrados y sintéticos.
import assert from 'node:assert/strict';
import { edgeRuntime, ingestFixture, quotaDb } from './helpers/sec02-edge-fixture.mjs';
let passed = 0;
async function check(name, fn) { await fn(); passed++; console.log('PASS ' + name); }
const response = body => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
const mutation = process.env.SEC02_MUTANT || '';
function mutate(file, source) {
  const cases = {
    'help-sin-freno': ['help-assistant/index.ts', 'if (!gate.ok)', 'if (false)'],
    'help-fallo-abierto': ['help-assistant/index.ts', 'if (!gate.checked)', 'if (false)'],
    'ingest-ack-sin-owner': ['ingest/index.ts', '.select("id").eq("user_id", userId).eq("ingest_event_id", eventKey)', '.select("id").eq("ingest_event_id", eventKey)'],
  };
  if (!mutation) return source;
  assert.ok(cases[mutation], 'mutación conocida');
  const [suffix, before, after] = cases[mutation];
  if (!file.endsWith(suffix)) return source;
  assert.equal(source.split(before).length, 2, 'ancla única');
  const changed = source.replace(before, after);
  return mutation === 'help-fallo-abierto' ? changed.replace('if (!daily.checked)', 'if (false)') : changed;
}
function help(db) {
  const runtime = edgeRuntime({ db, mutate, env: { AELY_HELP_AI_ENABLED: 'true', OPENAI_API_KEY: 'synthetic' }, transport: async () => response({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ topics: ['cash'], confidence: 'high' }) }] }] }) });
  runtime.load('supabase/functions/help-assistant/index.ts');
  return { runtime, request: () => runtime.handler(new Request('https://edge.invalid/', { method: 'POST', headers: { Authorization: 'Bearer synthetic', 'content-type': 'application/json' }, body: JSON.stringify({ question: '¿Cómo apunto efectivo?', userId: 'untrusted-owner' }) })) };
}
await check('help usa RPC real y separa usuario, día y presupuesto global', async () => {
  const db = quotaDb(), h = help(db);
  assert.equal((await h.request()).status, 200);
  assert.deepEqual(db.calls.map(x => x.args), [
    { p_bucket: 'help-assistant:synthetic-a', p_limit: 15, p_window_secs: 600 },
    { p_bucket: 'help-assistant-day:synthetic-a', p_limit: 30, p_window_secs: 86400 },
    { p_bucket: 'help-assistant-total-day', p_limit: 1000, p_window_secs: 86400 },
  ]);
  db.setUser('synthetic-b'); assert.equal((await h.request()).status, 200);
  assert.equal(db.counts.get('help-assistant:synthetic-a'), 1);
  assert.equal(db.counts.get('help-assistant:synthetic-b'), 1);
  assert.equal(db.counts.get('help-assistant-total-day'), 2);
  assert.equal(h.runtime.fetches.length, 2);
});
await check('16 llamadas solapadas admiten solo 15 gastos de proveedor por usuario', async () => {
  const db = quotaDb(), h = help(db);
  const statuses = await Promise.all(Array.from({ length: 16 }, () => h.request().then(r => r.status)));
  assert.equal(statuses.filter(s => s === 200).length, 15);
  assert.equal(statuses.filter(s => s === 429).length, 1);
  assert.equal(h.runtime.fetches.length, 15);
  assert.equal(db.counts.get('help-assistant-day:synthetic-a'), 15);
  assert.equal(db.counts.get('help-assistant-total-day'), 15);
});
await check('cuota diaria/global y RPC averiado cierran ANTES del proveedor', async () => {
  for (const bucket of ['help-assistant-day:synthetic-a', 'help-assistant-total-day']) {
    const db = quotaDb(), h = help(db); db.counts.set(bucket, bucket.includes('total') ? 1000 : 30);
    assert.equal((await h.request()).status, 429); assert.equal(h.runtime.fetches.length, 0);
  }
  const db = quotaDb(), h = help(db); db.setFault(true);
  assert.equal((await h.request()).status, 503); assert.equal(h.runtime.fetches.length, 0);
  assert.equal(JSON.stringify(h.runtime.logs).includes('private synthetic failure'), false);
});
await check('ACK nativo no cruza propietarios ni descarta un mes distinto', async () => {
  const event = 'tr:trade_republic:v1_shared';
  const f = ingestFixture({ mutate, rows: [{ id: 'synthetic-existing', user_id: 'synthetic-a', ingest_event_id: event, fecha: '2026-09-25T12:00:00.000Z', importe: 9.95, comercio: 'Synthetic Shop', source: 'macrodroid' }] });
  const result = await (await f.request('v1_shared', { token: 'synthetic-token-b' })).json();
  assert.equal(result.ok, true); assert.equal(result.dup, undefined);
  assert.equal(f.rows.length, 2);
  assert.equal(f.rows[1].user_id, 'synthetic-b');
  assert.equal(Math.round(f.rows[1].importe * 100), 995);
  assert.equal(f.rows[1].fecha.slice(0, 7), '2026-10');
  for (const q of f.queries.filter(q => q.table === 'expenses')) assert.ok(q.filters.some(x => x[0] === 'eq' && x[1] === 'user_id' && x[2] === 'synthetic-b') || q.operation === 'upsert');
});
await check('misma cuantía en meses distintos con huellas distintas conserva 1990 céntimos', async () => {
  const f = ingestFixture({ mutate });
  for (const [event, fecha] of [['v1_september', '2026-09-25T12:00:00.000Z'], ['v1_october', '2026-10-25T12:00:00.000Z']]) {
    const r = await (await f.request(event, { fecha })).json(); assert.equal(r.ok, true); assert.equal(r.dup, undefined);
  }
  assert.equal(f.rows.length, 2); assert.equal(f.rows.reduce((n, r) => n + Math.round(r.importe * 100), 0), 1990);
  assert.deepEqual(f.rows.map(r => r.fecha.slice(0, 7)), ['2026-09', '2026-10']);
});
console.log(JSON.stringify({ suite: 'sec02-edge-limits-replay', passed, network: 0, postgresVerified: false }));
