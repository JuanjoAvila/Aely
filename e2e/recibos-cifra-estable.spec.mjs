/* «SE TE VAN CADA MES» CUADRA CON SUS GRUPOS Y NO SE MUEVE AL MIRAR UN RECIBO (beta 4.26.150).
 *
 * En el vídeo de la 4.26.150 la cabecera decía 1518,65, luego 1526,87, y sus grupos sumaban
 * 1526,45. Eran dos fallos:
 *   · la cabecera (`totals.fijosMensual`) sumaba `amount×FREQ_M` y no miraba el `schedule`, y un
 *     seguro de 172,05 + 166,94 marcado semestral contaba 28,68 en vez de 28,25 al mes;
 *   · la cuenta animada empezaba en 0 y quien tocaba un grupo antes de los 950 ms veía una cifra a
 *     medias (`cifra-sin-cero.spec.mjs` vigila eso en Inicio y Cartera).
 * La ficha del IBI, abierta y cerrada sin tocar nada, no escribe ningún recibo ni ninguna cuota.
 * La cifra se comprueba por dos vías: la suma de los grupos y la cuenta hecha a mano aquí. */
import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, installFixtureClock } from "./fixtures.mjs";

test.beforeEach(async ({ page }) => { await installFixtureClock(page); });

const accounts = [{ id: "sab", ent: "sabadell", name: "Nómina y recibos", value: 2000, role: "fijos" }];
const fixed = [
  { id: "luz", name: "Luz", amount: 50, freq: "mes", account: "sabadell", day: 5 },
  { id: "net", name: "Internet", amount: 40, freq: "mes", account: "sabadell", day: 8 },
  { id: "ibi", name: "IBI", amount: 666.36, freq: "año", months: [10], account: "sabadell" },
  { id: "seg", name: "Seguro hogar", amount: 172.05, freq: "semestral", account: "sabadell",
    schedule: [{ m: 3, amt: 172.05 }, { m: 9, amt: 166.94 }] },
];
const debts = [{ id: "coche", name: "Préstamo coche", monthly: 100, value: 2400, anchor: 2400, account: "sabadell", day: 10 }];
// A mano: los no mensuales repartidos entre 12, cada cobro con su importe.
const A_MANO = 50 + 40 + 666.36 / 12 + (172.05 + 166.94) / 12 + 100;   // 273,78

const hub = (page) => page.locator("[data-bills-manage]");
const ficha = (page) => page.locator('.v4-sheet[data-sheet="bill"]');
const num = (s) => Number(String(s).replace(/[^\d,]/g, "").replace(",", "."));
const cifra = async (page) => num(await hub(page).locator(".v4-bills-hero-amt").innerText());
const grupo = async (page, id) => num(await hub(page).locator(`.v4-bills-group[data-group="${id}"] .v4-bills-group-amt`).innerText());

test("la cabecera cuadra con sus grupos y con la cuenta a mano, antes y después de mirar el IBI", async ({ page }) => {
  await seedLoggedInDashboard(page, { accounts, fixed, debts, flows: [], oneoffs: [], budget: 1000 });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  const nombre = await page.evaluate(() => t("v4_gestionar"));
  await page.locator('.v4-screen > [data-seg="recibos"]').getByRole("button", { name: nombre, exact: true }).click();
  await expect(hub(page)).toBeVisible();

  // Desde el primer momento, sin esperar a ninguna animación.
  const antes = await cifra(page);
  const sumaGrupos = (await grupo(page, "serv")) + (await grupo(page, "debt"));
  expect(sumaGrupos).toBeCloseTo(A_MANO, 2);
  expect(antes).toBeCloseTo(A_MANO, 2);

  const guardado = () => page.evaluate(() => { const s = JSON.parse(localStorage.getItem("micartera_v3")); return JSON.stringify([s.fixed, s.debts]); });
  const datosAntes = await guardado();
  await hub(page).locator('.v4-bills-group[data-group="serv"]').click();
  await hub(page).locator(".v4-bills-row").filter({ hasText: "IBI" }).click();
  await expect(ficha(page)).toBeVisible();
  await ficha(page).locator(".settings-push-h .back").evaluate((el) => el.click());
  await expect(ficha(page)).toHaveCount(0, { timeout: 3000 });
  await hub(page).locator(".settings-push-h .back").last().evaluate((el) => el.click());
  await expect(hub(page).locator('.settings-push [data-screen="bills-group"]')).toHaveCount(0, { timeout: 3000 });

  expect(await cifra(page)).toBeCloseTo(antes, 2);
  expect(await guardado()).toBe(datosAntes);
});
