/* Recibo anual y CTA de ReciboPasos: regresiones que sí existían en e04778e0a (bundle base). */
import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, installFixtureClock } from "./fixtures.mjs";

test.beforeEach(async ({ page }) => {
  await installFixtureClock(page);
});

const accounts = [{ id: "sab", ent: "sabadell", name: "Nómina y recibos", value: 2000, role: "fijos" }];
const settings = { autoPrices: false, theme: "green", lang: "es", simpleMode: false, expenseBanks: ["sabadell"] };
const fixedBase = [{ id: "luz", name: "Luz", amount: 50, freq: "mes", account: "sabadell", day: 5 }];

const hoja = (page) => page.locator('.v4-sheet[data-sheet="recibo-pasos"]');
const paso = (page, n) => hoja(page).locator('[data-rp4-paso="' + n + '"]');
const cta = (page) => hoja(page).locator(".rp4-foot button.rp4-cta");

async function abreTusRecibos(page, overrides) {
  await seedLoggedInDashboard(page, Object.assign({ accounts, fixed: fixedBase, debts: [], flows: [], oneoffs: [], budget: 1000, settings }, overrides || {}));
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  const nombre = await page.evaluate(() => t("pr6_todos"));
  await page.locator('.v4-screen > [data-seg="recibos"]').getByRole("button", { name: nombre, exact: true }).click();
  return page.locator("[data-bills-manage]");
}

async function abreAlta(page) {
  const hub = await abreTusRecibos(page);
  await hub.locator('[data-act="bill-add"]').first().click();
  await expect(hoja(page)).toHaveAttribute("data-paso", "0");
}

async function hastaCuando(page, name, amountDigits) {
  await paso(page, 0).locator('[data-rp4="name"]').fill(name);
  await cta(page).click();
  await expect(hoja(page)).toHaveAttribute("data-paso", "1");
  for (const d of amountDigits) await paso(page, 1).locator(".v4-keys").getByRole("button", { name: d, exact: true }).click();
  await cta(page).click();
  await expect(hoja(page)).toHaveAttribute("data-paso", "2");
}

/** En la base el CTA llevaba `disabled` nativo (opacity .35). Aquí vigila disabled, is-wait y fondo. */
async function expectCtaSinDisabledNativo(page, accion) {
  await page.evaluate(() => {
    window.__rp4Cta = { disabled: [], wait: [], bg: [], unmounts: 0 };
    const sel = '[data-sheet="recibo-pasos"] .rp4-foot button.rp4-cta';
    const btn = document.querySelector(sel);
    if (!btn) return;
    const snap = () => {
      const b = document.querySelector(sel);
      if (!b) return;
      window.__rp4Cta.disabled.push(!!b.disabled);
      window.__rp4Cta.wait.push(b.classList.contains("is-wait"));
      window.__rp4Cta.bg.push(getComputedStyle(b).backgroundColor);
    };
    snap();
    new MutationObserver((ms) => {
      for (const m of ms) {
        for (const n of m.removedNodes) if (n === btn || (n.contains && n.contains(btn))) window.__rp4Cta.unmounts++;
        if (m.type === "attributes" && (m.attributeName === "disabled" || m.attributeName === "class")) snap();
      }
    }).observe(btn, { attributes: true, attributeFilter: ["disabled", "class"] });
    const t0 = performance.now();
    (function f() {
      snap();
      if (performance.now() - t0 < 450) requestAnimationFrame(f);
    })();
  });
  await accion();
  await page.waitForTimeout(460);
  const rec = await page.evaluate(() => window.__rp4Cta);
  expect(rec.unmounts, "el botón Siguiente no debe desmontarse").toBe(0);
  expect(rec.disabled.some(Boolean), "sin atributo disabled nativo (parpadeo en la base)").toBe(false);
}

async function mesesVisiblesEnHoja(page) {
  return page.evaluate(() => {
    const sheet = document.querySelector('[data-sheet="recibo-pasos"]');
    const mp = sheet && sheet.querySelector(".month-picker");
    if (!sheet || !mp) return { ok: false, reason: "sin cuadrícula" };
    const sr = sheet.getBoundingClientRect();
    const mr = mp.getBoundingClientRect();
    const visible = mr.top < sr.bottom - 8 && mr.bottom > sr.top + 8;
    return { ok: visible, top: mr.top, sheetBottom: sr.bottom };
  });
}

const diasFold = (page) => paso(page, 2).locator(".pr6-fold").filter({ has: page.locator("[data-rp4-dia]") });

