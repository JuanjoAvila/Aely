import assert from "node:assert/strict";

// Investigación OPS-08: ejecuta los handlers y helpers REALES de la base aislada.
// Sin permisos de red/env: todo I/O se sustituye, no hay cliente ni banco reales.
const root = new URL(Deno.args[0] || "../", import.meta.url);
type Actor = "keepalive" | "sync";
type Row = Record<string, any>;

Deno.test("sync no atribuye a competidor un readback legacy fallido", async () => {
  const f = fixture(); f.options.encrypt = true; f.options.readError = true;
  const result = await run("sync", f, () => { throw Error("no debe refrescar"); });
  assert.equal(result.code, "refresh_not_saved");
  assert.equal(f.trace.filter(x => x.event === "refresh").length, 0);
});
const response = (status: number, data: unknown = {}) =>
  new Response(JSON.stringify(data), { status });
const rotated = (id: string) =>
  response(201, {
    payload: {
      data: {
        accessToken: "A-" + id,
        refreshToken: "R-" + id,
        refreshExpiresIn: 3600,
      },
    },
  });
const gate = () => {
  let release!: () => void;
  const promise = new Promise<void>((r) => release = r);
  return { promise, release };
};
function fixture() {
  return {
    row: {
      user_id: "synthetic",
      status: "active",
      access_token: "A0",
      refresh_token: "R0",
      device_id: "D0",
      connection_version: "connection-0",
      access_counter_version: "counter-0",
    } as Row,
    trace: [] as any[],
    beforeWrite: null as null | ((actor: Actor, patch: Row) => Promise<void>),
    loseAck: null as Actor | null,
    afterLostAck: null as null | (() => Promise<void>),
    options: {} as Row,
  };
}
let serial = 0;
async function run(
  actor: Actor,
  f: ReturnType<typeof fixture>,
  refresh: (token: string) => Promise<Response> | Response,
) {
  let handler!: (req: Request) => Promise<Response>, gets = 0;
  const db = {
    auth: { getUser: async () => ({ data: { user: { id: "synthetic" } } }) },
    from: (table: string) => {
      let patch: Row | undefined, selected = false;
      const filters: [string, unknown][] = [];
      const perform = async (single: boolean) => {
        if (patch && f.beforeWrite) await f.beforeWrite(actor, patch);
        const matches = filters.every(([k, v]) => f.row[k] === v);
        if (patch) {
          f.trace.push({
            event: "update",
            actor,
            filters,
            patch: { ...patch },
            matched: matches,
          });
          if (f.options.failWrites > 0) {
            f.options.failWrites--;
            return { data: null, error: { code: "synthetic-save" } };
          }
          if (f.options.zeroWrites) return { data: [], error: null };
          if (matches) Object.assign(f.row, patch);
          if (matches && patch.refresh_token && f.loseAck === actor) {
            f.loseAck = null;
            if (f.afterLostAck) await f.afterLostAck();
            return { data: null, error: { code: "synthetic-ack-lost" } };
          }
          return {
            data: selected
              ? (single
                ? (matches ? { user_id: "synthetic" } : null)
                : (matches ? [{ user_id: "synthetic" }] : []))
              : null,
            error: null,
          };
        }
        if (
          table === "myinvestor_links" && f.options.readError &&
          f.trace.some((x) => x.event === "update")
        ) return { data: null, error: { code: "synthetic-read" } };
        const rows: Row[] = table === "app_events"
          ? []
          : table === "cron_secrets"
          ? [{ secret: "synthetic-cron" }]
          : (matches ? [{ ...f.row }] : []);
        f.trace.push({
          event: "select",
          actor,
          table,
          refresh: rows[0]?.refresh_token,
        });
        return { data: single ? (rows[0] ?? null) : rows, error: null };
      };
      const q: any = {
        select: () => {
          selected = true;
          return q;
        },
        eq: (k: string, v: unknown) => {
          filters.push([k, v]);
          return q;
        },
        is: (k: string, v: unknown) => {
          filters.push([k, v]);
          return q;
        },
        update: (p: Row) => {
          patch = p;
          return q;
        },
        maybeSingle: () => perform(true),
        gte: () => q,
        like: () => q,
        order: () => q,
        limit: () => q,
        insert: async () => ({ error: null }),
        then: (ok: any, ko: any) => perform(false).then(ok, ko),
      };
      return q;
    },
  };
  const decode = (x: string) =>
    x?.startsWith("enc:") ? x.slice(x.indexOf(":", 4) + 1) : x;
  const encode = (x: string) =>
    !x || !f.options.encrypt ? x : "enc:" + (serial++) + ":" + decode(x);
  const mock = {
    Deno: {
      serve: (h: typeof handler) => handler = h,
      env: {
        get: (key: string) =>
          key === "TOKEN_ENCRYPTION_KEY"
            ? (f.options.encrypt ? "synthetic" : undefined)
            : "synthetic",
      },
    },
    createClient: () => db,
    withCors: (h: typeof handler) => h,
    miTokensFromRow: async (l: Row) => ({
      access: decode(l.access_token),
      refresh: decode(l.refresh_token),
      deviceId: l.device_id,
    }),
    miTokensToRow: async (a: string, r: string) => ({
      access_token: encode(a),
      refresh_token: encode(r),
    }),
    isEncrypted: (x: string) => x.startsWith("enc:"),
    timingSafeEqual: (a: string, b: string) => a === b,
    rateLimit: async () => ({ ok: true, checked: true }),
    fetch: async (url: string, init: any) => {
      if (url.endsWith("/token/refresh")) {
        const token = JSON.parse(init.body).refreshToken;
        f.trace.push({ event: "refresh", actor, token });
        return await refresh(token);
      }
      if (url.endsWith("/self-basic")) {
        return gets++ === 0
          ? response(401)
          : response(200, { payload: { data: [] } });
      }
      throw Error("Unexpected synthetic route");
    },
  };
  const key = "__ops08_" + serial++;
  (globalThis as any)[key] = mock;
  let source = "const {" + Object.keys(mock).join(",") +
    "}=(globalThis as any)[" + JSON.stringify(key) + "];\n";
  for (
    const p of [
    "_shared/request_body.ts",
    "_shared/myinvestor.ts",
      "_shared/myinvestor-refresh-save.ts",
      "myinvestor-" + actor + "/index.ts",
    ]
  ) {
    source += (await Deno.readTextFile(new URL(p, root))).replace(
      /^import .*?;\r?\n/gm,
      "",
    ).replace(/^export /gm, "") + "\n";
  }
  try {
    await import("data:application/typescript," + encodeURIComponent(source));
    const res = await handler(
      new Request("https://synthetic.invalid", {
        method: "POST",
        headers: { "x-cron-key": "synthetic-cron" },
        body: "{}",
      }),
    );
    return await res.json();
  } finally {
    delete (globalThis as any)[key];
  }
}

