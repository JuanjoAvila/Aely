import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* Un recibo compartido enseña TU PARTE en la lista de «Tus recibos» y arriba de «Editar el recibo»
   (feedback 2026-11-28: un 20,99 € a cuatro salía a 20,99 en la fila y en la cabecera, con «Tu parte
   5,27 €» justo debajo). Forma de datos real: `amount` = tu parte, `bankAmount` = lo que cobra el banco,
   y el mes en curso, pagado entero ANTES de compartirlo, congelado en `soloMes` a 20,99 sin reparto.
   Nombres y cifras inventados. */
const CUR = 2026 * 12 + 11;
const cuenta = [{ id: "bank", ent: "caixabank", role: "fijos", value: 3000 }];
const musica = {
  id: "musica", name: "Musica", account: "caixabank", day: 16, amount: 5.27, bankAmount: 20.99, freq: "mes",
  reparto: [{ id: "p1", n: "Ana", via: "bizum", amt: 5.24 }, { id: "p2", n: "Luis", via: "bizum", amt: 5.24 },
    { id: "p3", n: "Pau", via: "transfer", amt: 5.24 }],
};
const congelado = Object.assign({}, musica, { paidYm: CUR, paidDay: 16, soloMes: { [CUR]: { amt: 20.99 } } });

async function abreTodos(page, lang, fixed) {
  test.info().annotations.push({ type: "own-clock" });
  await page.clock.install({ time: new Date("2026-11-20T12:00:00+01:00") });
  await page.route("**/*", (r) => new URL(r.request().url()).hostname === "127.0.0.1" ? r.continue() : r.abort());
  await seedLoggedInDashboard(page, { __seedOnce: true, lastBackup: "2026-11-20", bankTx: [], debts: [], flows: [], oneoffs: [],
    expenses: [], accounts: cuenta, fixed: [fixed],
    settings: { autoPrices: false, theme: "green", lang, simpleMode: false, expenseBanks: ["caixabank"] } });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  const recibos = page.locator('.page-live .v4-screen > [data-seg="recibos"]');
  await recibos.getByTestId("plan-due").getByRole("button", { name: /^(Gestionar|Todos|Gestiona|Tots)\b/ }).click();
  await expect(page.locator("[data-bills-manage]")).toBeVisible();
  return page.locator('[data-bill-id="musica"]');
}

for (const lang of ["es", "ca"]) {
  for (const [caso, fixed] of [["recién compartido", musica], ["mes pagado entero antes de compartir", congelado]]) {
    test(`${lang} · ${caso}: la fila y la cabecera del editor dicen tu parte`, async ({ page }) => {
      const fila = await abreTodos(page, lang, fixed);
      await expect(fila).toContainText("5,27 €");
      await expect(fila).not.toContainText("20,99");
      await fila.click();
      const hoja = page.locator('.v4-sheet[data-sheet="recibo-pasos"]');
      await expect(hoja).toHaveAttribute("data-modo", "edit");
      const paso4 = hoja.locator('[data-rp4-paso="4"]');
      await expect(paso4.locator('[data-rp4="sum-amt"]')).toHaveText("5,27 €");
      // El importe que se teclea sigue siendo lo que cobra el banco, y tu parte, debajo.
      await expect(paso4.locator('[data-rp4-fila="1"]')).toContainText("20,99 €");
      await expect(paso4.getByTestId("rp5-tu-parte")).toContainText("5,27 €");
    });
  }
}
