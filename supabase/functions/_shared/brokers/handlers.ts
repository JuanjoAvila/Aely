// ============================================================
// broker-connect / broker-sync / broker-disconnect (plan de brókers por conexión, 19/11/2026).
//
// Molde MyInvestor: la credencial vive CIFRADA en el servidor (`broker_links`, migración 0031) y
// el cliente solo ve el estado. Diferencias a propósito:
//  · Solo se guardan credenciales de SOLO LECTURA, comprobado aquí antes de guardar: el token Flex
//    de IBKR solo descarga informes; de Kraken se lee la lista de permisos y una clave que pueda
//    operar o retirar se rechaza sin guardarla.
//  · Sin TOKEN_ENCRYPTION_KEY no se guarda NADA, pase lo que pase con TOKEN_ENCRYPTION_REQUIRED:
//    el modo «en claro con aviso» de crypto.ts existe para no dejar sin bancos a la familia, y
//    aquí no hay nada instalado que proteger.
//  · `broker-sync` no escribe posiciones (igual que myinvestor-sync): las devuelve y el móvil las
//    re-ancla con la vista previa de la 243.
// Las dependencias llegan inyectadas para que los tests Deno ejecuten ESTE código sin red ni BD.
// ============================================================

import { readInput } from "../request_body.ts";
import { ibkrCheckXml, ibkrFetchStatement, ibkrTokenMuerto } from "./ibkr.ts";
import { krakenCheckKeyInfo, krakenPrivate, krakenSnapshot } from "./kraken.ts";

// deno-lint-ignore no-explicit-any
type Any = any;
export type BrokerDeps = {
  userOf: (req: Request) => Promise<{ id: string } | null>;
  admin: Any;
  fetch: (url: string, init?: RequestInit) => Promise<Response>;
  sleep: (ms: number) => Promise<void>;
  encrypt: (s: string) => Promise<string | null>;
  decrypt: (s: string | null) => Promise<string | null>;
  keyReady: () => Promise<boolean>;
  rateLimit: (admin: Any, bucket: string, limit: number, windowSecs: number) => Promise<{ ok: boolean }>;
  now: () => number;
  uuid: () => string;
  log: (line: string) => void;
};

export const BROKERS_API = ["ibkr", "kraken"] as const;
const ENC = "enc:v1:";

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Content-Type": "application/json" },
  });
}

/* Cifra o no guarda. Un valor que no sale con el prefijo `enc:v1:` es que la clave no estaba,
   y ese no se escribe en la BD ni por un momento. */
async function cifrar(deps: BrokerDeps, s: string): Promise<string | null> {
  try {
    const e = await deps.encrypt(s);
    return e && e.startsWith(ENC) ? e : null;
  } catch (_) { return null; }
}

