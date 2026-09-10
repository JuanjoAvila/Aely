import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* QUITAR UN BANCO PREGUNTA QUÉ HACER CON SUS MOVIMIENTOS, Y TR TIENE DOS PUERTAS
 *
 * Los dos vienen del mismo día (10/9) y de sus propias palabras.
 *
 * 1) Su rechazo: «quité TRADE republic y se mantienen todos los gastos, todos los filtros y todo
 *    igual no ha cambiado nada ni ningún movimiento». Era verdad: quitar un banco purgaba los
 *    saldos y nada más — su `ent` seguía en `settings.expenseBanks`, así que sus compras seguían
 *    contando. Él eligió la opción C: que la app PREGUNTE. Aquí se comprueban las dos respuestas.
 *
 * 2) Su petición: «estaría bien identificar cuándo falla por la api externa de trade republic y
 *    cuándo falla por open banking, me refiero a trade republic». Son dos conexiones distintas que
 *    se arreglan de formas distintas, y las dos decían lo mismo.
 */

async function appLista(page, overrides = {}) {
  await seedLoggedInDashboard(page, overrides);
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await dismissNews(page);
}

/* ── askChoice, la pieza nueva ─────────────────────────────────────────────── */

test("★ askChoice pinta una opción por línea y devuelve la que se toca", async ({ page }) => {
  await appLista(page);
  const r = await page.evaluate(async () => {
    const p = askChoice({ title: "¿Quitar Banco?", sub: "Elige",
      options: [{ v: "keep", label: "Que sigan contando", sub: "todo igual" },
                { v: "stop", label: "Que dejen de contar", sub: "cambia el mes" }] });
    await new Promise((r) => setTimeout(r, 60));
    const opts = Array.from(document.querySelectorAll(".ask-opt"));
    const pintadas = opts.map((o) => o.textContent);
    // Con opciones NO puede haber botón de aceptar: elegir una YA es aceptar.
    const hayAceptar = document.querySelectorAll(".ask-btns .btn-primary").length;
    opts[1].click();
    return { pintadas, hayAceptar, elegida: await p };
  });
  expect(r.pintadas).toHaveLength(2);
  expect(r.pintadas[0]).toContain("Que sigan contando");
  expect(r.pintadas[1]).toContain("cambia el mes");
  expect(r.hayAceptar, "con opciones sobra el botón de aceptar").toBe(0);
  expect(r.elegida).toBe("stop");
});

test("cancelar el diálogo devuelve null: no se elige por él", async ({ page }) => {
  await appLista(page);
  expect(await page.evaluate(async () => {
    const p = askChoice({ title: "¿Quitar Banco?", options: [{ v: "keep", label: "A" }, { v: "stop", label: "B" }] });
    await new Promise((r) => setTimeout(r, 60));
    document.querySelector(".ask-btns .btn-ghost").click();
    return await p;
  })).toBeNull();
});

/* ── Las dos respuestas, sobre el estado de verdad ─────────────────────────── */

const conCaixa = {
  /* La cuenta del día a día es OTRA a propósito: «que dejen de contar» solo se ofrece cuando el
     banco que quitas NO es el de tu día a día. Si lo es, su compra cuenta por definición y la
     app lo dice en vez de ofrecer algo que no puede cumplir. */
  accounts: [{ id: "a-tr", ent: "trade_republic", name: "Diario", value: 900, role: "diario", spendFrom: true },
             { id: "a-caixa", ent: "caixabank", name: "Caixa", value: 500, role: "fijos" }],
  settings: { expenseBanks: ["caixabank", "revolut"] },
  expenses: [
    { id: "x1", date: new Date().toISOString(), amount: 30, merchant: "Compra", category: "super", source: "ob:caixabank" },
  ],
};