async function abreEditPaso2DesdeReview(page, bill) {
  await seedLoggedInDashboard(page, {
    accounts,
    fixed: [bill, ...fixedBase],
    debts: [],
    flows: [],
    oneoffs: [],
    budget: 1000,
    settings,
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  const recibos = page.locator('.v4-screen > [data-seg="recibos"]');
  await recibos.getByTestId("plan-review").getByRole("button", { name: new RegExp(bill.name, "i") }).click();
  await page.locator('.v4-sheet[data-sheet="recibo"] [data-act="editar"]').click();
  await expect(hoja(page)).toHaveAttribute("data-modo", "edit");
  await paso(page, 4).locator('[data-rp4-fila="2"]').click();
  await expect(hoja(page)).toHaveAttribute("data-paso", "2");
}

async function abreEditPaso2DesdeTodosServ(page, bill) {
  const hub = await abreTusRecibos(page, { fixed: [bill, ...fixedBase] });
  await hub.locator('[data-group="serv"]').click();
  await hub.locator('[data-bill-id="' + bill.id + '"]').click();
  await expect(hoja(page)).toHaveAttribute("data-modo", "edit");
  await paso(page, 4).locator('[data-rp4-fila="2"]').click();
  await expect(hoja(page)).toHaveAttribute("data-paso", "2");
}

test("alta anual: meses visibles, día solo tras mes, scroll y guardado", async ({ page }) => {
  await abreAlta(page);
  await hastaCuando(page, "Seguro anual", ["6", "0", "0"]);
  await paso(page, 2).locator('[data-rp4-freq="año"]').click();
  await expect(paso(page, 2).locator(".month-picker .mchip")).toHaveCount(12);
  await expect(diasFold(page), "sin mes elegido el día no se despliega (en la base sí)").not.toHaveClass(/ open/);
  let vis = await mesesVisiblesEnHoja(page);
  expect(vis.ok, "la cuadrícula de meses debe quedar a la vista tras «Una vez al año»").toBe(true);
  await paso(page, 2).locator(".month-picker button", { hasText: /^Oct$/i }).click();
  await expect(paso(page, 2).locator('[data-rp4-dia="10"]')).toBeVisible();
  const aviso = paso(page, 2).locator(".hint");
  await expect(aviso).toContainText("50,00 € al mes repartidos");
  await expect(aviso).toContainText("600,00 € al año");
  await paso(page, 2).locator('[data-rp4-dia="10"]').click();
  await cta(page).click();
  await paso(page, 3).locator('[data-rp4-banco="sabadell"]').click();
  await expect(hoja(page)).toHaveAttribute("data-paso", "4");
  await cta(page).click();
  await expect(hoja(page)).toHaveCount(0, { timeout: 5000 });
  const nuevo = await page.evaluate(() => JSON.parse(localStorage.getItem("micartera_v3")).fixed.find((f) => f.name === "Seguro anual"));
  expect(nuevo).toMatchObject({ amount: 600, freq: "año", months: [10], day: 10, account: "sabadell" });
});

test("editar anual: el mes guardado sale preseleccionado", async ({ page }) => {
  await abreEditPaso2DesdeReview(page, {
    id: "seg",
    name: "Seguro hogar",
    amount: 400,
    freq: "año",
    months: [9],
    day: 20,
    account: "sabadell",
  });
  await expect(paso(page, 2).locator(".month-picker .mchip.on")).toHaveText(/^Sep$/i);
  const vis = await mesesVisiblesEnHoja(page);
  expect(vis.ok, "al editar anual la cuadrícula de meses debe verse sin buscar a mano").toBe(true);
  await expect(paso(page, 2).locator('[data-rp4-dia="20"]')).toHaveClass(/ on/);
});

test("editar anual: mes→año sin mes oculta días y deja el CTA en espera", async ({ page }) => {
  await abreEditPaso2DesdeReview(page, {
    id: "seg",
    name: "Seguro hogar",
    amount: 400,
    freq: "año",
    months: [9],
    day: 20,
    account: "sabadell",
  });
  await paso(page, 2).locator('[data-rp4-freq="mes"]').click();
  await expect(diasFold(page)).toHaveClass(/ open/);
  await paso(page, 2).locator('[data-rp4-freq="año"]').click();
  await expect(paso(page, 2).locator(".month-picker .mchip.on")).toHaveCount(0);
  await expect(diasFold(page), "sin mes en anual el pliegue de días debe cerrarse (base lo deja open)").not.toHaveClass(/ open/);
  await expect(cta(page)).toHaveClass(/is-wait/);
  await expect(cta(page)).toHaveAttribute("aria-disabled", "true");
  await expect(cta(page)).not.toHaveAttribute("disabled");
});

test("editar anual de marzo desde Todos › Servicios", async ({ page }) => {
  await abreEditPaso2DesdeTodosServ(page, {
    id: "seg",
    name: "Seguro hogar",
    amount: 400,
    freq: "año",
    months: [3],
    day: 14,
    account: "sabadell",
  });
  await expect(paso(page, 2).locator(".month-picker .mchip.on")).toHaveCount(1);
  await expect(paso(page, 2).locator(".month-picker .mchip.on")).toHaveText(/^Mar$/i);
  await expect(paso(page, 2).locator('[data-rp4-dia="14"]')).toHaveClass(/ on/);
  await expect(paso(page, 2).locator('[data-rp4-dia="14"]')).toBeVisible();
  await expect(cta(page)).toHaveAttribute("aria-disabled", "false");
  await expect(cta(page)).not.toHaveClass(/is-wait/);
});

test("Siguiente sin disabled nativo al avanzar y al volver", async ({ page }) => {
  await abreAlta(page);
  await paso(page, 0).locator('[data-rp4="name"]').fill("Prueba CTA");
  await expectCtaSinDisabledNativo(page, async () => {
    await cta(page).click();
    await expect(hoja(page)).toHaveAttribute("data-paso", "1");
  });
  await paso(page, 1).locator(".v4-keys").getByRole("button", { name: "5", exact: true }).click();
  await expectCtaSinDisabledNativo(page, async () => {
    await cta(page).click();
    await expect(hoja(page)).toHaveAttribute("data-paso", "2");
  });
  await expectCtaSinDisabledNativo(page, async () => {
    await hoja(page).locator('[data-act="back"]').click();
    await expect(hoja(page)).toHaveAttribute("data-paso", "1");
  });
  await expectCtaSinDisabledNativo(page, async () => {
    await hoja(page).locator('[data-act="back"]').click();
    await expect(hoja(page)).toHaveAttribute("data-paso", "0");
  });
});
