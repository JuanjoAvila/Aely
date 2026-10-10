import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* El encargo10/10 recupera el dibujo de producción110, no la variante109 ni otro diseño.
 * Los datos son sintéticos. El último punto es el patrimonio actual: mirar la gráfica,
 * cambiar de pestaña o recargar no debe reescribir el histórico ni la cartera. */
const CUENTA = { id: "a1", ent: "sabadell", name: "Banco", value: 1000, role: "fijos", spendFrom: false };

async function inicio(page, estado) {
  await page.route("https://api.frankfurter.dev/**", route => route.abort());
  await seedLoggedInDashboard(page, estado);
  await page.goto("/");
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
}

function heroRe(amount, sym) {
  const raw = Math.abs(amount).toFixed(2).replace(".", ",");
  const miles = raw.replace(/^(\d+)(,)/, function (_, ent, comma) {
    return ent.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + comma;
  });
  return new RegExp((amount < 0 ? "-" : "") + "(?:" + miles.replace(/\./g, "\\.") + "|" + raw + ") " + sym);
}

async function actual(page, amount, sym = "€", points = true) {
  const hero = page.locator('.v4-screen:has(.v4-inicio-head) .v4-hero');
  await expect(hero).toBeVisible();
  await expect(hero.locator(".v4-hero-amt")).toContainText(heroRe(amount, sym));
  const svg = hero.locator("svg.spark");
  if (points) {
    await expect(svg).toBeVisible();
    await expect(svg).toHaveAttribute("viewBox", "0 0 320 70");
    await expect(svg).toHaveAttribute("preserveAspectRatio", "none");
    await expect(svg.locator("path")).toHaveCount(2);
    await expect(svg.locator('path[fill="none"]')).toHaveAttribute("stroke", "#5FD08A");
    await expect(svg.locator('path[fill="none"]')).toHaveAttribute("stroke-width", "2.4");
    await expect(svg.locator('path[fill="url(#sparkfill)"]')).toHaveCount(1);
    await expect(svg.locator('linearGradient stop').first()).toHaveAttribute("stop-opacity", "0.28");
    await expect(svg.locator("circle")).toHaveAttribute("fill", "#7DE8A8");
    await expect(svg.locator("circle")).toHaveAttribute("r", "3.5");
    await expect(svg.locator("circle")).toHaveAttribute("cx", "316");
    expect(await svg.locator('path[fill="none"]').getAttribute("d")).not.toMatch(/NaN|Infinity/);
  } else await expect(svg).toHaveCount(0);
  await expect(hero.getByTestId("inicio-net-now")).toHaveCount(0);
  await expect(page.getByTestId("inicio-chart-note")).toHaveCount(0);
  await expect(hero.locator("table, ul, ol")).toHaveCount(0);
  return hero;
}

async function carteraGuardada(page) {
  return page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("micartera_v3") || "{}");
    return JSON.stringify([s.accounts, s.investments, s.assets, s.debts, s.history]);
  });
}

for (const [nombre, history] of [
  ["vacío", []], ["cero del alta", [0]], ["un número", [250]],
  ["varios números", [100, 800, 300]],
  ["semilla de ejemplo", [42000, 42150, 42300, 42450, 42600, 42750, 42800]],
  ["igual al actual", [1000]],
]) test("gráfica original con histórico: " + nombre, async ({ page }) => {
  await inicio(page, { history, accounts: [CUENTA], budget: 500 });
  const hero = await actual(page, 1000, "€", history.length > 0);
  if (!history.length) await expect(hero).toContainText("Tu histórico empieza hoy");
  await expect(hero).not.toContainText(/ganancia|rentabilidad|Ahora/);
  const guardado = JSON.parse(await carteraGuardada(page));
  expect(guardado[0][0].value).toBe(1000);
  expect(guardado[4]).toEqual(history);
});

