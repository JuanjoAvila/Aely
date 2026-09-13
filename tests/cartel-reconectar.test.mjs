#!/usr/bin/env node
/**
 * EL CARTEL DE «RECONECTA» SE VA AL VOLVER DEL BANCO, NO AL ACABAR EL SYNC (13/9).
 * Su feedback del 12/9: «conectas otra vez y desaparece el cartel pero tarda 8 h laborables…
 * luego sí funciona y desaparece». Se siembran DOS bancos: el reconectado cae, el que sigue a
 * medias NO. Con uno solo, una función que vaciara todos los avisos pasaría igual de bien.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const ctx = loadPureLogicFromFile();
let fallos = 0;
const t = (n, fn) => { try { fn(); console.log("  ✓ " + n); } catch (e) { fallos++; console.error("  ✗ " + n + "\n      " + (e && e.message)); } };
console.log("cartel-reconectar");

const issues = [
  { aspsp: "Banco Sabadell", ent: "sabadell", kind: "expired" },
  { aspsp: "CaixaBank", ent: "caixabank", kind: "pending" },
];

t("reconectas Sabadell: su cartel cae al momento y el de CaixaBank se queda", () => {
  const db = [{ aspsp_name: "Banco Sabadell", status: "active" }, { aspsp_name: "CaixaBank", status: "pending" }];
  const out = ctx.issuesTrasReconectar(issues, db);
  assert.deepEqual(out.map((i) => i.ent), ["caixabank"]);
});

t("si la nube aún no lo marca activo, no se inventa nada", () => {
  const db = [{ aspsp_name: "Banco Sabadell", status: "expired" }, { aspsp_name: "CaixaBank", status: "pending" }];
  assert.equal(ctx.issuesTrasReconectar(issues, db), issues, "misma referencia: no hay re-render");
});

t("mayúsculas distintas entre la fila y el aviso siguen casando", () => {
  const out = ctx.issuesTrasReconectar(issues, [{ aspsp_name: "banco sabadell", status: "active" }]);
  assert.equal(out.length, 1);
});

t("sin avisos o sin filas, nada", () => {
  assert.deepEqual(ctx.issuesTrasReconectar([], [{ aspsp_name: "X", status: "active" }]), []);
  assert.equal(ctx.issuesTrasReconectar(issues, null), issues);
});

const src = fs.readFileSync(new URL("../src/modules/11-app-main.js", import.meta.url), "utf8");
t("los DOS retornos del banco (APK y web) limpian el cartel antes del sync", () => {
  assert.ok(/limpiaCartelReconectado\(\);\s*runBankSync\(\{manual:true\}\);/.test(src), "vuelta por la APK (bank|ok)");
  assert.ok(/bankJustConnected\.current=false; limpiaCartelReconectado\(\); runBankSync/.test(src), "vuelta por la web (?bank=ok)");
});

if (fallos) { console.error(`cartel-reconectar: ${fallos} fallo(s)`); process.exit(1); }
console.log("cartel-reconectar: OK");
