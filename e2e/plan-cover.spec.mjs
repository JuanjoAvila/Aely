/* Portada de Plan §5bis + NO-GO 17/9 + addendum Claude 1845Z. */
import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

const RELOJ = new Date("2026-09-10T12:00:00Z");

const accountsFijos = [
  { id: "sb", ent: "sabadell", name: "Sabadell", value: 800, role: "fijos" },
];

async function openPlan(page, overrides = {}) {
  await page.clock.install({ time: RELOJ });
  await seedLoggedInDashboard(page, Object.assign({
    accounts: accountsFijos,
    budget: 500,
    settings: { autoPrices: false, theme: "green", lang: "es" },
  }, overrides));
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 60_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  await expect(page.locator('.botnav-tab.active')).toHaveAttribute("data-tour", "plan");
}

test("portada compacta: solo lo pendiente; traspaso no suma y nómina va en «entrará»", async ({ page }) => {
  await openPlan(page, {
    fixed: [{ id: "luz", name: "Luz", amount: 40, freq: "mes", day: 28, account: "sabadell" }],
    oneoffs: [{ id: "itv", name: "ITV", amount: 50, year: 2026, month: 9, day: 20, account: "sabadell" }],
    flows: [
      { id: "nom", kind: "income", name: "Nómina", amount: 2000, to: "sabadell", day: 25 },
      { id: "tr", kind: "transfer", name: "A TR", amount: 500, from: "sabadell", to: "trade_republic", day: 15 },
    ],
    debts: [],
  });
  const hero = page.locator('.v4-screen > [data-seg="recibos"] .v4-card-hero');
  await expect(hero).toContainText(/90/);
  await expect(hero).not.toContainText(/590|2090/);
  await expect(page.locator(".v4-plan-cover")).toHaveCount(0);
  const recibos = page.locator(".v4-screen > [data-seg='recibos']");
  await expect(recibos.locator(".v4-ring")).toHaveCount(0);
  await expect(recibos).toContainText("A TR");
  await expect(recibos).toContainText(/Lo que aún entrará/);
  await expect(recibos).toContainText("Nómina");
});

test("pagado y pendiente se separan sin anillo ni mensaje diagnóstico", async ({ page }) => {
  await openPlan(page, {
    fixed: [
      { id: "a", name: "Mini", amount: 1, freq: "mes", day: 2, account: "sabadell" },
      { id: "b", name: "Gordo", amount: 999, freq: "mes", day: 28, account: "sabadell" },
    ],
  });
  const recibos = page.locator(".v4-screen > [data-seg='recibos']");
  await expect(recibos.locator(".v4-card-hero")).toContainText(/999/);
  await expect(recibos).toContainText(/Ya pagado.*1,00|Ya pagado.*1 €/i);
  await expect(recibos).not.toContainText(/%|sin contar compras del día a día/i);
});

test("deuda sin día queda pendiente con —", async ({ page }) => {
  await openPlan(page, {
    accounts: [{ id: "sb", ent: "sabadell", name: "Sabadell", value: 500, role: "fijos" }],
    fixed: [],
    debts: [{ id: "x", name: "Sin día", monthly: 80, value: 800, account: "sabadell" }],
  });
  const recibos = page.locator(".v4-screen > [data-seg='recibos']");
  await expect(recibos).toContainText("Sin día");
  await expect(recibos.locator(".v4-charge").filter({ hasText: "Sin día" })).toContainText("—");
  await expect(recibos.locator(".v4-card-hero")).toContainText(/80.*420|420.*80/s);
  await expect(recibos).not.toContainText(/día ya|day already|dia ja/i);
});

test("una devolución puntual antigua no se descuenta dos veces de la liquidez", async ({ page }) => {
  await openPlan(page, {
    accounts: [{ id: "sb", ent: "sabadell", name: "Sabadell", value: 800, role: "fijos" }],
    fixed: [], debts: [], flows: [],
    oneoffs: [{ id: "refund", name: "Devolución", amount: -50, year: 2026, month: 9, day: 20, account: "sabadell" }],
  });
  const hero = page.locator('.v4-screen > [data-seg="recibos"] .v4-card-hero');
  await expect(hero).toContainText(/0/);
  await expect(hero).toContainText(/850/);
  await expect(hero).not.toContainText(/800/);
});

