#!/usr/bin/env node
/**
 * ACTUALIZAR A MANO DICE QUÉ HA PASADO, EN UN SOLO AVISO (13/9).
 *
 * Su queja (12/9): «si actualizo saldo de un banco… por ejemplo Trade Republic, no me dice nada
 * que se ha actualizado correctamente». Y el rechazo viejo `tr-reactivo` (8/9): «sale conectado
 * pero no te avisa ni nada».
 *
 * Tres causas que se sumaban: bancos y brókers sacaban cada uno su toast y ganaba el último; el
 * temporizador del primero borraba el segundo; y con un banco a medias se callaba el «✓ al día»
 * de los demás. Aquí se vigila la función que junta los avisos, y en el código que el botón ya no
 * lanza dos toasts ni el temporizador se queda sin cancelar.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const ctx = loadPureLogicFromFile();
let fallos = 0;
const t = (n, fn) => { try { fn(); console.log("  ✓ " + n); } catch (e) { fallos++; console.error("  ✗ " + n + "\n      " + (e && e.message)); } };

console.log("sync-manual-un-aviso");

t("todo bien: bancos y brókers en UN mensaje", () => {
  const m = ctx.juntaAvisosSync(["✓ 3 bancos al día", "📈 Brókers al día (TR/MyInvestor)"]);
  assert.equal(m, "✓ 3 bancos al día · 📈 Brókers al día (TR/MyInvestor)");
});

t("con un banco a medias, el ⚠ va delante y lo que fue bien también se dice", () => {
  const m = ctx.juntaAvisosSync(["✓ 2 bancos al día", "⚠ CaixaBank no llegó a conectarse", "📈 Brókers al día"]);
  assert.ok(m.startsWith("⚠ CaixaBank"), "el aviso primero (la telemetría solo recoge los que empiezan por ⚠): " + m);
  assert.ok(m.includes("✓ 2 bancos al día"), "y el ✓ de los otros no se calla");
  assert.ok(m.includes("📈 Brókers al día"));
});

t("Trade Republic sin respuesta se dice, no se calla", () => {
  const m = ctx.juntaAvisosSync(["✓ 3 bancos al día", "⚠ Trade Republic no ha respondido"]);
  assert.ok(/Trade Republic/.test(m));
});

t("dos avisos: un solo ⚠ delante, sin repetir mensajes", () => {
  const m = ctx.juntaAvisosSync(["⚠ A", "⚠ B", "⚠ A", "✓ ok"]);
  assert.equal(m, "⚠ A · B · ✓ ok");
});

t("sin nada que decir, nada", () => {
  assert.equal(ctx.juntaAvisosSync([]), "");
});

const src = fs.readFileSync(new URL("../src/modules/11-app-main.js", import.meta.url), "utf8");
t("el botón Actualizar ya no lanza bancos y brókers con un toast cada uno", () => {
  assert.equal(/onBankSync:function\(\)\{ return Promise\.all\(\[runBankSync\(\{manual:true\}\), runBrokerSync\(\{manual:true\}\)\]\); \}/.test(src), false);
  assert.ok((src.match(/onBankSync:sincronizarAMano/g) || []).length >= 2, "Cartera y Ajustes pasan por sincronizarAMano");
});

t("showToast cancela el temporizador del aviso anterior", () => {
  const i = src.indexOf("const showToast=");
  assert.ok(i > 0);
  assert.ok(/clearTimeout\(toastTimer\.current\)/.test(src.slice(i, i + 400)), "si no, el primer temporizador borra el segundo toast");
});

if (fallos) { console.error(`sync-manual-un-aviso: ${fallos} fallo(s)`); process.exit(1); }
console.log("sync-manual-un-aviso: OK");
