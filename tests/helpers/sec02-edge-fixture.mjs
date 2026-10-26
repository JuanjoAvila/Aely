// Transporte cerrado para auditar código TypeScript real sin instalar Deno ni SDK.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { webcrypto } from 'node:crypto';
const root = new URL('../../', import.meta.url);
const require = createRequire(import.meta.url);
// CI usa Node 20. El override local solo lee el esbuild ya instalado, sin junction/install.
const { transformSync } = require(process.env.AELY_SEC02_ESBUILD || 'esbuild');
const clone = value => structuredClone(value);

export function edgeRuntime({ db, env = {}, transport, provider = {}, tokens = {}, mutate } = {}) {
  let handler;
  const logs = [], fetches = [], modules = new Map();
  const context = vm.createContext({
    Deno: { env: { get: key => ({ SUPABASE_URL: 'https://database.invalid', SUPABASE_ANON_KEY: 'synthetic', SUPABASE_SERVICE_ROLE_KEY: 'synthetic', APP_URL: 'https://app.invalid/', ...env })[key] }, serve: fn => { handler = fn; } },
    Request, Response, Headers, URL, URLSearchParams, TextEncoder, TextDecoder, Uint8Array,
    crypto: webcrypto, AbortController, AbortSignal, Date, setTimeout, clearTimeout,
    console: { error: (...args) => logs.push(args), log: (...args) => logs.push(args) },
    fetch: async (url, init) => {
      fetches.push({ url: String(url), body: init?.body });
      if (!transport) throw Error('Unexpected transport: network prohibited');
      return transport(url, init);
    },
  }, { codeGeneration: { strings: false, wasm: false } });
  function load(file) {
    if (modules.has(file)) return modules.get(file);
    if (file === 'https://esm.sh/@supabase/supabase-js@2') return { createClient: () => db };
    if (file.endsWith('/token_store.ts') && Object.keys(tokens).length) return tokens;
    if (file.endsWith('/enablebanking.ts') && Object.keys(provider).length) return provider;
    if (!file.startsWith('supabase/functions/') || file.includes('..')) throw Error('Unexpected module ' + file);
    let source = fs.readFileSync(new URL(file, root), 'utf8');
    if (mutate) source = mutate(file, source);
    const names = [...source.matchAll(/^export\s+(?:async\s+)?(?:function|class|const|let|var)\s+(\w+)/gm)].map(x => x[1]);
    source = source.replace(/^import\s+\{([^}]+)\}\s+from\s+["']([^"']+)["'];?\s*$/gm, (_, bindings, ref) => {
      const target = ref.startsWith('.') ? path.posix.normalize(path.posix.join(path.posix.dirname(file), ref)) : ref;
      const binding = bindings.split(',').map(x => x.trim()).filter(x => x && !x.startsWith('type ')).join(',').replace(/\b(\w+)\s+as\s+(\w+)\b/g, '$1: $2');
      if (!binding) return '';
      return 'const {' + binding + '} = __load(' + JSON.stringify(target) + ');';
    }).replace(/^export\s+/gm, '');
    const js = transformSync(source, { loader: 'ts', target: 'es2022' }).code;
    if (/^\s*(?:import|export)\b/m.test(js)) throw Error('Unresolved module syntax ' + file);
    const wrapper = vm.runInContext('(function(__load){"use strict";\n' + js + '\nreturn {' + names.join(',') + '};})', context, { filename: file, timeout: 2000 });
    const value = wrapper(load); modules.set(file, value); return value;
  }
  return { load, logs, fetches, get handler() { return handler; } };
}

