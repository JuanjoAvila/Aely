#!/usr/bin/env node
/** Identidad exacta del lector TR/Wallet: reintentar no duplica y el doble aviso cuenta una vez. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { transformSync } from "esbuild";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = fs.readFileSync(path.join(root, "supabase/functions/_shared/ingest_identity.ts"), "utf8");
const js = transformSync(src, { loader: "ts", format: "esm" }).code;
const { claveEvento, origenEvento, esGemeloIngest, esGemeloLegacy,
  tieneGemeloAnterior, normalizarEventoId } =
  await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
const cli = loadPureLogicFromFile();

function t(name, fn) {
  try { fn(); console.log("  ✓ " + name); }
  catch (e) { console.error("  ✗ " + name); throw e; }
}

console.log("ingest-identity");

t("el mismo evento conserva una clave aunque se reintente 35 minutos después", () => {
  const a = claveEvento("v1_" + "a".repeat(64), "tr", "Has gastado 9,95 € en Pans & Company");
  const b = claveEvento("v1_" + "a".repeat(64), "tr", "Has gastado 9,95 € en Pans & Company");
  assert.equal(a, b);
  assert.equal(a, "tr:trade_republic:v1_" + "a".repeat(64));
});

t("intercalar otra notificación no expulsa la identidad de la anterior", () => {
  const primera = claveEvento("v1_uno", "tr", "9,95 €");
  const otra = claveEvento("v1_dos", "tr", "3,00 €");
  const retry = claveEvento("v1_uno", "tr", "9,95 €");
  assert.notEqual(primera, otra);
  assert.equal(retry, primera);
});

t("la huella rechaza texto libre y Wallet solo se atribuye a la tarjeta nombrada", () => {
  assert.equal(normalizarEventoId("Pans & Company 9,95 €"), null);
  assert.equal(origenEvento("wallet", "9,95 € con Trade Republic Visa Card ••9116"), "wallet:trade_republic");
  assert.equal(origenEvento("wallet", "9,95 € con Revolut Visa ••1234"), "wallet:unknown");
});

t("TR Pans + Wallet alias retrasado se reconoce como el mismo pago", () => {
  const tr = { fecha: "2026-09-17T14:24:00+02:00", importe: 9.95,
    ingest_event_id: "tr:trade_republic:v1_tr" };
  const wallet = { fecha: "2026-09-17T14:59:00+02:00", importe: 9.95,
    ingest_event_id: "wallet:trade_republic:v1_wallet" };
  assert.equal(esGemeloIngest(wallet, tr), true);
});

t("dos compras legítimas iguales por la misma puerta NO se fusionan ni marcan", () => {
  const a = { fecha: "2026-09-17T14:24:00+02:00", importe: 9.95,
    ingest_event_id: "tr:trade_republic:v1_a" };
  const b = { fecha: "2026-09-17T14:25:00+02:00", importe: 9.95,
    ingest_event_id: "tr:trade_republic:v1_b" };
  assert.equal(esGemeloIngest(b, a), false);
});

t("un Wallet de otra tarjeta no se mezcla con Trade Republic", () => {
  const tr = { fecha: "2026-09-17T14:24:00+02:00", importe: 9.95,
    ingest_event_id: "tr:trade_republic:v1_a" };
  const rev = { fecha: "2026-09-17T14:25:00+02:00", importe: 9.95,
    ingest_event_id: "wallet:unknown:v1_b" };
  assert.equal(esGemeloIngest(rev, tr), false);
});

t("la carrera legacy Consum/Wallet identifica solo la fila posterior como duplicada", () => {
  const tr = { id: "a", fecha: "2026-09-23T15:21:06.996+02:00", importe: 15.02,
    created_at: "2026-09-23T15:21:18.085911+02:00" };
  const wallet = { id: "b", fecha: "2026-09-23T15:21:16.886+02:00", importe: 15.02,
    created_at: "2026-09-23T15:21:18.119320+02:00" };
  assert.equal(esGemeloLegacy(wallet, tr), true);
  assert.equal(tieneGemeloAnterior(tr, [tr, wallet]), false);
  assert.equal(tieneGemeloAnterior(wallet, [tr, wallet]), true);
});

t("dos cargos legacy separados no se confunden por compartir importe", () => {
  const a = { id: "a", fecha: "2026-09-23T15:00:00+02:00", importe: 15.02 };
  const b = { id: "b", fecha: "2026-09-23T15:20:01+02:00", importe: 15.02 };
  assert.equal(esGemeloLegacy(b, a), false);
});

t("la duda de Open Banking sigue viajando nube → app → nube sin contar", () => {
  const e = cli.expenseFromRow({ id: "f0000000-0000-4000-8000-000000000001",
    fecha: "2026-09-17T12:59:00Z", importe: 9.95, comercio: "Movimiento",
    cat: "restaurantes", source: "ob:trade_republic#dup" });
  assert.equal(e.source, "ob");
  assert.equal(e.ent, "trade_republic");
  assert.equal(e.possibleDup, true);
  assert.equal(cli.expenseSourceForCloud(e), "ob:trade_republic#dup");
  assert.equal(cli.expenseSourceForCloud({ ...e, possibleDup: false }), "ob:trade_republic");
});

t("APK usa postTime, conserva identidad nativa y aparta posibles repetidos", () => {
  const java = fs.readFileSync(path.join(root,
    "android/app/src/main/java/com/micartera/app/TrExpenseListener.java"), "utf8");
  assert.match(java, /sbn\.getPostTime\(\)/);
  assert.match(java, /\.put\("evento", evento\)/);
  const stable = /static String stableEventId\(([^)]*)\)\s*\{([\s\S]*?)\n    \}/.exec(java);
  assert.ok(stable, "falta la identidad nativa estable");
  assert.equal(/title|text/i.test(stable[1] + stable[2]), false,
    "un update con mismo key/postTime y texto distinto tiene que conservar el mismo id");
  assert.match(stable[1], /String key, long postedAt/,
    "otro key o postTime debe producir otra huella");
  assert.match(java, /sbn\.getId\(\).*sbn\.getTag\(\)/s,
    "si Android no da key, el fallback usa su id/tag nativo, no el texto");
  const possibleDup = /if \(r\.optBoolean\("possibleDup", false\)\) \{[\s\S]*?\n\s*\}/.exec(java);
  assert.ok(possibleDup, "la APK debe reconocer la respuesta possibleDup del servidor");
  assert.match(possibleDup[0], /return;/,
    "un posible repetido debe salir antes de actualizar cifras y widget");
  assert.doesNotMatch(possibleDup[0], /saveMonth|MiCarteraWidget/,
    "un posible repetido no puede entrar en las cifras del widget");
});

t("Edge solo confirma si hubo INSERT con ACK exacto", () => {
  const edge = fs.readFileSync(path.join(root, "supabase/functions/ingest/index.ts"), "utf8");
  const mig = fs.readFileSync(path.join(root, "supabase/migrations/0025_expenses_ingest_event.sql"), "utf8");
  assert.match(edge, /\.eq\("ingest_event_id", eventKey\)/);
  assert.match(edge, /\.select\("id"\)/);
  assert.match(edge, /!inserted \|\| !inserted\.length/);
  assert.match(mig, /unique index[\s\S]*user_id, ingest_event_id/i);
});

console.log("  ok");
