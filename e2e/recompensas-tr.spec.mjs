import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, esperaNubeQuieta } from "./fixtures.mjs";

/* ROUND UP Y SAVEBACK QUE AVISA TRADE REPUBLIC (16/11/2026). El aviso llega a la tabla por `ingest`
   y la app lo baja como cualquier gasto. Aquí se mira lo que él ve: el ajuste de destino (una fila
   por tipo, con el logo de cada posición) y que la posición sube UNA vez aunque la app vuelva a
   leer la nube. Nombres y cifras inventados. */
const investments = [
  { id: "f1", ent: "trade_republic", name: "Fondo Mundo Uno", shares: 10, value: 1000, cost: 900, cur: "EUR" },
  { id: "f2", ent: "trade_republic", name: "Fondo Mundo Dos", shares: 5, value: 500, cost: 450, cur: "EUR" },
];
const aviso = {
  id: "550e8400-e29b-41d4-a716-446655449001", user_id: "e2e-user", fecha: new Date().toISOString(),
  importe: 12.96, comercio: "Round up", ob_name: "Round up", cat: "inversion", source: "macrodroid", no_card: true,
};

test("Round up de TR: elige destino por tipo y la posición sube una sola vez", async ({ page }) => {
  await seedLoggedInDashboard(page, {
    investments,
    accounts: [{ id: "daily", ent: "trade_republic", name: "Trade Republic", value: 1000, spendFrom: true, rewardInv: "f1", savebackInv: "" }],
    __cloudRows: { expenses: [aviso] },
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);

  await page.locator('.botnav-tab[data-tour="cartera"]').click();
  const listaInv = page.locator(".v4-card-list").filter({ hasText: /posici|position/ }).first();
  await listaInv.locator("button.v4-mov").filter({ hasText: "Trade Republic" }).click();
  const pos = listaInv.locator('[data-inv-position="f1"]');
  await expect(pos).toContainText(/1[.,]?012[.,]96/);
  await expect(listaInv.locator('[data-inv-position="f2"]')).toContainText(/500/);

  // Volver a primer plano relee la nube: el mismo aviso no suma otra vez.
  await page.evaluate(() => { document.dispatchEvent(new Event("visibilitychange")); window.dispatchEvent(new Event("focus")); });
  await page.waitForTimeout(800);
  await expect(pos).toContainText(/1[.,]?012[.,]96/);
  await expect(pos).not.toContainText(/1[.,]?025[.,]92/);

  // El ajuste: Round up → Fondo Mundo Uno; Saveback → ninguna. Tocar otra la elige.
  const panel = page.locator(".card").filter({ hasText: /Round-up & Saveback/ }).first();
  await panel.locator(".card-head").click();
  const ru = panel.locator('[data-rw="roundup"]'), sb = panel.locator('[data-rw="saveback"]');
  await expect(ru.locator('button[aria-pressed="true"]')).toHaveCount(1);
  await expect(ru.locator('button[aria-pressed="true"]')).toContainText("Fondo Mundo Uno");
  await expect(ru.locator(".mono, .mono-logo").first()).toBeVisible();
  await expect(sb.locator('button[aria-pressed="true"]')).toHaveCount(0);
  await sb.locator("button").filter({ hasText: "Fondo Mundo Dos" }).click();
  await expect(sb.locator('button[aria-pressed="true"]')).toContainText("Fondo Mundo Dos");
  // Elegir el destino del Saveback no mueve el Round up ya sumado ni toca la otra posición.
  await expect(listaInv.locator('[data-inv-position="f2"]')).not.toContainText(/512[.,]96/);
  await expect(pos).toContainText(/1[.,]?012[.,]96/);
});

/* Revisión de dinero 236, P1-A: el aviso no se aplica sobre una cartera vieja. La app lleva rato abierta;
   mientras, desde otro móvil se edita Fondo Mundo Dos (777 €) y TR avisa de un Round up. Al volver a
   primer plano solo se bajan los gastos: si el aviso se aplicara ya, la copia local pasaría a ser «la más
   nueva» y se comería lo editado en el otro móvil. Tiene que bajar antes el estado. */
test("Round up de TR: se aplica tras bajar la nube, sin pisar lo editado en otro móvil", async ({ page }) => {
  await seedLoggedInDashboard(page, {
    investments,
    accounts: [{ id: "daily", ent: "trade_republic", name: "Trade Republic", value: 1000, spendFrom: true, rewardInv: "f1", savebackInv: "" }],
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await esperaNubeQuieta(page);
  // Otro móvil: edita la cartera en la nube. Y llega el aviso a la tabla.
  await page.evaluate((aviso) => {
    const rows = window.__e2eCloudRows;
    const row = rows.app_state[0];
    const data = JSON.parse(JSON.stringify(row.data));
    data.investments = data.investments.map((i) => i.id === "f2" ? Object.assign({}, i, { value: 777 }) : i);
    data._savedAt = Date.now() + 1000;
    row.data = data; row.updated_at = new Date(Date.now() + 1000).toISOString();
    (rows.expenses || (rows.expenses = [])).push(aviso);
  }, aviso);
  await page.evaluate(() => { document.dispatchEvent(new Event("visibilitychange")); });
  await page.locator('.botnav-tab[data-tour="cartera"]').click();
  const listaInv = page.locator(".v4-card-list").filter({ hasText: /posici|position/ }).first();
  await listaInv.locator("button.v4-mov").filter({ hasText: "Trade Republic" }).click();
  await expect(listaInv.locator('[data-inv-position="f1"]')).toContainText(/1[.,]?012[.,]96/, { timeout: 10_000 });
  await expect(listaInv.locator('[data-inv-position="f2"]')).toContainText(/777/, { timeout: 10_000 });
  await esperaNubeQuieta(page);
  // Y lo que queda en la nube lleva las dos cosas.
  const nube = await page.evaluate(() => window.__e2eCloudRows.app_state[0].data.investments.map((i) => [i.id, i.value]));
  expect(nube).toEqual([["f1", 1012.96], ["f2", 777]]);
});
