#!/usr/bin/env node
/** Hogar endurecido (SEG-10, ronda F, 19/11/2026). La migración 0028 está escrita pero puede no
 *  estar aplicada: el cliente tiene que funcionar con ella y sin ella. Se prueba con un cliente de
 *  Supabase falso que imita las dos BD. Y SEG-19: el DNI de MyInvestor ya no se guarda. */
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const ctx = loadPureLogicFromFile();
let n = 0;
async function t(name, fn) {
  try { await fn(); n++; console.log(`  ✓ ${name}`); }
  catch (e) { console.error(`  ✗ ${name}`); throw e; }
}
console.log("hogar-endurecido");

/* Un `sb` mínimo. `con0028` decide si existen join_household, la columna de caducidad y la
   política de borrado del dueño. Apunta cada llamada para poder mirarla. */
function fakeSb({ con0028, me = "u-me", miembros, hogar }) {
  const log = [];
  const tablas = {
    household_members: miembros.map((m) => Object.assign({}, m)),
    households: [Object.assign({}, hogar)],
    household_snapshots: [],
  };
  const rpc = async (name, args) => {
    log.push(["rpc", name, args]);
    if (name === "join_household") {
      if (!con0028) return { data: null, error: { code: "PGRST202", message: "Could not find the function public.join_household(p_code) in the schema cache" } };
      return { data: args.p_code === "BUENCODIGO1" ? { ok: true, household_id: "h1" } : { ok: false, code: "invalid_code" }, error: null };
    }
    if (name === "join_household_by_code") {
      return args.p_code === "BUENCODIGO1" ? { data: "h1", error: null } : { data: null, error: { message: "invalid_code" } };
    }
    return { data: null, error: { message: "?" } };
  };
  const from = (tabla) => {
    let op = "select", patch = null; const filtros = [];
    const q = {
      select() { return q; },
      update(p) { op = "update"; patch = p; return q; },
      delete() { op = "delete"; return q; },
      eq(k, v) { filtros.push([k, v]); return q; },
      limit() { return q; },
      maybeSingle() { return q.then((r) => ({ data: r.data[0] || null, error: r.error })); },
      then(res, rej) {
        const filas = tablas[tabla].filter((f) => filtros.every(([k, v]) => f[k] === v));
        log.push([op, tabla, filtros.slice(), patch]);
        if (op === "update") {
          if (!con0028 && "invite_expires_at" in patch) return Promise.resolve({ data: null, error: { code: "PGRST204", message: "Could not find the 'invite_expires_at' column of 'households' in the schema cache" } }).then(res, rej);
          filas.forEach((f) => Object.assign(f, patch));
          return Promise.resolve({ data: filas.map((f) => ({ id: f.id })), error: null }).then(res, rej);
        }
        if (op === "delete") {
          // Sin la política del dueño (0028), la RLS no borra la fila de otro y NO da error.
          const puede = filas.filter((f) => f.user_id === me || (con0028 && tablas.households[0].created_by === me));
          tablas[tabla] = tablas[tabla].filter((f) => puede.indexOf(f) < 0);
          return Promise.resolve({ data: puede.map((f) => ({ user_id: f.user_id })), error: null }).then(res, rej);
        }
        return Promise.resolve({ data: filas, error: null }).then(res, rej);
      },
    };
    return q;
  };
  return { log, tablas, rpc, from, auth: { getSession: async () => ({ data: { session: { user: { id: me } } } }) } };
}
const hogar = { id: "h1", name: "Casa", invite_code: "ABC123", created_by: "u-me" };
const miembros = [
  { household_id: "h1", user_id: "u-otro", role: "member" },
  { household_id: "h1", user_id: "u-me", role: "owner" },
];

await t("unirse con la 0028: usa join_household y un código malo es invalid_code", async () => {
  const sb = fakeSb({ con0028: true, miembros, hogar });
  assert.equal(await ctx.hhUnirse(sb, " BUENCODIGO1 "), "h1");
  await assert.rejects(ctx.hhUnirse(sb, "MALO"), (e) => /invalid_code/.test(e.message));
  assert.deepEqual(sb.log.map((x) => x[1]), ["join_household", "join_household"]);
});