const hoy = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function brokerConnectHandler(deps: BrokerDeps) {
  return async (req: Request): Promise<Response> => {
    try {
      const input = await readInput(req, "broker-connect");
      if (!input.ok) return json({ ok: false, error: input.error }, input.status);
      const user = await deps.userOf(req);
      if (!user) return json({ ok: false, error: "sin sesión" }, 401);
      const body = input.body as { broker: "ibkr" | "kraken"; a: string; b: string };
      const broker = body.broker, a = body.a.trim(), b = body.b.trim();

      // Un dedo nervioso o un bucle no pueden machacar al bróker con la clave de alguien.
      const gate = await deps.rateLimit(deps.admin, "broker-connect:" + user.id, 10, 600);
      if (!gate.ok) return json({ ok: false, code: "rate" }, 429);
      // Antes de mandar la credencial a ningún sitio: si no se va a poder guardar cifrada, ni se prueba.
      if (!(await deps.keyReady())) { deps.log("broker-connect: no_key"); return json({ ok: false, code: "no_key" }, 503); }

      const now = deps.now();
      let snapshot: Record<string, unknown>;
      let meta: Record<string, unknown>;
      let nonce = 0;
      if (broker === "ibkr") {
        const got = await ibkrFetchStatement(deps.fetch, a, b, deps.sleep);
        if (!got.ok) { deps.log("broker-connect: ibkr " + got.code); return json({ ok: false, code: got.code }); }
        const chk = ibkrCheckXml(got.xml);
        if (!chk.ok) { deps.log("broker-connect: ibkr " + chk.code); return json({ ok: false, code: chk.code }); }
        meta = { accounts: chk.accounts, connectedAt: new Date(now).toISOString() };
        snapshot = { ok: true, broker, asOf: chk.toDate, snapshot: true, flexXml: got.xml };
      } else {
        // Nonce en microsegundos: siempre por encima de cualquiera que la clave haya visto antes.
        nonce = now * 1000;
        const info = await krakenPrivate(deps.fetch, "GetApiKeyInfo", a, b, nonce);
        if (!info.ok) { deps.log("broker-connect: kraken " + info.code); return json({ ok: false, code: info.code }); }
        const v = krakenCheckKeyInfo(info.result);
        if (!v.ok) {
          deps.log("broker-connect: kraken " + v.code);
          // `perm` es un nombre de permiso de la lista de Kraken, nunca dato de la cuenta.
          return json({ ok: false, rejected: true, code: v.code, perm: v.perm ?? null });
        }
        const snap = await krakenSnapshot(deps.fetch, a, b, async () => ++nonce);
        if (!snap.ok) { deps.log("broker-connect: kraken " + snap.code); return json({ ok: false, code: snap.code }); }
        meta = { perms: v.meta.perms, expiresAt: v.meta.expiresAt, connectedAt: new Date(now).toISOString() };
        snapshot = { ok: true, broker, asOf: hoy(now), snapshot: true, positions: snap.positions, present: snap.present, cash: snap.cash, warnings: snap.warnings };
      }

      const ca = await cifrar(deps, a), cb = await cifrar(deps, b);
      if (!ca || !cb) { deps.log("broker-connect: no_key"); return json({ ok: false, code: "no_key" }, 503); }
      const row: Record<string, unknown> = {
        user_id: user.id, broker, cred_a: ca, cred_b: cb, meta, status: "active",
        last_sync: new Date(now).toISOString(), last_code: null,
        connection_version: deps.uuid(), updated_at: new Date(now).toISOString(),
      };
      if (broker === "kraken") row.nonce = nonce;
      const { error } = await deps.admin.from("broker_links").upsert(row, { onConflict: "user_id,broker" });
      if (error) { deps.log("broker-connect: store"); return json({ ok: false, code: "store" }, 503); }
      return json({ ok: true, connected: true, broker, sync: snapshot });
    } catch (_) {
      deps.log("broker-connect: error");
      return json({ ok: false, code: "error" }, 500);
    }
  };
}

