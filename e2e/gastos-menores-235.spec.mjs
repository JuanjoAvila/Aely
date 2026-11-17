import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, installFixtureClock, gastosRoot, gastosEstado, gastosSeccion, gastosBajaAlDia, gastosAbreGasto } from "./fixtures.mjs";

/* DISEÑO 235, LOTE DE MENORES DE GASTOS. Render puro (AGENTS §7): cada prueba abre la pantalla de
   verdad y mira el DOM, no el código.
   · DIS-15 (deshecho el 16/11): las secciones vuelven a ser tres iconos junto al título;
   · DIS-16: bajando, la línea de estado dice DELANTE y en menta «hasta el N»;
   · DIS-17: Categorías con céntimos, como la cifra de arriba;
   · DIS-18: el vacío ofrece Apuntar y, sin bancos, Conectar;
   · DIS-10 y DIS-12: la ficha Modificar precarga «12,50» (sin guardar nada por abrirla) y el
     enlace a todas las categorías ya no lleva número.
   El reloj es el de las fixtures: 26/9/2026 a mediodía. */

test.beforeEach(async ({ page }) => { await installFixtureClock(page); });
test.use({ viewport: { width: 360, height: 640 }, hasTouch: true });

const e = (id, ymd, amount, category, extra = {}) => ({ id, date: ymd + "T12:00:00Z", amount, category, merchant: id, source: "ob", ent: "trade_republic", ...extra });
const base = {
  budget: 1000,
  settings: { autoPrices: false, theme: "green", lang: "es", expenseBanks: ["trade_republic"] },
  accounts: [{ id: "tr", ent: "trade_republic", name: "Efectivo", value: 3000, role: "diario", spendFrom: true }],
};
const expenses = [
  e("Supermercado Dia", "2026-09-26", 62.5, "super"), e("Mercadona", "2026-09-20", 50, "super"),
  { id: "man1", date: "2026-09-25T12:00:00Z", amount: 12.5, category: "bares", merchant: "Café manual", source: "manual", ent: "trade_republic" },
  ...Array.from({ length: 30 }, (_, i) => e("Agosto " + i, "2026-08-" + String(1 + (i % 28)).padStart(2, "0"), 5 + i, "compras")),
];

async function abre(page, overrides = {}) {
  await seedLoggedInDashboard(page, { ...base, expenses, ...overrides });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await expect(gastosRoot(page)).toBeVisible();
}

/* DIS-15 se deshizo a petición del dueño (16/11: «deja los iconos de movimiento y demás arriba
   como estaba»): las secciones vuelven a ser tres iconos de 44 px junto al título, dentro de la
   cabecera. Se vigila que sigan ahí, con su nombre para el lector, y que cada uno cambie de sección
   tocándolo de verdad (no por el helper, que podría ir por otro camino). */
test("DIS-15 deshecho: tres iconos junto al título, 44 px de dedo, y cada uno cambia de sección", async ({ page }) => {
  await abre(page);
  const tabs = gastosRoot(page).locator('.gx-titulo .gx-secciones [role="tab"]');
  await expect(tabs).toHaveCount(3);
  await expect(gastosRoot(page).locator(".gx-seg")).toHaveCount(0);
  await expect(tabs.locator("svg")).toHaveCount(3);
  await expect(tabs.nth(0)).toHaveAttribute("aria-label", "Movimientos");
  await expect(tabs.nth(1)).toHaveAttribute("aria-label", "Categorías");
  await expect(tabs.nth(2)).toHaveAttribute("aria-label", "Suscripciones");
  const medidas = await tabs.evaluateAll((els) => {
    const h1 = document.querySelector(".gx-root .gx-titulo .v4-title").getBoundingClientRect();
    return els.map((el) => { const r = el.getBoundingClientRect(); return { w: r.width, h: r.height, misma: Math.abs((r.top + r.bottom) / 2 - (h1.top + h1.bottom) / 2) < 12 }; });
  });
  for (const m of medidas) {
    expect(m.w, "ancho de dedo").toBeGreaterThanOrEqual(44);
    expect(m.h, "alto de dedo").toBeGreaterThanOrEqual(44);
    expect(m.misma, "en la fila del título").toBe(true);
  }
  for (const id of ["cats", "subs", "movs"]) {
    await gastosRoot(page).locator('.gx-titulo [data-gx-tab="' + id + '"]').click();
    await expect(gastosRoot(page)).toHaveAttribute("data-secc", id);
    await expect(gastosRoot(page).locator('[data-gx-tab="' + id + '"]')).toHaveAttribute("aria-selected", "true");
    await expect(gastosRoot(page).locator('[data-gx-secc="' + id + '"]')).toHaveAttribute("aria-hidden", "false");
  }
});