// Ambos requests leen R0. El proveedor sintético permite dos refresh concurrentes:
// emite R-old y luego R-new; sólo R-new queda válido. Se retrasa la entrega de R-old.
// Este supuesto de aceptación concurrente NO acredita el comportamiento del banco vivo.
for (const old of ["keepalive", "sync"] as Actor[]) {
  Deno.test(
    "" + old + " lento no debe pisar rotacion mas reciente del otro handler",
    async () => {
      const f = fixture(),
        entered = gate(),
        resume = gate(),
        other: Actor = old === "sync" ? "keepalive" : "sync";
      const pending = run(old, f, async (token) => {
        assert.equal(token, "R0");
        entered.release();
        await resume.promise;
        return rotated("old");
      });
      await entered.promise;
      await run(other, f, (token) => {
        assert.equal(token, "R0");
        return rotated("new");
      });
      assert.equal(f.row.refresh_token, "R-new");
      resume.release();
      const result = await pending;
      assert.equal(
        f.row.refresh_token,
        "R-new",
        "una respuesta antigua no debe reemplazar el token vigente",
      );
    },
  );
}

// Sin aceptar dos veces un token consumido: el primer éxito no entrega refreshToken
// (rama de compatibilidad real de ambos handlers); el siguiente sí rota R0 -> R-new.
for (const old of ["keepalive", "sync"] as Actor[]) {
  Deno.test(
    "" + old +
      " sin rotacion tardio no debe restaurar R0 despues de rotacion secuencial",
    async () => {
      const f = fixture(),
        entered = gate(),
        resume = gate(),
        other: Actor = old === "sync" ? "keepalive" : "sync";
      let paused = false;
      f.beforeWrite = async (actor, patch) => {
        if (actor === old && patch.refresh_token && !paused) {
          paused = true;
          entered.release();
          await resume.promise;
        }
      };
      const pending = run(old, f, (token) => {
        assert.equal(token, "R0");
        return response(201, { payload: { data: { accessToken: "A-old" } } });
      });
      await entered.promise;
      await run(other, f, (token) => {
        assert.equal(token, "R0");
        return rotated("new");
      });
      assert.equal(f.row.refresh_token, "R-new");
      resume.release();
      const result = await pending;
      assert.equal(f.row.refresh_token, "R-new");
    },
  );
}