// Las cuotas son un doble del RPC, no una prueba de atomicidad/ventanas de Postgres.
export function quotaDb() {
  const counts = new Map(), calls = [];
  let user = 'synthetic-a', fault = false;
  return {
    counts, calls, setUser(value) { user = value; }, setFault(value) { fault = value; },
    auth: { getUser: async () => ({ data: { user: { id: user } }, error: null }) },
    rpc: async (name, args) => {
      calls.push({ name, args: clone(args) });
      if (fault) return { data: null, error: { code: '42501', message: 'private synthetic failure' } };
      const n = (counts.get(args.p_bucket) || 0) + 1; counts.set(args.p_bucket, n);
      return { data: n <= args.p_limit, error: null };
    },
    from() { throw Error('Help must never read financial tables'); },
  };
}

// Modelo relacional mínimo: filtros reales + ambas restricciones de identidad.
export function ingestFixture({ rows = [], mutate } = {}) {
  const stored = clone(rows), events = [], queries = [];
  let sequence = stored.length;
  const db = {
    rpc: async () => ({ data: true, error: null }),
    from(table) {
      let operation = 'select', filters = [], payload, options, single = false, executed;
      const q = {
        select() { return q; }, eq(k, v) { filters.push(['eq', k, v]); return q; },
        in(k, v) { filters.push(['in', k, v]); return q; }, gte(k, v) { filters.push(['gte', k, v]); return q; },
        lte(k, v) { filters.push(['lte', k, v]); return q; }, lt(k, v) { filters.push(['lt', k, v]); return q; },
        limit() { return q; }, update(p) { operation = 'update'; payload = p; return q; },
        upsert(p, o) { operation = 'upsert'; payload = clone(p); options = o; return q; },
        insert(p) { operation = 'insert'; payload = clone(p); return q; }, delete() { operation = 'delete'; return q; },
        maybeSingle() { single = true; return run(); }, then(a, b) { return run().then(a, b); },
      };
      function run() { return executed ||= Promise.resolve().then(() => {
        queries.push({ table, operation, filters: clone(filters) });
        if (table === 'ingest_tokens') {
          const token = filters.find(x => x[1] === 'token')?.[2];
          return { data: { user_id: token === 'synthetic-token-b' ? 'synthetic-b' : 'synthetic-a' }, error: null };
        }
        if (table === 'app_state') return { data: null, error: null };
        if (table === 'app_events') { events.push(payload); return { data: null, error: null }; }
        if (table !== 'expenses') throw Error('Unexpected table ' + table);
        const matching = () => stored.filter(r => filters.every(([op, k, v]) => op === 'eq' ? r[k] === v : op === 'in' ? v.includes(r[k]) : op === 'gte' ? r[k] >= v : op === 'lte' ? r[k] <= v : r[k] < v));
        if (operation === 'select') { const found = matching(); return { data: single ? found[0] || null : clone(found), error: null }; }
        if (operation === 'update') { matching().forEach(r => Object.assign(r, payload)); return { data: [], error: null }; }
        if (operation === 'delete') { for (const r of matching()) stored.splice(stored.indexOf(r), 1); return { data: [], error: null }; }
        const keys = options.onConflict.split(',');
        if (stored.some(r => keys.every(k => r[k] === payload[k]))) return { data: [], error: null };
        if (payload.ingest_event_id && stored.some(r => r.user_id === payload.user_id && r.ingest_event_id === payload.ingest_event_id)) return { data: null, error: { code: '23505' } };
        const row = { ...payload, id: 'synthetic-row-' + (++sequence), created_at: payload.fecha }; stored.push(row);
        return { data: [{ id: row.id }], error: null };
      }); }
      return q;
    },
  };
  const runtime = edgeRuntime({ db, mutate }); runtime.load('supabase/functions/ingest/index.ts');
  const request = (evento, { token = 'synthetic-token-a', fecha = '2026-10-25T12:00:00.000Z' } = {}) => runtime.handler(new Request('https://edge.invalid/', { method: 'POST', headers: { 'x-ingest-token': token, 'content-type': 'application/json', 'x-forwarded-for': '192.0.2.1' }, body: JSON.stringify({ evento, fecha: String(Date.parse(fecha)), texto: 'Has gastado 9,95 € en Synthetic Shop', fuente: 'tr' }) }));
  return { request, rows: stored, events, queries };
}