// Este caso abre Inicio: si desaparece la gráfica, falla antes de leer el trazado.
// Los atributos se contrastan también en la pasada A/B contra main110/bdd75636.
test("dibujo de producción110: área, línea y último punto", async ({ page }, testInfo) => {
  await inicio(page, { history: [100, 800, 300], accounts: [CUENTA], budget: 500 });
  const hero = await actual(page, 1000);
  const svg = hero.locator("svg.spark");
  await expect(svg.locator('path[fill="none"]')).toHaveAttribute("d", "M4 66 L108 17.77777777777778 L212 52.22222222222222 L316 4");
  await expect(svg.locator('path[fill="url(#sparkfill)"]')).toHaveAttribute("d", "M4 66 L108 17.77777777777778 L212 52.22222222222222 L316 4 L316 70 L4 70 Z");
  await expect(svg.locator("circle")).toHaveAttribute("cy", "4");
  await testInfo.attach("inicio-hero", { body: await hero.screenshot({ animations: "disabled" }), contentType: "image/png" });
});

for (const [lang, empty] of [["es", "Tu histórico empieza hoy"], ["en", "Your history starts today"], ["ca", "El teu històric comença avui"]]) {
  test(lang + " conserva patrimonio compuesto y cartera al recargar", async ({ page }) => {
    const accounts = [CUENTA, { ...CUENTA, id: "a2", ent: "caixa", name: "Segunda cuenta", value: 250 }];
    const assets = [
      { id: "house-current", kind: "piso", name: "Bien sintético A", value: 500 },
      { id: "car-current", kind: "coche", name: "Bien sintético B", value: 750 },
    ];
    await inicio(page, { __seedOnce: true, accounts, assets, investments: [], debts: [], obAccounts: [],
      expenses: [], fixed: [], flows: [], oneoffs: [], aportaciones: [], history: [0, 99, 5000],
      settings: { autoPrices: false, lang, currency: "EUR" } });
    await actual(page, 2500);
    await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
    const before = await carteraGuardada(page);
    const stored = JSON.parse(before);
    expect(stored[0].map(a => [a.id, a.ent, a.value])).toEqual([["a1", "sabadell", 1000], ["a2", "caixa", 250]]);
    expect(stored[1]).toEqual([]);
    expect(stored[2].map(a => [a.id, a.kind, a.value])).toEqual([["house-current", "piso", 500], ["car-current", "coche", 750]]);
    expect(stored[3]).toEqual([]);
    expect(stored[4]).toEqual([0, 99, 5000]);
    await page.reload();
    await page.waitForFunction(() => !document.getElementById("mc-load"));
    await dismissNews(page);
    await actual(page, 2500);
    await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
    expect(await carteraGuardada(page)).toBe(before);
  });
  test(lang + " sin histórico mantiene el texto de producción110", async ({ page }) => {
    await inicio(page, { accounts: [CUENTA], history: [], settings: { autoPrices: false, lang } });
    const hero = await actual(page, 1000, "€", false);
    await expect(hero).toContainText(empty);
  });
}

test("el alta conserva su cero y recupera el dibujo original", async ({ page }) => {
  await inicio(page, { onboarded: false, history: [], budget: 0, accounts: [{ ...CUENTA, value: 1500 }] });
  await page.getByRole("button", { name: "Saltar" }).click();
  await actual(page, 1500);
  const guardado = JSON.parse(await carteraGuardada(page));
  expect(guardado[4]).toEqual([0]);
  expect(guardado[0][0].value).toBe(1500);
});

for (const value of [0, -2500, 9876543.21]) test("importe actual íntegro: " + value, async ({ page }) => {
  await inicio(page, { history: [100, 200], accounts: [{ ...CUENTA, value }], budget: 500 });
  const hero = await actual(page, value);
  await expect(hero.getByRole("status")).toHaveCount(0);
  expect(JSON.parse(await carteraGuardada(page))[0][0].value).toBe(value);
});