test("la vista normal conserva el segmented compacto de una sola línea", async ({ page }) => {
  await openPlan(page, {
    accounts: [{ id: "sb", ent: "sabadell", name: "Sabadell", value: 100, role: "fijos" }],
    fixed: [{ id: "luz", name: "Luz", amount: 200, freq: "mes", day: 28, account: "sabadell" }],
    flows: [{ id: "nom", kind: "income", name: "Nómina", amount: 50, to: "sabadell", day: 30 }],
  });
  await expect(page.locator(".v4-seg-sub")).toHaveCount(0);
  await expect(page.locator('.v4-seg-btn[data-seg="recibos"]')).toHaveText("Recibos");
  await expect(page.locator('.v4-screen > [data-seg="recibos"] .v4-card-hero')).toContainText(/200/);
});

test("todo pagado → 0 pendiente y lista pagada, sin NaN ni diagnóstico", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-09-30T12:00:00Z") });
  await seedLoggedInDashboard(page, {
    accounts: accountsFijos,
    fixed: [{ id: "luz", name: "Luz", amount: 40, freq: "mes", day: 5, account: "sabadell" }],
    budget: 500,
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 60_000 });
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  const recibos = page.locator(".v4-screen > [data-seg='recibos']");
  await expect(recibos.locator(".v4-card-hero")).toContainText(/0/);
  await expect(recibos).toContainText(/Nada pendiente|ya no sale/i);
  await expect(recibos).toContainText(/Ya pagado.*40/i);
  await expect(recibos).not.toContainText(/NaN|día ya|day already|dia ja/i);
});

test("modo sencillo §5bis.2: título, sin anillo/%, sin Gestionar, sin jerga", async ({ page }) => {
  await openPlan(page, {
    settings: { autoPrices: false, theme: "green", lang: "es", simpleMode: true },
    fixed: [{ id: "luz", name: "Luz", amount: 40, freq: "mes", day: 28, account: "sabadell" }],
  });
  const plan = page.locator(".page-live .v4-screen").filter({ has: page.getByRole("heading", { name: "Lo que te queda por pagar" }) });
  await expect(plan.locator(".v4-seg")).toHaveCount(0);
  await expect(plan.locator(".v4-ring")).toHaveCount(0);
  await expect(plan).not.toContainText(/%/);
  await expect(plan).not.toContainText(/Gestionar|Cambiar mis recibos/);
  await expect(plan).not.toContainText(/fijo|flujo|traspaso|pendiente|gestionar|conciliaci[oó]n/i);
  await expect(plan.locator(".v4-plan-simple-amt")).toBeVisible();
  await expect(plan.locator(".v4-mov").first()).toBeVisible();
});

test("modo sencillo: todo pagado conserva una frase honesta y el saldo conocido", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-09-30T12:00:00Z") });
  await seedLoggedInDashboard(page, {
    accounts: accountsFijos,
    fixed: [{ id: "luz", name: "Luz", amount: 40, freq: "mes", day: 5, account: "sabadell" }],
    settings: { autoPrices: false, theme: "green", lang: "es", simpleMode: true },
    budget: 500,
  });
  await page.goto("/");
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  const cover = page.locator(".page-live .v4-plan-cover-simple");
  await expect(cover).toContainText(/Ya has pagado todos los recibos/i);
  await expect(cover).toContainText(/800/);
  await expect(cover).not.toContainText(/día ya|day already|dia ja/i);
});

test("modo sencillo: cuenta borrada no inventa un saldo de 0 €", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-09-30T12:00:00Z") });
  await seedLoggedInDashboard(page, {
    accounts: accountsFijos,
    fixed: [{ id: "luz", name: "Luz", amount: 40, freq: "mes", day: 5, account: "banco_fantasma" }],
    settings: { autoPrices: false, theme: "green", lang: "es", simpleMode: true },
    budget: 500,
  });
  await page.goto("/");
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  const cover = page.locator(".page-live .v4-plan-cover-simple");
  await expect(cover).toContainText(/Ya has pagado todos los recibos/i);
  await expect(cover).not.toContainText(/tienes 0\s*€|0,00\s*€ en/i);
});