test("DIS-16 y DIS-17: bajando, «hasta el 20» delante y en menta; Categorías con céntimos", async ({ page }) => {
  await abre(page);
  await expect(gastosRoot(page).locator(".gx-hasta")).toHaveCount(0);
  await gastosBajaAlDia(page, "2026-09-20");
  await expect(gastosEstado(page)).toHaveText("hasta el 20 · gastado en septiembre");
  const hasta = gastosEstado(page).locator(".gx-hasta");
  await expect(hasta).toHaveText("hasta el 20");
  const [color, menta, peso] = await hasta.evaluate((el) => {
    const p = document.createElement("i"); p.style.color = "var(--mint)"; el.parentNode.appendChild(p);
    const m = getComputedStyle(p).color; p.remove();
    return [getComputedStyle(el).color, m, getComputedStyle(el).fontWeight];
  });
  expect(color).toBe(menta);
  expect(peso).toBe("700");
  await page.evaluate(() => document.querySelector(".page-scroll-host").scrollTo(0, 0));
  await gastosSeccion(page, "cats");
  await expect(gastosRoot(page).locator('.v4-gastos-cat[data-cat="super"] .v4-gastos-cat-amt')).toHaveText("112,50 €");
});

test("DIS-18: sin bancos, el vacío ofrece Conectar y Apuntar, que abre la hoja", async ({ page }) => {
  await abre(page, { expenses: [], accounts: [] });
  const vacio = gastosRoot(page).getByTestId("gastos-vacio");
  await expect(vacio.getByTestId("gastos-vacio-banco")).toHaveText("Conecta tu banco");
  await vacio.getByTestId("gastos-vacio-apuntar").click();
  await expect(page.locator('.v4-exp-sheet [data-testid="ap"]')).toBeVisible();
});

test("DIS-18: con un banco conectado el vacío no ofrece conectar otro", async ({ page }) => {
  await abre(page, { expenses: [], obAccounts: [{ id: "ob1", ent: "trade_republic", name: "Cuenta", balance: 10 }] });
  const vacio = gastosRoot(page).getByTestId("gastos-vacio");
  await expect(vacio.getByTestId("gastos-vacio-apuntar")).toBeVisible();
  await expect(vacio.getByTestId("gastos-vacio-banco")).toHaveCount(0);
});

test("DIS-10 y DIS-12: la ficha precarga «12,50» sin guardar nada y «Todas ›» sin número", async ({ page }) => {
  await abre(page);
  const guardado = () => page.evaluate(() => JSON.parse(localStorage.getItem("micartera_v3_exp") || "[]").find((x) => x.id === "man1"));
  const antes = await guardado();
  await gastosAbreGasto(page, "Café manual");
  const ficha = page.locator('.v4-exp-sheet [data-testid="exp"]');
  await expect(ficha.locator(".v4-ficha-amount")).toHaveText("12,50");
  await expect(ficha.locator(".v4-ficha-cat-title .v4-ficha-todas")).toHaveText("Todas ›");
  // El guardado espera 350 ms tras un cambio de importe: pasado eso, sigue igual que antes.
  await page.waitForTimeout(900);
  expect(await guardado()).toEqual(antes);
  expect(antes.amount).toBe(12.5);
});
