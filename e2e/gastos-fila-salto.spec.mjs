import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, installFixtureClock, gastosRoot, gastosCifra, gastosEstado, gastosPeriodo, gastosBajaAlDia } from "./fixtures.mjs";

/* LA FILA DE MESES / CICLOS LLEVA AL MES TOCADO (rechazo de la beta 4.26.173, 25/10/2026).
   Sus dos frases: en Meses, «si estás en octubre (y tocas el anterior), te lleva al día 1 y sigue
   sin cambiarte de mes; debería ser 31 o 30 del mes anterior»; en Mi ciclo, «cuando le das un mes te
   lleva al principio del todo y se quita». Tocar una pastilla tiene que dejar bajo la cabecera el
   PRIMER día de ese mes en la lista (la lista va de lo nuevo a lo viejo: el último día del mes), con
   la fila a la vista y la pastilla tocada marcada. Con muchas filas por día, que es donde el alto
   estimado de los días aún sin pintar (`content-visibility`) se separa del real.
   El reloj es el de las fixtures: 26/9/2026 a mediodía. */

test.beforeEach(async ({ page }) => { await installFixtureClock(page); });
test.use({ viewport: { width: 412, height: 915 }, hasTouch: true });

const e = (id, ymd, amount, category, extra = {}) => ({ id, date: ymd + "T12:00:00Z", amount, category, merchant: id, source: "ob", ent: "trade_republic", ...extra });
const ymd = (d) => d.toISOString().slice(0, 10);
/* Del 26/9 hacia atrás hasta junio, entre 1 y 6 gastos al día (el alto de cada día varía) y un
   recibo del banco cada 10 días (fila gris: otro alto). Tres nóminas para Mi ciclo (24/7, 24/8, 24/9). */
function gastos() {
  const out = [];
  for (let i = 0; i < 118; i++) {
    const d = ymd(new Date(Date.UTC(2026, 8, 26 - i)));
    const n = 1 + ((i * 7) % 6);
    for (let j = 0; j < n; j++) out.push(e("Compra " + i + "-" + j, d, 5 + j, j % 2 ? "super" : "compras"));
    if (i % 10 === 3) out.push(e("ENDESA " + i, d, 62, "recibos", { reciboId: "luz" }));
  }
  for (const d of ["2026-07-24", "2026-08-24", "2026-09-24"]) out.push(e("Nómina " + d, d, -2000, "ingreso", { merchant: "Nómina" }));
  return out;
}
const base = {
  budget: 1000,
  accounts: [{ id: "tr", ent: "trade_republic", name: "Efectivo", value: 3000, role: "diario", spendFrom: true }],
  fixed: [{ id: "luz", name: "Luz", amount: 62, freq: "mes", account: "trade_republic", day: 20 }],
};

async function abre(page, settings = {}) {
  await seedLoggedInDashboard(page, { ...base, expenses: gastos(), settings: { autoPrices: false, theme: "green", lang: "es", expenseBanks: ["trade_republic"], ...settings } });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  /* Su móvil no mide como el de las pruebas (letra del sistema, otra fuente): las filas salen más
     altas que el alto con el que se estima un día aún sin pintar. Se imita aquí; si no, el salto
     cae justo porque estimación y realidad coinciden por casualidad. */
  await page.addStyleTag({ content: ".gx-list .v4-mov{min-height:128px}" });
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await expect(gastosCifra(page)).toBeVisible();
}
const fila = (page) => gastosRoot(page).getByTestId("gastos-meses");
/* Lo que se ve justo debajo de la cabecera encogida, cuando el scroll ya ha parado: el día de la
   primera tarjeta que asoma bajo la fila. Se mira la PANTALLA (elementFromPoint), no el DOM. */