export function brokerSyncHandler(deps: BrokerDeps) {
  return async (req: Request): Promise<Response> => {
    try {
      const input = await readInput(req, "broker-sync");
      if (!input.ok) return json({ ok: false, error: input.error }, input.status);
      const user = await deps.userOf(req);
      if (!user) return json({ ok: false, error: "sin sesión" }, 401);
      const broker = (input.body as { broker: "ibkr" | "kraken" }).broker;
      const gate = await deps.rateLimit(deps.admin, "broker-sync:" + user.id + ":" + broker, 10, 600);
      if (!gate.ok) return json({ ok: false, code: "rate" }, 429);

      const { data: row } = await deps.admin.from("broker_links")
        .select("broker,cred_a,cred_b,status,connection_version,meta")
        .eq("user_id", user.id).eq("broker", broker).maybeSingle();
      if (!row || !row.cred_a || !row.cred_b) return json({ ok: false, code: "not_linked" });
      if (row.status === "expired" || row.status === "rejected") return json({ ok: false, authExpired: true, code: "expired" });

      /* Solo se toca la fila si sigue siendo la MISMA conexión: un fallo de una lectura vieja no
         puede caducar la que el usuario acaba de rehacer (la carrera de MyInvestor, 0026). */
      const marca = async (patch: Record<string, unknown>) => {
        await deps.admin.from("broker_links").update({ ...patch, updated_at: new Date(deps.now()).toISOString() })
          .eq("user_id", user.id).eq("broker", broker).eq("connection_version", row.connection_version);
      };
      let a: string | null, b: string | null;
      try { a = await deps.decrypt(row.cred_a); b = await deps.decrypt(row.cred_b); }
      catch (_) { deps.log("broker-sync: no_key"); return json({ ok: false, code: "no_key" }, 503); }
      if (!a || !b) return json({ ok: false, code: "not_linked" });
      const now = deps.now();

      if (broker === "ibkr") {
        const got = await ibkrFetchStatement(deps.fetch, a, b, deps.sleep);
        if (!got.ok) {
          deps.log("broker-sync: ibkr " + got.code);
          if (ibkrTokenMuerto(got.code)) { await marca({ status: "expired", last_code: got.code }); return json({ ok: false, authExpired: true, code: got.code }); }
          await marca({ last_code: got.code });
          return json({ ok: false, code: got.code });
        }
        const chk = ibkrCheckXml(got.xml);
        if (!chk.ok) { await marca({ last_code: chk.code }); return json({ ok: false, code: chk.code }); }
        await marca({ status: "active", last_sync: new Date(now).toISOString(), last_code: null, meta: { ...(row.meta || {}), accounts: chk.accounts } });
        return json({ ok: true, broker, asOf: chk.toDate, snapshot: true, flexXml: got.xml });
      }

      // Kraken: el nonce lo avanza la BD de forma atómica (dos móviles a la vez no chocan).
      const nextNonce = async () => {
        const { data, error } = await deps.admin.rpc("broker_next_nonce", { p_user: user.id, p_broker: "kraken" });
        if (error || data == null) throw new Error("nonce");
        return String(data);
      };
      let nonce: string;
      try { nonce = await nextNonce(); } catch (_) { return json({ ok: false, code: "kraken_temp" }); }
      /* Los permisos se miran en CADA lectura, no solo al conectar: si alguien amplía la clave en
         Kraken para operar, deja de ser de solo lectura y no la queremos guardada ni un día más. */
      const info = await krakenPrivate(deps.fetch, "GetApiKeyInfo", a, b, nonce);
      if (!info.ok) {
        deps.log("broker-sync: kraken " + info.code);
        if (info.code === "kraken_key") { await marca({ status: "expired", last_code: info.code }); return json({ ok: false, authExpired: true, code: info.code }); }
        await marca({ last_code: info.code });
        return json({ ok: false, code: info.code });
      }
      const v = krakenCheckKeyInfo(info.result);
      if (!v.ok) {
        deps.log("broker-sync: kraken " + v.code);
        await marca({ status: "rejected", last_code: v.code, cred_a: null, cred_b: null });
        return json({ ok: false, authExpired: true, rejected: true, code: v.code, perm: v.perm ?? null });
      }
      let snap;
      try { snap = await krakenSnapshot(deps.fetch, a, b, nextNonce); }
      catch (_) { return json({ ok: false, code: "kraken_temp" }); }
      if (!snap.ok) { deps.log("broker-sync: kraken " + snap.code); await marca({ last_code: snap.code }); return json({ ok: false, code: snap.code }); }
      await marca({ status: "active", last_sync: new Date(now).toISOString(), last_code: null });
      return json({ ok: true, broker, asOf: hoy(now), snapshot: true, positions: snap.positions, present: snap.present, cash: snap.cash, warnings: snap.warnings });
    } catch (_) {
      deps.log("broker-sync: error");
      return json({ ok: false, code: "error" }, 500);
    }
  };
}

export function brokerDisconnectHandler(deps: BrokerDeps) {
  return async (req: Request): Promise<Response> => {
    try {
      const input = await readInput(req, "broker-disconnect");
      if (!input.ok) return json({ ok: false, error: input.error }, input.status);
      const user = await deps.userOf(req);
      if (!user) return json({ ok: false, error: "sin sesión" }, 401);
      const broker = (input.body as { broker: string }).broker;
      // Revocar de verdad es cosa del bróker (borrar la clave o el token allí): la app lo dice.
      const { error } = await deps.admin.from("broker_links").delete().eq("user_id", user.id).eq("broker", broker);
      if (error) return json({ ok: false, code: "store" }, 503);
      return json({ ok: true });
    } catch (_) {
      return json({ ok: false, code: "error" }, 500);
    }
  };
}
