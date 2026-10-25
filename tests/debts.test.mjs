#!/usr/bin/env node
import assert from "node:assert/strict";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const ctx = loadPureLogicFromFile();
const ymAbs = (y, m0) => y * 12 + m0;
const NativeDate = Date;
// El calendario pactado es Madrid. Los valores esperados son literales, independientes
// del auxiliar de producto y del huso del runner; el reloj sólo cambia dentro del sandbox.
const clocks = [
  { iso: "2026-09-30T21:30:00Z", y: 2026, m0: 8, d: 30 },
  { iso: "2026-09-30T22:30:00Z", y: 2026, m0: 9, d: 1 },
  { iso: "2026-10-25T23:30:00Z", y: 2026, m0: 9, d: 26 },
  { iso: "2026-11-30T23:30:00Z", y: 2026, m0: 11, d: 1 },
  { iso: "2026-12-31T23:30:00Z", y: 2027, m0: 0, d: 1 },
  { iso: "2026-02-28T23:30:00Z", y: 2026, m0: 2, d: 1 },
  { iso: "2026-03-29T00:30:00Z", y: 2026, m0: 2, d: 29 },
  { iso: "2026-03-29T01:30:00Z", y: 2026, m0: 2, d: 29 },
];
let now;

function t(name, fn) {
  for (const clock of clocks) {
    now = clock;
    ctx.Date = class extends NativeDate {
      constructor(...args) { super(...(args.length ? args : [clock.iso])); }
      static now() { return NativeDate.parse(clock.iso); }
    };
    try { fn(); }
    catch (e) { console.error(`  ✗ ${name} (${clock.iso})`); throw e; }
  }
  console.log(`  ✓ ${name} (${clocks.length} relojes)`);
}

console.log("debts");

t("debtBalance: hipoteca sin plazo mantiene saldo", () => {
  const d = { value: 120000, monthly: 520 };
  assert.equal(ctx.debtBalance(d), 120000);
});

t("debtBalance: amortiza según cuotas ya pagadas (asOf en el pasado)", () => {
  const d = { value: 120000, monthly: 520, asOf: ymAbs(2026, 0) };  // ancla en enero 2026
  const abs = ymAbs(now.y, now.m0);
  const esperado = Math.max(0, 120000 - 520 * Math.max(0, abs - ymAbs(2026, 0)));
  assert.equal(ctx.debtBalance(d), esperado);
});

t("debtBalance: nunca baja de 0 aunque la amortización supere el valor", () => {
  const d = { value: 1000, monthly: 600, asOf: ymAbs(2020, 0) };   // muchísimas cuotas «pagadas»
  assert.equal(ctx.debtBalance(d), 0);
});

t("debtBalance: financiación con balloon se liquida entera al llegar al último mes", () => {
  const anchor = ymAbs(now.y, now.m0) - 12;
  const d = { value: 20000, monthly: 400, months: 12, balloon: 5000, amort: (20000 - 5000) / 12, asOf: anchor };
  assert.equal(ctx.debtBalance(d), 0);   // 12 cuotas ya pagadas + pago final → saldo 0
});

t("debtLeft: financiación 4 cuotas recién creada", () => {
  // El cargo sigue por delante del día de Madrid, aunque UTC/Los Ángeles aún estén en la
  // víspera. Calcularlo con getDate() local daba 3 en vez de 4 tras FIN36 (26/10/2026).
  const d = { value: 400, monthly: 100, months: 4, day: now.d + 1, asOf: ymAbs(now.y, now.m0) };
  assert.equal(ctx.debtLeft(d), 4);
});

t("debtLeft: null si no tiene plazo (hipoteca/préstamo abierto)", () => {
  assert.equal(ctx.debtLeft({ value: 5000, monthly: 200 }), null);
});

t("debtLeft: nunca negativo aunque se hayan pasado más cuotas que el plazo", () => {
  const d = { value: 300, monthly: 50, months: 6, asOf: ymAbs(now.y, now.m0) - 10 };
  assert.equal(ctx.debtLeft(d), 0);
});

t("debtLeft: cuenta también la cuota de ESTE mes si ya pasó su día", () => {
  const d = { value: 2400, monthly: 200, months: 24, day: 1, asOf: ymAbs(now.y, now.m0) };
  assert.equal(ctx.debtLeft(d), 23);   // el día 1 ya pasó siempre → cuenta la cuota de este mes
});

t("debtActive: sin cuota mensual = inactiva", () => {
  assert.equal(ctx.debtActive({ value: 100, monthly: 0 }), false);
});

t("debtBalance: céntimos exactos antes y en el día de cargo de Madrid", () => {
  const d = { value: 79.96, monthly: 19.99, months: 4, asOf: ymAbs(now.y, now.m0) };
  assert.equal(Math.round(ctx.debtBalance({ ...d, day: now.d + 1 }) * 100), 7996);
  assert.equal(Math.round(ctx.debtBalance({ ...d, day: now.d }) * 100), 5997);
});

console.log(`\ndebts: OK (${clocks.length} relojes, TZ=${Intl.DateTimeFormat().resolvedOptions().timeZone})`);
