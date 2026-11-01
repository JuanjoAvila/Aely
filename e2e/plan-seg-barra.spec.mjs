import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, installFixtureClock } from "./fixtures.mjs";

/* La primera deuda ya cabe con el título y los botones (Recibos / Deudas / Metas) en su sitio.
   Centrar la tarjeta igual subía el scroll y el título se iba por arriba (medido en Pixel 5:
   scrollTop 41, título a −15 px; la barra de botones seguía dentro, a +29). Con la barra de
   estado ese recorte cae encima de la cabecera. Si la tarjeta sigue entera sin mover nada,
   la cabecera no se toca. */
const YM = 2026 * 12 + 8;
const settings = { autoPrices: false, theme: "green", lang: "es", simpleMode: false, expenseBanks: ["trade_republic"] };
const debts = Array.from({ length: 7 }, (_, i) => ({ id: "d" + i, ent: "familia", name: "Deuda " + i, value: 900 + i, original: 1200,
  monthly: 100 + i, amort: 100, months: 12, day: 27 + (i % 3), asOf: YM - 1, account: "trade_republic" }));
const fixed = Array.from({ length: 6 }, (_, i) => ({ id: "f" + i, name: "Recibo " + i, amount: 20 + i, freq: "mes", day: 27 + (i % 3), account: "trade_republic" }));
const accounts = [{ id: "tr", ent: "trade_republic", name: "Efectivo", value: 5000, role: "diario", spendFrom: true }];

test("la primera deuda desde Recibos deja el título y los botones enteros", async ({ page }) => {
  await installFixtureClock(page);
  await page.route("**/*", (r) => new URL(r.request().url()).hostname === "127.0.0.1" ? r.continue() : r.abort());
  await seedLoggedInDashboard(page, { __seedOnce: true, bankTx: [], flows: [], oneoffs: [], settings, accounts, debts, fixed, expenses: [] });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  const due = page.locator('.page-live .v4-screen > [data-seg="recibos"]').getByTestId("plan-due");
  await due.getByRole("button", { name: /Ver los/ }).click();
  const fila = due.locator(".v4-charge").filter({ hasText: "Deuda 0" }).first();
  await fila.scrollIntoViewIfNeeded();
  await fila.click();
  await page.locator('.v4-sheet[data-sheet="deuda"] [data-act="ver-deuda"]').click();
  await expect(page.locator('.v4-seg-btn[data-seg="deudas"]')).toHaveAttribute("aria-selected", "true");
  await expect.poll(() => page.evaluate(() => {
    const pg = document.querySelector(".page-scroll-host");
    const title = pg.querySelector(".v4-title").getBoundingClientRect();
    const seg = pg.querySelector(".v4-seg").getBoundingClientRect();
    const card = document.querySelector('[data-debt-id="d0"]').getBoundingClientRect();
    const nav = document.querySelector(".botnav").getBoundingClientRect();
    const titleOk = title.top >= 20 && title.bottom > title.top;
    const segOk = seg.top >= title.bottom - 1 && seg.bottom <= nav.top;
    const cardOk = card.top >= 0 && card.bottom <= nav.top + 1;
    return titleOk && segOk && cardOk && pg.scrollTop === 0
      ? "ok"
      : "scroll " + pg.scrollTop + " título " + Math.round(title.top) + " barra " + Math.round(seg.top) + " tarjeta " + Math.round(card.top) + "–" + Math.round(card.bottom);
  }), { timeout: 4_000 }).toBe("ok");
});