for (const actor of ["keepalive", "sync"] as Actor[]) {
  Deno.test(
    (actor === "keepalive" ? "" : "CONTROL ") + actor +
      " no debe pisar reconexion aun si reutiliza refresh",
    async () => {
      const f = fixture();
      const result = await run(actor, f, () => {
        Object.assign(f.row, {
          connection_version: "connection-new",
          access_token: "A-reconnected",
        });
        return rotated("old");
      });
      assert.equal(f.row.access_token, "A-reconnected");
      assert.equal(f.row.refresh_token, "R0");
    },
  );
}

for (const old of ["keepalive", "sync"] as Actor[]) {
  Deno.test(
    "CONTROL rechazo " + old + " despues de rotacion del otro conserva enlace",
    async () => {
      const f = fixture(),
        entered = gate(),
        resume = gate(),
        other: Actor = old === "sync" ? "keepalive" : "sync";
      const pending = run(old, f, async () => {
        entered.release();
        await resume.promise;
        return response(401);
      });
      await entered.promise;
      await run(other, f, () => rotated("new"));
      resume.release();
      const result = await pending;
      assert.equal(f.row.refresh_token, "R-new");
      assert.equal(f.row.status, "active");
      assert.equal(result.authExpired, undefined);
    },
  );
}

Deno.test("sync con ACK perdido no debe reescribir token rotado por keepalive antes del reintento", async () => {
  const f = fixture();
  f.loseAck = "sync";
  f.afterLostAck = async () => {
    await run("keepalive", f, (token) => {
      assert.equal(token, "R-old");
      return rotated("new");
    });
  };
  const result = await run("sync", f, () => rotated("old"));
  assert.equal(f.row.refresh_token, "R-new");
});

Deno.test("CONTROL sync ACK perdido sin competidor puede confirmar su guardado sin repetir refresh", async () => {
  const f = fixture();
  f.loseAck = "sync";
  let calls = 0;
  const result = await run("sync", f, () => {
    calls++;
    return rotated("own");
  });
  assert.equal(result.ok, true);
  assert.equal(calls, 1);
  assert.equal(f.row.refresh_token, "R-own");
});

Deno.test("keepalive no debe contar guardado con ACK perdido sin readback", async () => {
  const f = fixture();
  f.loseAck = "keepalive";
  const result = await run("keepalive", f, () => rotated("own"));
  const reread =
    f.trace.filter((x) =>
      x.event === "select" && x.table === "myinvestor_links"
    ).length > 1;
  assert.ok(
    result.refreshed === 0 || reread,
    "sin acuse ni readback no puede contar confirmado",
  );
});

for (const actor of ["keepalive", "sync"] as Actor[]) {
  Deno.test(
    actor + " sin rotacion no pisa acceso cambiado mientras refrescaba",
    async () => {
      const f = fixture();
      const result = await run(actor, f, () => {
        f.row.access_token = "A-winner";
        return response(201, { payload: { data: { accessToken: "A-old" } } });
      });
      assert.equal(f.row.access_token, "A-winner");
      assert.equal(f.row.refresh_token, "R0");
      assert.equal(
        actor === "sync" ? result.ok : result.refreshed,
        actor === "sync" ? false : 0,
      );
    },
  );
}