test("modo sencillo: saldo negativo conocido nunca recibe el titular verde", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-09-30T12:00:00Z") });
  await seedLoggedInDashboard(page, {
    accounts: [{ id: "sb", ent: "sabadell", name: "Sabadell", value: -80, role: "fijos" }],
    fixed: [{ id: "luz", name: "Luz", amount: 40, freq: "mes", day: 5, account: "sabadell" }],
    settings: { autoPrices: false, theme: "green", lang: "es", simpleMode: true },
    budget: 500,
  });
  await page.goto("/");
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  const cover = page.locator(".page-live .v4-plan-cover-simple");
  await expect(cover).toHaveAttribute("data-plan-state", "bad");
  await expect(cover).not.toContainText(/Vas bien este mes/i);
  await expect(cover).toContainText(/-80/);
});

test("modo sencillo: una cuota sin día sigue pendiente sin inventar fecha", async ({ page }) => {
  await openPlan(page, {
    accounts: [{ id: "sb", ent: "sabadell", name: "Sabadell", value: 500, role: "fijos" }],
    fixed: [],
    debts: [{ id: "x", name: "Sin día", monthly: 80, value: 800, account: "sabadell" }],
    settings: { autoPrices: false, theme: "green", lang: "es", simpleMode: true },
  });
  const cover = page.locator(".page-live .v4-plan-cover-simple");
  await expect(cover).toContainText(/80/);
  await expect(cover).not.toContainText(/día ya|day already|dia ja/i);
});

test("Ya pagado es compacto y Ver más enseña solo recibos", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-09-20T12:00:00Z") });
  await seedLoggedInDashboard(page, {
    accounts: accountsFijos,
    fixed: [
      { id: "luz", name: "Luz", amount: 40, freq: "mes", day: 5, account: "sabadell" },
      { id: "agua", name: "Agua", amount: 20, freq: "mes", day: 28, account: "sabadell" },
    ],
    flows: [{ id: "nom", kind: "income", name: "Nómina", amount: 2000, to: "sabadell", day: 1 }],
    budget: 500,
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 60_000 });
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  const recibos = page.locator(".v4-screen > [data-seg='recibos']");
  await expect(recibos).toContainText(/Ya pagado.*40/i);
  await expect(recibos).toContainText("Luz");
  await expect(recibos).not.toContainText("Nómina");
});

test("Pregúntame abre Deudas en el segmented compacto", async ({ page }) => {
  await page.clock.install({ time: RELOJ });
  await seedLoggedInDashboard(page, {
    accounts: accountsFijos,
    debts: [{ id: "coche", name: "Coche", monthly: 200, value: 5000, account: "sabadell", day: 28 }],
    goals: [{ id: "g1", name: "Viaje", target: 1000, saved: 100, emoji: "✈️" }],
    budget: 500,
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 60_000 });
  await dismissNews(page);
  await page.evaluate(() => { window.__mcEmail = "persona@example.invalid"; });
  await page.getByRole("button", { name: "Pregúntame" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Pregúntame" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Préstamos y cuotas", exact: true }).click();
  await dialog.getByRole("button", { name: "Abrir Deudas", exact: true }).click();
  await expect(page.locator('.botnav-tab.active')).toHaveAttribute("data-tour", "plan");
  await expect(page.locator('.page-live .v4-seg-btn.on')).toHaveAttribute("data-seg", "deudas");
});

