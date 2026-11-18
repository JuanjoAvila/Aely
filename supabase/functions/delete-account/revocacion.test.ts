import assert from "node:assert/strict";

// Se ejecuta el texto del handler real; solo se sustituyen sus fronteras (SDK, Auth, proveedor).
// P3-06: borrar la cuenta revoca antes los consentimientos de Enable Banking, y si no se puede,
// borra igual: el derecho a borrar no depende del proveedor.
type Row = Record<string, unknown>;
let serial = 0;

async function montar(opts: { sesiones: (string | null)[]; revocar?: (s: (string | null)[]) => Promise<Row[]>; pass?: boolean }) {
  const traza: string[] = [];
  const consola: string[] = [];
  let handler!: (req: Request) => Promise<Response>;
  const admin = {
    from(tabla: string) {
      const q: Row = {};
      q.select = (cols: string) => { traza.push("select " + tabla + " " + cols); return q; };
      q.delete = () => { traza.push("delete " + tabla); return q; };
      q.eq = () => q;
      q.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: opts.sesiones.map((s) => ({ session_id: s })), error: null }).then(ok);
      return q;
    },
    auth: { admin: { deleteUser: async () => { traza.push("deleteUser"); return { error: null }; } } },
  };
  const usuario = {
    auth: {
      getUser: async () => ({ data: { user: { id: "u-sintetico", email: "x@example.invalid" } } }),
      signInWithPassword: async () => ({ error: opts.pass === false ? { message: "bad" } : null }),
    },
  };
  let clientes = 0;
  const mock = {
    Deno: { serve: (fn: typeof handler) => handler = fn, env: { get: () => "sintetico" } },
    createClient: (_u: string, key: string) => { clientes++; return key === "sintetico" && clientes === 2 ? admin : usuario; },
    jsonResp: (o: unknown, status = 200) => new Response(JSON.stringify(o), { status }),
    withCors: (f: typeof handler) => f,
    readInput: async (req: Request) => ({ ok: true, body: await req.json() }),
    rateLimit: async () => ({ ok: true }),
    revocarSesionesGuardadas: async (s: (string | null)[]) => {
      traza.push("revocar " + s.length);
      return opts.revocar ? opts.revocar(s) : s.map(() => ({ ok: true }));
    },
    console: { error: (...a: unknown[]) => consola.push(a.join(" ")) },
  };
  const key = "__delete_account_" + serial++;
  (globalThis as Record<string, unknown>)[key] = mock;
  const source = "const {" + Object.keys(mock).join(",") + "}=(globalThis as any)[" + JSON.stringify(key) + "];\n"
    + (await Deno.readTextFile(new URL("./index.ts", import.meta.url))).replace(/^import .*?;\r?\n/gm, "");
  try {
    await import("data:application/typescript," + encodeURIComponent(source));
  } finally { delete (globalThis as Record<string, unknown>)[key]; }
  const res = await handler(new Request("https://edge.invalid", { method: "POST", body: JSON.stringify({ password: "p" }) }));
  return { res, traza, consola };
}

Deno.test("revoca las sesiones guardadas ANTES de borrar filas y usuario", async () => {
  const { res, traza, consola } = await montar({ sesiones: ["enc:v1:a", null, "legacy"] });
  assert.equal(res.status, 200);
  const i = traza.indexOf("revocar 2");
  assert.ok(i >= 0, "solo las que tienen session_id: " + traza.join(" | "));
  assert.ok(i < traza.indexOf("delete bank_links") && i < traza.indexOf("deleteUser"));
  assert.deepEqual(consola, []);
});

Deno.test("si el proveedor falla, la cuenta se borra igual y el registro solo lleva clases cerradas", async () => {
  const { res, traza, consola } = await montar({
    sesiones: ["s1", "s2"],
    revocar: async () => [{ ok: true }, { ok: false, step: "revoke", status: 503, code: "ASPSP_ERROR" }],
  });
  assert.equal(res.status, 200);
  assert.ok(traza.includes("deleteUser"));
  assert.equal(consola.length, 1);
  assert.match(consola[0], /^delete-account: revocación no completada /);
  const detalle = JSON.parse(consola[0].replace(/^[^{]*/, ""));
  assert.deepEqual(detalle, { total: 2, fallos: [{ step: "revoke", status: 503, code: "ASPSP_ERROR" }] });
  assert.ok(!consola[0].includes("s1") && !consola[0].includes("s2"));
});

Deno.test("sin bancos no llama al proveedor", async () => {
  const { res, traza } = await montar({ sesiones: [] });
  assert.equal(res.status, 200);
  assert.ok(!traza.some((x) => x.startsWith("revocar")));
});

Deno.test("contraseña mal: ni revoca ni borra", async () => {
  const { res, traza } = await montar({ sesiones: ["s1"], pass: false });
  assert.equal(res.status, 403);
  assert.deepEqual(traza, []);
});
