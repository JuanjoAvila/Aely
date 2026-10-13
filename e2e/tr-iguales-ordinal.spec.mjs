import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { transformSync } from "esbuild";
import { seedLoggedInDashboard, dismissNews, FIXTURE_NOW, installFixtureClock } from "./fixtures.mjs";

/* APUNTES IGUALES SIN ID (Trade Republic) POR EL CABLEADO REAL (12/10/2026).
 *
 * `tests/ob-iguales-ordinal.test.mjs` prueba el motor con una copia a mano de `sync()`. Esto abre
 * la app de verdad: la respuesta del banco pasa por `runBankSync` (11-app-main), las filas se
 * pintan en Gastos (04-tab-gastos), «Es el mismo» se contesta desde la ficha y «Importar
 * histórico» (10-app-components) clasifica contra el estado que dejó todo lo anterior. Lo que
 * vigila: que k iguales sean k filas en pantalla, y que lo ya contestado «es el mismo» no vuelva
 * como nuevo en el histórico (revisión de la entrega 1: 187 de 195 volvían premarcados). */

test.beforeEach(async ({ page }) => { await installFixtureClock(page); });

// Respuesta generada por el mapper real: TR no manda id ni comercio, solo importe, signo, fecha y estado.
const src = fs.readFileSync(new URL("../supabase/functions/_shared/enablebanking.ts", import.meta.url), "utf8");
const E = await import("data:text/javascript;base64," + Buffer.from(transformSync(src, { loader: "ts", format: "esm" }).code).toString("base64"));
const dia = new Date(FIXTURE_NOW).toISOString().slice(0, 10);
const tr = (amount) => E.mapTransaction({ booking_date: dia, value_date: dia, status: "BOOK", transaction_amount: { amount: Math.abs(amount).toFixed(2) }, credit_debit_indicator: amount < 0 ? "CRDT" : "DBIT" });
const respuesta = (txs) => ({ data: { ok: true, links: [{ aspsp: "Trade Republic", ok: true, accounts: [{ uid: "tr-e2e", ok: true, balances: [], transactions: txs }] }] }, error: null });
const bankLinks = [{ aspsp_name: "Trade Republic", aspsp_country: "DE", status: "active", valid_until: "2027-01-01T00:00:00Z", last_sync: FIXTURE_NOW, accounts: [{ uid: "tr-e2e" }] }];
// Aviso del móvil (noti de TR): hora real y comercio real, como lo deja `ingest`.
const aviso = (amount, nombre) => ({ id: "aviso-" + nombre.replace(/\W/g, ""), date: new Date(FIXTURE_NOW - 3 * 3600000).toISOString(), merchant: nombre, amount, category: "otros", source: "macrodroid", ent: "trade_republic" });

async function abre(page, overrides) {
  await seedLoggedInDashboard(page, Object.assign({
    accounts: [{ id: "tr", ent: "trade_republic", name: "Trade Republic", role: "diario", value: 900 }],
    settings: { autoPrices: false, theme: "green", expenseBanks: ["trade_republic"] }, hasBankLink: true,
    __cloudRows: { bank_links: bankLinks },
  }, overrides));
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15000 });
  await dismissNews(page);
}
const guardadas = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("micartera_v3_exp") || "[]").length);
const sincroniza = (page) => page.evaluate(() => window.dispatchEvent(new CustomEvent("mc-bank-role-changed")));
const filas = (page) => page.locator(".v4-gastos-list-body button.v4-mov");

test("tres bizums iguales de TR entran como tres filas en Gastos, y la segunda sincronización no añade ninguna", async ({ page }) => {
  await abre(page, { __cloudFns: { "bank-sync": respuesta([tr(12), tr(12), tr(12)]) } });
  await sincroniza(page);
  await expect.poll(() => guardadas(page), { timeout: 15000 }).toBe(3);
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  const iguales = filas(page).filter({ hasText: "12,00" });
  await expect(iguales).toHaveCount(3);
  await expect(iguales.filter({ hasText: /Movimiento/ })).toHaveCount(3);
  // Mismo día, tres identidades: el ordinal viaja en la fila guardada, no se ve.
  const ords = await page.evaluate(() => JSON.parse(localStorage.getItem("micartera_v3_exp") || "[]").map((e) => e.obOrd || 1).sort());
  expect(ords).toEqual([1, 2, 3]);
  await sincroniza(page);
  await page.waitForTimeout(800);
  await expect(iguales).toHaveCount(3);
  expect(await guardadas(page)).toBe(3);
});

test("Manual: «Es el mismo» desde la ficha deja lápida y vínculo: el banco no lo vuelve a meter y el histórico lo da por apuntado", async ({ page }) => {
  await abre(page, {
    expenses: [Object.assign(aviso(29.9, "Decathlon"),{source:"manual"})],
    __cloudFns: { "bank-sync": respuesta([tr(29.9)]) },
  });
  await sincroniza(page);
  await expect.poll(() => guardadas(page), { timeout: 15000 }).toBe(2);
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  // El apunte del banco entra como «posible repetido» del aviso: atenuado y con su pregunta.
  const posible = filas(page).filter({ hasText: "Movimiento" });
  await expect(posible).toHaveCount(1);
  await expect(posible).toHaveClass(/v4-mov-skip/);
  // El vínculo con el aviso ya está en el estado antes de contestar: lo dejó `runBankSync`.
  await expect.poll(() => page.evaluate(() => (JSON.parse(localStorage.getItem("micartera_v3") || "{}").gemelos || []).length), { timeout: 10000 }).toBe(1);
  await posible.click();
  await page.getByRole("button", { name: /^Es el mismo$/ }).click();
  await expect(filas(page).filter({ hasText: "Movimiento" })).toHaveCount(0);
  await expect(filas(page).filter({ hasText: "Decathlon" })).toHaveCount(1);
  // El estado se guarda con retardo: se espera a que el disco diga lo mismo que la pantalla.
  await expect.poll(() => page.evaluate(() => { const s = JSON.parse(localStorage.getItem("micartera_v3") || "{}"); return { lapidas: (s.deleted || []).length, gemelos: (s.gemelos || []).length }; }), { timeout: 10000 })
    .toEqual({ lapidas: 1, gemelos: 1 });
  // El banco lo trae otra vez: ni fila nueva ni pregunta.
  await sincroniza(page);
  await page.waitForTimeout(800);
  expect(await guardadas(page)).toBe(1);
  // Y «Importar histórico» con la misma respuesta: «ya lo tienes apuntado», sin marcar.
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("mc-open-settings")));
  await expect(page.locator(".set-card").first()).toBeVisible({ timeout: 10000 });
  await page.getByRole("button", { name: /Importaciones/i }).click();
  await page.locator("button.set-row").filter({ hasText: /Importar histórico/i }).click();
  const overlay = page.locator(".hist-import");
  await expect(overlay).toBeVisible();
  await overlay.getByRole("button", { name: /Buscar movimientos/i }).click();
  const fila = overlay.locator(".hist-fila");
  await expect(fila).toHaveCount(1, { timeout: 10000 });
  await expect(fila).toContainText(/ya lo tienes apuntado/i);
  await expect(fila.locator("span").first()).toHaveText("");   // la casilla no está marcada
  await expect(overlay.locator(".hoja-marc-ok b")).toHaveText("0");
});