await t("unirse sin la 0028: cae a join_household_by_code", async () => {
  const sb = fakeSb({ con0028: false, miembros, hogar });
  assert.equal(await ctx.hhUnirse(sb, "BUENCODIGO1"), "h1");
  await assert.rejects(ctx.hhUnirse(sb, "MALO"), (e) => /invalid_code/.test(e.message));
  assert.deepEqual(sb.log.map((x) => x[1]), ["join_household", "join_household_by_code", "join_household", "join_household_by_code"]);
});

await t("un error de verdad de join_household no se tapa con la RPC vieja", async () => {
  const sb = fakeSb({ con0028: true, miembros, hogar });
  sb.rpc = async () => ({ data: null, error: { code: "42501", message: "permission denied" } });
  await assert.rejects(ctx.hhUnirse(sb, "X"), (e) => /permission denied/.test(e.message));
});

await t("regenerar con la 0028: código nuevo y caduca a los 30 días", async () => {
  const sb = fakeSb({ con0028: true, miembros, hogar });
  const now = Date.UTC(2026, 10, 19, 10);
  const r = await ctx.hhRegenerarCodigo(sb, "h1", "NUEVOCODIG", now);
  assert.equal(r.invite_code, "NUEVOCODIG");
  assert.equal(r.invite_expires_at, new Date(now + 30 * 864e5).toISOString());
  assert.equal(sb.tablas.households[0].invite_code, "NUEVOCODIG");
});

await t("regenerar sin la 0028: reintenta sin la columna y no inventa caducidad", async () => {
  const sb = fakeSb({ con0028: false, miembros, hogar });
  const r = await ctx.hhRegenerarCodigo(sb, "h1", "NUEVOCODIG", Date.now());
  assert.equal(r.invite_expires_at, null);
  assert.equal(sb.tablas.households[0].invite_code, "NUEVOCODIG");
  assert.equal(sb.log.filter((x) => x[0] === "update").length, 2);
});

await t("expulsar con la 0028 quita la fila; sin ella avisa not_allowed en vez de fingir", async () => {
  const con = fakeSb({ con0028: true, miembros, hogar });
  await ctx.hhExpulsar(con, "h1", "u-otro");
  assert.deepEqual(con.tablas.household_members.map((m) => m.user_id), ["u-me"]);
  const sin = fakeSb({ con0028: false, miembros, hogar });
  await assert.rejects(ctx.hhExpulsar(sin, "h1", "u-otro"), (e) => /not_allowed/.test(e.message));
  assert.equal(sin.tablas.household_members.length, 2);
});

await t("el rol es el MÍO aunque la RLS deje ver primero la fila de otro miembro", async () => {
  const sb = fakeSb({ con0028: false, miembros, hogar });
  const b = await ctx.hhLeerHogar(sb);
  assert.equal(b.myRole, "owner");
  assert.equal(b.me, "u-me");
  assert.deepEqual(b.members.map((m) => m.user_id).sort(), ["u-me", "u-otro"]);
});

await t("código flojo: los de 6 de antes y los caducados; uno de 10 vigente no", async () => {
  const now = Date.UTC(2026, 10, 19);
  assert.equal(ctx.hhCodigoFlojo({ invite_code: "ABC123" }, now), true);
  assert.equal(ctx.hhCodigoFlojo({ invite_code: "ABCDEFGHJK" }, now), false);
  assert.equal(ctx.hhCodigoFlojo({ invite_code: "ABCDEFGHJK", invite_expires_at: "2026-11-01T00:00:00Z" }, now), true);
  assert.equal(ctx.hhCodigoFlojo({ invite_code: "ABCDEFGHJK", invite_expires_at: "2026-12-01T00:00:00Z" }, now), false);
});

await t("SEG-19: el DNI de MyInvestor no se escribe en localStorage y la copia vieja se borra", async () => {
  const src = fs.readFileSync(new URL("../src/modules/06-sync-brokers.js", import.meta.url), "utf8");
  assert.equal(/localStorage\.setItem\(\s*["']_miCid["']/.test(src), false, "no se guarda el DNI");
  assert.equal(/localStorage\.getItem\(\s*["']_miCid["']/.test(src), false, "no se lee el DNI guardado");
  assert.match(src, /localStorage\.removeItem\("_miCid"\)/);
});

console.log(`  ${n} casos`);