async function primerDiaVisible(page) {
  await page.waitForFunction(() => new Promise((r) => {
    const h = document.querySelector(".page-scroll-host"); let st = h.scrollTop, quietos = 0;
    const f = () => { quietos = Math.abs(h.scrollTop - st) < 1 ? quietos + 1 : 0; st = h.scrollTop; quietos >= 12 ? r(true) : requestAnimationFrame(f); };
    requestAnimationFrame(f);
  }), null, { timeout: 10_000 });
  return page.evaluate(() => {
    const h = document.querySelector(".page-scroll-host"), head = h.querySelector(".gx-head"), meses = head.querySelector(".gx-meses");
    const y = Math.max(head.getBoundingClientRect().bottom, meses ? meses.getBoundingClientRect().bottom : 0) + 4;
    for (let dy = 0; dy < 300; dy += 6) {
      const el = document.elementFromPoint(200, y + dy), dia = el && el.closest(".gx-dia");
      if (dia) return dia.getAttribute("data-gx-day");
    }
    return null;
  });
}
async function bajaUnPoco(page) {
  await page.evaluate(() => { const h = document.querySelector(".page-scroll-host"); h.scrollTop = 160; });
  await expect(fila(page)).toHaveAttribute("aria-hidden", "false");
}

/* Y CON LA LETRA «NORMAL» (la de 0,92 de zoom, la suya; rechazo de la beta 4.26.180: «al tocar un
   mes … va al día 1 y no cambia de mes»). Con `zoom` en el body, `getBoundingClientRect` mide en
   px de pantalla y `scrollTop` en px del body: sin convertir, el salto se quedaba corto un 8 % y el
   afinado convergía unos px por encima del día pedido, con el 1 del mes de después debajo. */
for (const textSize of [undefined, "small", "big"]) test(`Meses: tocar el mes anterior deja su último día bajo la cabecera, marcado y con su cifra${textSize ? ` (letra ${textSize})` : ""}`, async ({ page }) => {
  await abre(page, textSize ? { textSize } : {});
  await gastosPeriodo(page, "months");
  await bajaUnPoco(page);
  await expect(fila(page).locator(".gx-mes.on")).toHaveAttribute("data-ym", "2026-09");

  await fila(page).locator('.gx-mes[data-ym="2026-08"]').click();
  expect(await primerDiaVisible(page), "el 31 de agosto, no el 1 de septiembre").toBe("20260831");
  await expect(fila(page)).toHaveAttribute("aria-hidden", "false");
  await expect(fila(page).locator(".gx-mes.on")).toHaveAttribute("data-ym", "2026-08");
  await expect(gastosEstado(page)).toContainText("agosto · cerrado");

  // Lejos, y desde la mitad de un mes: igual.
  await gastosBajaAlDia(page, "2026-08-29");
  await fila(page).locator('.gx-mes[data-ym="2026-06"]').click();
  expect(await primerDiaVisible(page)).toBe("20260630");
  await expect(fila(page).locator(".gx-mes.on")).toHaveAttribute("data-ym", "2026-06");
  await expect(gastosEstado(page)).toContainText("junio · cerrado");

  // Y hacia arriba, al mes de antes.
  await fila(page).locator('.gx-mes[data-ym="2026-07"]').click();
  expect(await primerDiaVisible(page)).toBe("20260731");
  await expect(fila(page).locator(".gx-mes.on")).toHaveAttribute("data-ym", "2026-07");
});

for (const textSize of [undefined, "small"]) test(`Mi ciclo: tocar un ciclo pasado no vuelve arriba ni esconde la fila: su primer día, marcado${textSize ? ` (letra ${textSize})` : ""}`, async ({ page }) => {
  await abre(page, { budgetCycle: true, ...(textSize ? { textSize } : {}) });
  await expect(gastosRoot(page)).toHaveAttribute("data-periodo", "cycle");
  await bajaUnPoco(page);
  await expect(fila(page).locator(".gx-mes.on")).toHaveText("octubre");

  await fila(page).locator(".gx-mes", { hasText: "septiembre" }).click();
  // El ciclo del 24/8 al 23/9: su primer día en la lista es el 23 de septiembre.
  expect(await primerDiaVisible(page)).toBe("20260923");
  await expect(fila(page)).toHaveAttribute("aria-hidden", "false");
  await expect(fila(page).locator(".gx-mes.on")).toHaveText("septiembre");
  await expect(gastosEstado(page)).toHaveText("24 ago – 23 sep");

  await fila(page).locator(".gx-mes", { hasText: "agosto" }).click();
  expect(await primerDiaVisible(page)).toBe("20260823");
  await expect(fila(page)).toHaveAttribute("aria-hidden", "false");
  await expect(fila(page).locator(".gx-mes.on")).toHaveText("agosto");
  await expect(gastosEstado(page)).toHaveText("24 jul – 23 ago");
});