test("Ajustes › Dinero desde Inicio frío abre BillsManage vivo y un alta se ve", async ({ page }) => {
  // Cold start: no openPlan previo — cubre carrera de montaje idle (Codex 2038/2040).
  await page.clock.install({ time: RELOJ });
  await seedLoggedInDashboard(page, {
    accounts: accountsFijos,
    fixed: [{ id: "luz", name: "Luz", amount: 40, freq: "mes", day: 28, account: "sabadell" }],
    budget: 500,
    settings: { autoPrices: false, theme: "green", lang: "es" },
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 60_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await dismissNews(page);
  await expect(page.locator('.botnav-tab.active')).toHaveAttribute("data-tour", "inicio");
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("mc-open-settings")));
  const billsBtn = page.getByRole("button", { name: /Cambiar mis recibos/i });
  await expect(billsBtn).toBeVisible({ timeout: 15_000 });
  await billsBtn.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await billsBtn.evaluate((el) => el.click());
  const hub = page.locator("[data-bills-manage]");
  await expect(hub).toBeVisible({ timeout: 15_000 });
  await expect(hub).toHaveAttribute("role", "dialog");
  await expect(hub).toHaveAttribute("aria-modal", "true");
  await expect(page.locator('.botnav-tab.active')).toHaveAttribute("data-tour", "plan");
  await expect(hub).toContainText(/40/);
  await expect(hub).toContainText(/1 recibo/i);
  await hub.locator(".v4-bills-add").first().click();
  const alta = page.locator('.v4-sheet[data-sheet="bill-add"]');
  await expect(alta).toBeVisible();
  await alta.locator("input.v4-bills-search").fill("NetflixVivo");
  await alta.locator(".v4-cta").click();
  for (const k of ["1", "2"]) await alta.getByRole("button", { name: k, exact: true }).click();
  await alta.locator(".v4-cta").click();
  await alta.locator(".v4-ficha-op").filter({ hasText: /Cada mes/i }).click();
  await alta.locator(".v4-cta").click();
  await alta.locator(".v4-cta").click();
  await expect.poll(async () => {
    const st = await page.evaluate(() => JSON.parse(localStorage.getItem("micartera_v3") || "{}"));
    return (st.fixed || []).some((x) => x.name === "NetflixVivo");
  }, { timeout: 10_000 }).toBe(true);
  await expect(hub).toContainText(/2 recibos|NetflixVivo/i);
});

test("hojas BillsItem/BillsAdd son dialog con trap y restauran foco", async ({ page }) => {
  await openPlan(page, {
    fixed: [{ id: "luz", name: "Luz", amount: 40, freq: "mes", day: 28, account: "sabadell" }],
  });
  await page.locator('.v4-screen > [data-seg="recibos"]').getByRole("button", { name: /Gestionar/i }).click();
  const hub = page.locator("[data-bills-manage]");
  await expect(hub).toBeVisible();
  await expect(hub).toHaveAttribute("role", "dialog");
  const addBtn = hub.locator(".v4-bills-add").first();
  await addBtn.focus();
  await addBtn.click();
  const alta = page.locator('.v4-sheet[data-sheet="bill-add"]');
  await expect(alta).toBeVisible();
  await expect(alta).toHaveAttribute("role", "dialog");
  await expect(alta).toHaveAttribute("aria-modal", "true");
  await expect(alta).toHaveAccessibleName(/Qué es/i);
  await expect(page.getByRole("dialog", { name: /Qué es/i })).toBeVisible();
  // Teclear no debe robar foco al h1 (Codex 2120Z)
  const altaIn = alta.locator("input.v4-bills-search");
  await altaIn.click();
  await altaIn.pressSequentially("Netflix", { delay: 20 });
  await expect(altaIn).toHaveValue("Netflix");
  await expect(altaIn).toBeFocused();
  await page.keyboard.press("Tab");
  expect(await alta.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Shift+Tab");
  expect(await alta.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(alta).toHaveCount(0);
  await expect(hub).toBeVisible();
  await expect(addBtn).toBeFocused();
  // Ficha de un recibo (entrar al grupo → fila)
  await hub.locator(".v4-bills-group").filter({ hasText: /Servicios y suministros/i }).click();
  const fila = hub.locator(".v4-bills-row").filter({ hasText: "Luz" });
  await fila.focus();
  await fila.click();
  const ficha = page.locator('.v4-sheet[data-sheet="bill"]');
  await expect(ficha).toBeVisible();
  await expect(ficha).toHaveAttribute("role", "dialog");
  await expect(ficha).toHaveAttribute("aria-modal", "true");
  await expect(ficha).toHaveAccessibleName(/Luz/i);
  await expect(page.getByRole("dialog", { name: /Luz/i })).toBeVisible();
  const fichaIn = ficha.locator("input.v4-bills-search").first();
  await fichaIn.click();
  await fichaIn.pressSequentially("ABC", { delay: 20 });
  await expect(fichaIn).toHaveValue(/ABC/);
  await expect(fichaIn).toBeFocused();
  await page.keyboard.press("Tab");
  expect(await ficha.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Shift+Tab");
  expect(await ficha.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(ficha).toHaveCount(0);
  await expect(fila).toBeFocused();
});
