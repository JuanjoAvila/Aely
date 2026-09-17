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
  await expect(page.locator(".v4-plan-cover")).toBeVisible();
}

test("traspaso+oneoff+nómina: titular = solo recibos; traspaso no suma; nómina en «entrará»", async ({ page }) => {
  await openPlan(page, {
    fixed: [{ id: "luz", name: "Luz", amount: 40, freq: "mes", day: 28, account: "sabadell" }],
    oneoffs: [{ id: "itv", name: "ITV", amount: 50, year: 2026, month: 9, day: 20, account: "sabadell" }],
    flows: [
      { id: "nom", kind: "income", name: "Nómina", amount: 2000, to: "sabadell", day: 25 },
      { id: "tr", kind: "transfer", name: "A TR", amount: 500, from: "sabadell", to: "trade_republic", day: 15 },
    ],
    debts: [],
  });
  const cover = page.locator(".v4-plan-cover");
  await expect(cover).toContainText(/90/);
  await expect(cover).not.toContainText(/590|2090/);
  const recibos = page.locator(".v4-screen > [data-seg='recibos']");
  await expect(recibos).toContainText("A TR");
  await expect(recibos).toContainText(/Lo que aún entrará/);
  await expect(recibos).toContainText("Nómina");
});

test("anillo por euros: 1€ pagado + 999 pendiente ≈ 0%", async ({ page }) => {
  await openPlan(page, {
    fixed: [
      { id: "a", name: "Mini", amount: 1, freq: "mes", day: 2, account: "sabadell" },
      { id: "b", name: "Gordo", amount: 999, freq: "mes", day: 28, account: "sabadell" },
    ],
  });
  const cover = page.locator(".v4-plan-cover");
  await expect(cover).toContainText("0%");
  await expect(cover).not.toContainText("50%");
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
  // Portada local: descuenta la cuota aunque 11 no la proyecte (min 500→420).
  const cover = page.locator(".v4-plan-cover");
  await expect(cover).toContainText(/420|80/);
  await expect(cover).not.toContainText(/día ya|day already|dia ja/i);
});

test("min bajo → warn/bad con frase sin compras del día a día", async ({ page }) => {
  await openPlan(page, {
    accounts: [{ id: "sb", ent: "sabadell", name: "Sabadell", value: 100, role: "fijos" }],
    fixed: [{ id: "luz", name: "Luz", amount: 200, freq: "mes", day: 28, account: "sabadell" }],
    flows: [{ id: "nom", kind: "income", name: "Nómina", amount: 50, to: "sabadell", day: 30 }],
  });
  const cover = page.locator(".v4-plan-cover");
  expect(["warn", "bad"]).toContain(await cover.getAttribute("data-plan-state"));
  await expect(cover).toContainText(/sin contar compras del día a día/i);
});

test("todo pagado → 100% sin NaN ni «día ya»", async ({ page }) => {
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
  const cover = page.locator(".v4-plan-cover");
  await expect(cover).toContainText("100%");
  await expect(cover).not.toContainText(/NaN/);
  await expect(cover).not.toContainText(/día ya|day already|dia ja/i);
  await expect(cover).toContainText(/Ya has pagado todos los recibos/i);
  await expect(cover).toHaveAttribute("role", "group");
  await expect(page.locator(".v4-screen > [data-seg='recibos']")).toContainText(/Nada pendiente|ya no sale/i);
});

test("todo pagado con cuenta borrada: frase genérica, no 0 € inventado", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-09-30T12:00:00Z") });
  await seedLoggedInDashboard(page, {
    // Solo Sabadell vivo; el recibo pagado apunta a un banco que ya no está.
    accounts: accountsFijos,
    fixed: [{ id: "luz", name: "Luz", amount: 40, freq: "mes", day: 5, account: "banco_fantasma" }],
    budget: 500,
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 60_000 });
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  const cover = page.locator(".v4-plan-cover");
  await expect(cover).toContainText(/Ya has pagado todos los recibos/i);
  await expect(cover).not.toContainText(/tienes 0\s*€|0,00\s*€ en/i);
  await expect(cover).not.toContainText(/día ya|day already|dia ja/i);
});

test("todo pagado con saldo conocido negativo: no titular verde", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-09-30T12:00:00Z") });
  await seedLoggedInDashboard(page, {
    accounts: [{ id: "sb", ent: "sabadell", name: "Sabadell", value: -80, role: "fijos" }],
    fixed: [{ id: "luz", name: "Luz", amount: 40, freq: "mes", day: 5, account: "sabadell" }],
    budget: 500,
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 60_000 });
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  const cover = page.locator(".v4-plan-cover");
  await expect(cover).toHaveAttribute("data-plan-state", "bad");
  await expect(cover).not.toContainText(/Vas bien este mes/i);
  await expect(cover).toContainText(/Ya has pagado todos los recibos/i);
  await expect(cover).toContainText(/-80/);
});

test("dos bancos: el rojo manda la frase; el total global no mezcla", async ({ page }) => {
  await openPlan(page, {
    accounts: [
      { id: "sb", ent: "sabadell", name: "Sabadell", value: 5000, role: "fijos" },
      { id: "rv", ent: "revolut", name: "Revolut", value: 10, role: "ambos" },
    ],
    fixed: [
      { id: "luz", name: "Luz", amount: 40, freq: "mes", day: 28, account: "sabadell" },
      { id: "netflix", name: "Netflix", amount: 90, freq: "mes", day: 25, account: "revolut" },
    ],
    flows: [],
  });
  const cover = page.locator(".v4-plan-cover");
  // Total global 130 en el pie
  await expect(cover).toContainText(/130/);
  // Si Revolut queda corto, la frase nombra Revolut (peor riesgo)
  const phrase = await cover.locator(".ph").first().innerText();
  if ((await cover.getAttribute("data-plan-state")) === "bad" || (await cover.getAttribute("data-plan-state")) === "warn") {
    expect(phrase).toMatch(/Revolut/i);
    expect(phrase).not.toMatch(/Sabadell/i);
  }
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

test("plegable Ya has pagado solo recibos; Atrás real no sale de Plan", async ({ page }) => {
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
  const fold = page.locator(".v4-paid-fold");
  await expect(fold).toHaveAttribute("aria-expanded", "false");
  await fold.click();
  await expect(fold).toHaveAttribute("aria-expanded", "true");
  await expect(fold).toHaveAttribute("aria-controls", "v4-paid-panel");
  await expect(page.locator(".v4-screen > [data-seg='recibos']")).toContainText("Luz");
  await expect(page.locator(".v4-screen > [data-seg='recibos']")).not.toContainText("Nómina");
  // Atrás real (history), no Escape (Claude 1845Z).
  await page.goBack();
  await expect(fold).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator('.botnav-tab.active')).toHaveAttribute("data-tour", "plan");
});

test("Pregúntame abre Deudas con segmented de dos líneas", async ({ page }) => {
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
