// Ejecuta el TypeScript del handler, no una reimplementación. Todo I/O queda sustituido:
// la BD copia los SELECT y aplica filtros; ninguna petición puede alcanzar el banco real.
export const response = (status: number, data: unknown = {}) => new Response(JSON.stringify(data), { status });
export const accounts = () => response(200, { payload: { data: [] } });
export const refreshed = () => response(201, { payload: { data: { accessToken: "new-access", refreshToken: "new-refresh" } } });
export function fixture() {
  return {
    row: { user_id: "synthetic", status: "active", access_token: "access", refresh_token: "refresh", device_id: "device", updated_at: "2026-10-14T00:00:00Z", access_counter_version: "11111111-1111-4111-8111-111111111111", connection_version: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" } as Record<string, any>,
    counters: new Map<string, number>(), writes: [] as any[], rates: [] as string[],
    beforeWrite: null as null | (() => void), beforeRate: null as null | (() => void),
    saveError: false, rateError: false,
  };
}
export function hits(f: ReturnType<typeof fixture>) {
  const prefix = "mi-401-tras-refresco:synthetic";
  return f.counters.get(prefix + ":" + f.row.access_counter_version) ?? 0;
}
export function seedHits(f: ReturnType<typeof fixture>, n: number) {
  // El legado usa el bucket sin versión; la corrección debe aislarlo de la sesión actual.
  f.counters.set("mi-401-tras-refresco:synthetic", n);
  f.counters.set("mi-401-tras-refresco:synthetic:" + f.row.access_counter_version, n);
}
let serial = 0;
export async function run(
  name: "sync" | "connect" | "keepalive", f: ReturnType<typeof fixture>,
  options: { body?: unknown; access?: (n: number) => Response; refresh?: () => Response; login?: () => Response } = {},
) {
  let handler: (req: Request) => Promise<Response>, gets = 0;
  const db = {
    auth: { getUser: async () => ({ data: { user: { id: "synthetic" } } }) },
    from: (table: string) => {
      let patch: any, upsert = false;
      const filters: [string, unknown][] = [];
      const perform = () => {
        if (patch && f.beforeWrite) { const before = f.beforeWrite; f.beforeWrite = null; before(); }
        if (patch && f.saveError) return { data: null, error: { code: "synthetic" } };
        const matches = filters.every(([k, v]) => f.row[k] === v);
        if (patch && (upsert || matches)) { Object.assign(f.row, patch); f.writes.push({ ...patch }); }
        const row = table === "cron_secrets" ? { secret: "synthetic-cron" } : { ...f.row };
        return { data: (upsert || matches || table === "cron_secrets") ? row : null, error: null };
      };
      const q: any = {
        select: () => q,
        eq: (k: string, v: unknown) => { filters.push([k, v]); return q; },
        is: (k: string, v: unknown) => { filters.push([k, v]); return q; },
        maybeSingle: async () => perform(),
        then: (resolve: any, reject: any) => {
          const result = perform();
          return Promise.resolve({ ...result, data: patch ? result.data : [result.data].filter(Boolean) }).then(resolve, reject);
        },
      };
      return { ...q, update: (x: any) => { patch = x; return q; }, upsert: (x: any) => { patch = x; upsert = true; return q; } };
    },
    rpc: async (method: string, args: any) => {
      if (method !== "check_rate_limit") throw new Error("RPC sintético no previsto: " + method);
      if (f.beforeRate) { const before = f.beforeRate; f.beforeRate = null; before(); }
      if (f.rateError) return { error: { code: "synthetic" } };
      f.rates.push(args.p_bucket);
      const count = (f.counters.get(args.p_bucket) || 0) + 1;
      f.counters.set(args.p_bucket, count);
      return { data: count <= args.p_limit, error: null };
    },
  };
  const mock = {
    Deno: { serve: (h: typeof handler) => { handler = h; }, env: { get: () => "synthetic" } },
    createClient: () => db, withCors: (h: typeof handler) => h,
    miTokensFromRow: async (row: any) => ({ access: row.access_token, refresh: row.refresh_token, deviceId: row.device_id }),
    miTokensToRow: async (a: string, r: string) => ({ access_token: a, refresh_token: r }),
    ensureMiLinkEncrypted: async () => {}, timingSafeEqual: (a: string, b: string) => a === b,
    fetch: async (url: string) => {
      if (url.endsWith("/token/refresh")) return (options.refresh || refreshed)();
      if (url.endsWith("/v2/auth/token")) return (options.login || refreshed)();
      if (url.endsWith("/self-basic")) return (options.access || accounts)(gets++);
      throw new Error("ruta sintética no prevista");
    },
  };
  const globalKey = "__miCounter" + serial++;
  (globalThis as any)[globalKey] = mock;
  const files = ["myinvestor.ts", "ratelimit.ts", "../myinvestor-" + name + "/index.ts"];
  let source = "const {" + Object.keys(mock).join(",") + "} = (globalThis as any)[" + JSON.stringify(globalKey) + "];\n";
  for (const file of files) source += (await Deno.readTextFile(new URL(file, import.meta.url)))
    .replace(/^import .*?;\r?\n/gm, "").replace(/^export /gm, "") + "\n";
  try {
    await import("data:application/typescript," + encodeURIComponent(source));
    const req = new Request("https://synthetic.invalid", { method: "POST", headers: { "x-cron-key": "synthetic-cron", "content-type": "application/json" }, ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }) });
    const res = await handler!(req);
    return { status: res.status, data: await res.json() };
  } finally { delete (globalThis as any)[globalKey]; }
}

export async function encryptLegacy(f: ReturnType<typeof fixture>, before: () => void) {
  const key = "__miEncrypt" + serial++;
  const patch: Record<string, unknown> = {}, filters: [string, unknown][] = [];
  const q: any = {
    eq: (k: string, v: unknown) => { filters.push([k, v]); return q; },
    then: (resolve: any, reject: any) => {
      before();
      if (filters.every(([k, v]) => f.row[k] === v)) Object.assign(f.row, patch);
      return Promise.resolve({}).then(resolve, reject);
    },
  };
  (globalThis as any)[key] = { from: () => ({ update: (x: any) => { Object.assign(patch, x); return q; } }) };
  const source = 'const Deno={env:{get:()=>"synthetic"}}; const encryptSecret=async(x:string)=>"enc:v1:"+x; const decryptSecret=async(x:string)=>x;\n'
    + (await Deno.readTextFile(new URL("token_store.ts", import.meta.url))).replace(/^import .*?;\r?\n/gm, "")
    + '\nexport const encrypt=async(row:any)=>ensureMiLinkEncrypted((globalThis as any)[' + JSON.stringify(key) + '], "synthetic", row);';
  try {
    const mod = await import("data:application/typescript," + encodeURIComponent(source));
    await mod.encrypt({ ...f.row });
  } finally { delete (globalThis as any)[key]; }
}
