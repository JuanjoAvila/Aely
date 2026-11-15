import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, installFixtureClock, gastosRoot, gastosEstado, gastosSeccion, gastosBajaAlDia, gastosAbreGasto } from "./fixtures.mjs";

/* DISEÑO 235, LOTE DE MENORES DE GASTOS. Render puro (AGENTS §7): cada prueba abre la pantalla de
   verdad y mira el DOM, no el código.
   · DIS-15: las secciones son un segmentado con su nombre (no tres iconos), con 44 px de dedo;
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

test("DIS-15: secciones con su nombre en un segmentado, enteras a 360 y con 44 px de dedo", async ({ page }) => {
  await abre(page);
  const tabs = gastosRoot(page).locator('.gx-seg [role="tab"]');
  await expect(tabs).toHaveText(["Movimientos", "Categorías", "Suscripciones"]);
  await expect(gastosRoot(page).locator('.gx-seg [role="tab"] svg')).toHaveCount(0);
  const medidas = await tabs.evaluateAll((els) => els.map((el) => {
    const r = el.getBoundingClientRect(), txt = el.querySelector(".gx-sec-txt");
    // El borde ampliado (`::after`) tiene que seguir siendo el botón: 44 px de alto en total.
    const arriba = document.elementFromPoint(r.left + r.width / 2, r.top - 1), abajo = document.elementFromPoint(r.left + r.width / 2, r.bottom + 1);
    const af = getComputedStyle(el, "::after");
    return { alto: el.offsetHeight - parseFloat(af.top) - parseFloat(af.bottom), ext: el.contains(arriba) && el.contains(abajo), cortado: txt.scrollWidth > txt.clientWidth + 1 };
  }));
  for (const m of medidas) {
    expect(m.alto, "dibujo + borde ampliado, en px CSS").toBeGreaterThanOrEqual(44);
    expect(m.ext, "el ::after amplía el área táctil").toBe(true);
    expect(m.cortado, "el nombre cabe entero a 360").toBe(false);
  }
  await gastosSeccion(page, "subs");
  await expect(gastosRoot(page).locator('[data-gx-tab="subs"]')).toHaveClass(/\bon\b/);
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
  await expect(ficha.locator(".v4-ficha-cat-title button")).toHaveText("Todas ›");
  // El guardado espera 350 ms tras un cambio de importe: pasado eso, sigue igual que antes.
  await page.waitForTimeout(900);
  expect(await guardado()).toEqual(antes);
  expect(antes.amount).toBe(12.5);
});