test("★ «que dejen de contar» saca el banco de gasto diario y NO borra ni un movimiento", async ({ page }) => {
  await appLista(page, conCaixa);
  const r = await page.evaluate(() => {
    // La decisión, aplicada sobre el estado real por el mismo camino que usa el botón.
    const antes = mcLoadRaw("micartera_v3");
    const gastosAntes = antes.expenses.length;
    const eb = (antes.settings.expenseBanks || []).filter((e) => e !== "caixabank");
    mcSaveRaw("micartera_v3", Object.assign({}, antes, { settings: Object.assign({}, antes.settings, { expenseBanks: eb }) }));
    const dsp = mcLoadRaw("micartera_v3");
    return { gastosAntes, gastosDespues: dsp.expenses.length, bancos: dsp.settings.expenseBanks,
             cuenta: expenseCountsBudget(dsp.expenses[0], dsp) };
  });
  expect(r.bancos).toEqual(["revolut"]);
  // Lo que NUNCA puede pasar: perder movimientos. Se quedan enteros, solo dejan de sumar.
  expect(r.gastosDespues).toBe(r.gastosAntes);
  expect(r.cuenta, "sacado de gasto diario, su compra ya no cuenta para el presupuesto").toBe(false);
});

test("★ «que sigan contando» deja el dinero exactamente igual", async ({ page }) => {
  await appLista(page, conCaixa);
  const r = await page.evaluate(() => {
    const s = mcLoadRaw("micartera_v3");
    return { bancos: s.settings.expenseBanks, cuenta: expenseCountsBudget(s.expenses[0], s),
             gasto: monthBudgetStats(s).spent };
  });
  expect(r.bancos).toContain("caixabank");
  expect(r.cuenta).toBe(true);
  expect(r.gasto).toBe(30);
});

/* ── Las dos puertas de Trade Republic ─────────────────────────────────────── */

test("★ TR por Open Banking dice que es la conexión de BANCO (compras con tarjeta)", async ({ page }) => {
  await appLista(page, {
    hasBankLink: true,
    bankIssues: [{ aspsp: "Trade Republic", ent: "trade_republic", kind: "expired" }],
    accounts: [{ id: "tr", ent: "trade_republic", name: "TR", value: 100 }],
  });
  await page.locator('.botnav-tab[data-tour="cartera"]').click();
  const banner = page.locator(".v4-bank-issue");
  await expect(banner).toBeVisible();
  await expect(banner).toContainText(/\(banco\)/i);
  await expect(banner).toContainText(/compras con tarjeta/i);
  // Y dice explícitamente que lo OTRO no está afectado, que es lo que le confundía.
  await expect(banner).toContainText(/posiciones y (tu )?efectivo/i);
  await expect(banner.getByRole("button")).toContainText(/permiso del banco/i);
});

test("★ TR por su propia API dice que es la sesión de INVERSIONES", async ({ page }) => {
  await appLista(page, { accounts: [{ id: "tr", ent: "trade_republic", name: "TR", value: 100 }] });
  await page.addInitScript(() => { localStorage.setItem("mc_tr_phone", "600000000"); });
  await page.locator('.botnav-tab[data-tour="cartera"]').click();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("mc-tr-status", { detail: { connected: false } })));
  const banner = page.locator(".v4-tr-issue");
  await expect(banner).toBeVisible();
  await expect(banner).toContainText(/\(inversiones\)/i);
  // Las dos tarjetas no pueden decir lo mismo: ese era todo el problema.
  await expect(banner).not.toContainText(/\(banco\)/i);
});

test("★ si el banco ES el de tu día a día, no se ofrece lo que no se puede cumplir", async ({ page }) => {
  await appLista(page, {
    accounts: [{ id: "a-caixa", ent: "caixabank", name: "Caixa", value: 500, role: "diario", spendFrom: true }],
    settings: { expenseBanks: ["caixabank"] },
    expenses: [{ id: "x1", date: new Date().toISOString(), amount: 30, merchant: "Compra", category: "super", source: "ob:caixabank" }],
  });
  /* Aunque lo saques de `expenseBanks`, `expenseBankEnts` vuelve a meter el `ent` de la cuenta
     diaria: es su cartera, sus compras cuentan por definición. Ofrecer «que dejen de contar» ahí
     sería prometer algo que la app no puede hacer. Este test fija ese límite. */
  const sigue = await page.evaluate(() => {
    const s = mcLoadRaw("micartera_v3");
    const sin = Object.assign({}, s, { settings: Object.assign({}, s.settings, { expenseBanks: [] }) });
    return { ents: expenseBankEnts(sin), cuenta: expenseCountsBudget(sin.expenses[0], sin) };
  });
  expect(sigue.ents).toContain("caixabank");
  expect(sigue.cuenta).toBe(true);
});