for (const [nombre, settings, fx, fxRates, value, sym] of [
  ["USD con cambio guardado", { currency: "USD" }, null, { USD: 0.5 }, 2000, "\\$"],
  ["USD sin cambio", { currency: "USD" }, null, {}, 1000, "€"],
  ["JPY con cambio guardado", { currency: "JPY" }, null, { JPY: 0.00625 }, 160000, "¥"],
]) test("moneda existente sin cambiar el saldo: " + nombre, async ({ page }) => {
  await inicio(page, { history: [100, 500, 2000], accounts: [CUENTA], budget: 500,
    settings: { autoPrices: false, theme: "green", ...settings }, fx, fxRates });
  await actual(page, value, sym);
  const guardado = JSON.parse(await carteraGuardada(page));
  expect(guardado[0][0].value).toBe(1000);
  expect(guardado[4]).toEqual([100, 500, 2000]);
});

test("Plan y vuelta a Inicio conservan la cartera y sus puertas", async ({ page }) => {
  await inicio(page, { history: [100, 800, 300], accounts: [CUENTA], budget: 500 });
  await actual(page, 1000);
  const antes = await carteraGuardada(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  await expect(page.locator('.botnav-tab[data-tour="plan"].active')).toBeVisible();
  await page.locator('.botnav-tab[data-tour="inicio"]').click();
  await actual(page, 1000);
  expect(await carteraGuardada(page)).toBe(antes);
  await expect(page.locator('.botnav-fab')).toBeVisible();
});

for (const lang of ["es", "en", "ca"]) test(lang + " a 360px con la letra máxima", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await inicio(page, { history: [42000, 42800], accounts: [{ ...CUENTA, value: 9500 }], budget: 500,
    settings: { autoPrices: false, theme: "green", lang, textSize: "huge" } });
  await expect(page.locator("html")).toHaveClass(/hugetext/);
  const hero = await actual(page, 9500);
  const cabe = await hero.evaluate(el => [el, el.querySelector(".v4-micro"), el.querySelector(".v4-hero-amt"), el.querySelector("svg.spark")]
    .every(n => n.getBoundingClientRect().left >= 0 && n.getBoundingClientRect().right <= innerWidth + 1));
  expect(cabe).toBe(true);
});

test("modo sencillo conserva su etiqueta y el total", async ({ page }) => {
  await inicio(page, { accounts: [CUENTA], history: [0], settings: { autoPrices: false, theme: "green", simpleMode: true } });
  const hero = await actual(page, 1000);
  await expect(hero.locator(".v4-micro")).toHaveText("Tu dinero en total");
});

for (const [lang, unknown] of [["es", "El total actual no está disponible."], ["en", "The current total is unavailable."], ["ca", "El total actual no està disponible."]])
test(lang + " conserva la protección de total desconocido de112", async ({ page }) => {
  await inicio(page, { accounts: [CUENTA], settings: { autoPrices: false, theme: "green", lang } });
  const antes = await carteraGuardada(page);
  await page.evaluate(() => {
    const host = document.createElement("div");
    host.id = "e2e-current-host";
    document.body.appendChild(host);
    window.__currentRoot = ReactDOM.createRoot(host);
  });
  const host = page.locator("#e2e-current-host");
  for (const type of ["null", "undefined", "NaN", "Infinity", "string"]) {
    await page.evaluate(type => {
      const values = { null: null, undefined: undefined, NaN: NaN, Infinity: Infinity, string: "1000" };
      window.__currentRoot.render(React.createElement(NetWorthNow, { value: values[type], shown: 0, simple: false, history: [0, 100] }));
    }, type);
    await expect(host.locator(".v4-hero-amt")).toHaveText("—");
    await expect(host.getByRole("status")).toHaveText(unknown);
    await expect(host.locator("svg")).toHaveCount(0);
  }
  await page.evaluate(() => window.__currentRoot.render(React.createElement(NetWorthNow, { value: 0, shown: NaN, simple: false, history: [0] })));
  await expect(host.locator(".v4-hero-amt")).toContainText(heroRe(0, "€"));
  await expect(host.getByRole("status")).toHaveCount(0);
  await expect(host.locator("svg.spark")).toBeVisible();
  expect(await carteraGuardada(page)).toBe(antes);
  await page.evaluate(() => {
    window.__currentRoot.unmount();
    delete window.__currentRoot;
    document.getElementById("e2e-current-host").remove();
  });
});