for (const actor of ["keepalive", "sync"] as Actor[]) {
  Deno.test(
    actor + " confirma acuse perdido propio con un UPDATE y un refresh",
    async () => {
      const f = fixture();
      f.loseAck = actor;
      const result = await run(actor, f, () => rotated("own"));
      assert.equal(
        actor === "sync" ? result.ok : result.refreshed,
        actor === "sync" ? true : 1,
      );
      assert.equal(f.trace.filter((x) => x.event === "refresh").length, 1);
      assert.equal(
        f.trace.filter((x) => x.event === "update" && x.patch.refresh_token)
          .length,
        1,
      );
    },
  );
  Deno.test(
    actor + " conserva estado indeterminado si pierde acuse y readback",
    async () => {
      const f = fixture();
      f.loseAck = actor;
      f.options.readError = true;
      const result = await run(actor, f, () => rotated("own"));
      assert.equal(
        actor === "sync" ? result.code : result.refreshed,
        actor === "sync" ? "refresh_not_saved" : 0,
      );
      assert.equal(f.row.refresh_token, "R-own");
      assert.equal(f.trace.filter((x) => x.event === "refresh").length, 1);
    },
  );
  Deno.test(
    actor + " cero filas no cuenta exito ni entrega posiciones",
    async () => {
      const f = fixture();
      f.options.zeroWrites = true;
      const result = await run(actor, f, () => rotated("own"));
      assert.equal(
        actor === "sync" ? result.ok : result.refreshed,
        actor === "sync" ? false : 0,
      );
      assert.equal(result.positions, undefined);
      assert.equal(f.row.refresh_token, "R0");
    },
  );
  Deno.test(
    actor + " reintenta mismo patch una vez si fallo sin aplicar",
    async () => {
      const f = fixture();
      f.options.failWrites = 1;
      const result = await run(actor, f, () => rotated("own"));
      assert.equal(
        actor === "sync" ? result.ok : result.refreshed,
        actor === "sync" ? true : 1,
      );
      const writes = f.trace.filter((x) =>
        x.event === "update" && x.patch.refresh_token
      );
      assert.equal(writes.length, 2);
      assert.deepEqual(writes[0].patch, writes[1].patch);
      assert.deepEqual(writes[0].filters, writes[1].filters);
      assert.equal(f.trace.filter((x) => x.event === "refresh").length, 1);
    },
  );
}

Deno.test("sync recifra legacy con CAS y usa snapshot ciphertext coherente", async () => {
  const f = fixture();
  f.options.encrypt = true;
  const result = await run("sync", f, (token) => {
    assert.equal(token, "R0");
    return rotated("own");
  });
  assert.equal(result.ok, true);
  assert.match(f.row.refresh_token, /^enc:\d+:R-own$/);
  const writes = f.trace.filter((x) =>
    x.event === "update" && x.patch.refresh_token
  );
  assert.equal(writes.length, 2);
  assert.equal(
    writes[1].filters.find(([k]: any) => k === "refresh_token")[1],
    writes[0].patch.refresh_token,
  );
});
Deno.test("sync recifrado legacy no pisa reconexion ni llega al banco", async () => {
  const f = fixture();
  f.options.encrypt = true;
  f.beforeWrite = async () => {
    f.row.connection_version = "connection-new";
    f.row.access_token = "A-new";
  };
  const result = await run("sync", f, () => {
    throw Error("no debe refrescar");
  });
  assert.equal(result.code, "refresh_raced");
  assert.equal(f.row.access_token, "A-new");
  assert.equal(f.trace.filter((x) => x.event === "refresh").length, 0);
});
Deno.test("keepalive sin version de conexion no consume credencial", async () => {
  const f = fixture();
  delete f.row.connection_version;
  const result = await run("keepalive", f, () => {
    throw Error("no debe refrescar");
  });
  assert.equal(result.refreshed, 0);
  assert.equal(f.trace.filter((x) => x.event === "refresh").length, 0);
});
for (const actor of ["keepalive", "sync"] as Actor[]) {
  Deno.test(
    actor +
      " rechazo antiguo no caduca refresh cambiado entre lectura y UPDATE",
    async () => {
      const f = fixture();
      f.beforeWrite = async (_actor, patch) => {
        if (patch.status === "expired") {
          f.row.refresh_token = "R-winner";
          f.row.access_token = "A-winner";
        }
      };
      const result = await run(actor, f, () => response(401));
      assert.equal(f.row.status, "active");
      assert.equal(f.row.refresh_token, "R-winner");
      assert.equal(result.authExpired, undefined);
    },
  );
}
