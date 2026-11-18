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
const tarjetaRu = (page) => page.locator(".card").filter({ hasText: /Round up y Saveback|Round up and Saveback|Round up i Saveback/ }).first();
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

  // El ajuste: Round up → Fondo Mundo Uno; Saveback → ninguna. Tocar otra la elige. La tarjeta se llama
  // «Round up y Saveback» desde el filtro de diseño 237 (un solo término, como TR).
  const panel = tarjetaRu(page);
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

/* Filtro de diseño 237, F3: el selector ofrecía también un fondo de MyInvestor, escondido al final de una
   fila con scroll, y la cabecera decía «desactivado» con un destino elegido. TR solo invierte en su casa:
   aquí solo salen sus posiciones, en una lista a todo el ancho que no se sale a 360, con ✓ en la elegida,
   y la cabecera dice adónde va. */
test("Round up de TR: el destino solo ofrece posiciones de TR, a todo el ancho, y la cabecera dice adónde va", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await seedLoggedInDashboard(page, {
    investments: investments.concat([{ id: "m1", ent: "myinvestor", name: "Fondo Indexado de Otro Bróker", shares: 3, value: 300, cost: 280, cur: "EUR" }]),
    accounts: [{ id: "daily", ent: "trade_republic", name: "Trade Republic", value: 1000, spendFrom: true, roundup: 0, saveback: false, rewardInv: "f1", savebackInv: "" }],
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="cartera"]').click();
  const panel = tarjetaRu(page);
  await expect(panel).toContainText("Round up → Fondo Mundo Uno");
  await expect(panel).not.toContainText("desactivado");
  await panel.locator(".card-head").click();
  for (const k of ["roundup", "saveback"]) {
    const g = panel.locator(`[data-rw="${k}"] .rw-opt`);
    await expect(g).toHaveText([/Fondo Mundo Uno/, /Fondo Mundo Dos/]);
    await expect(g.filter({ hasText: "Otro Bróker" })).toHaveCount(0);
  }
  await expect(panel.locator('[data-rw="roundup"] .rw-opt.on .rw-opt-ck')).toHaveText("✓");
  // Nada fuera de la tarjeta ni recortado: ni scroll de lado ni elipsis.
  const fuera = await panel.evaluate((card) => {
    const cb = card.getBoundingClientRect();
    return [...card.querySelectorAll(".rw-opt, .rw-opt-nm, .ru-mult")].filter((e) => {
      const b = e.getBoundingClientRect();
      return b.right > cb.right + 1 || e.scrollWidth > e.clientWidth + 1 || getComputedStyle(e).textOverflow === "ellipsis";
    }).map((e) => e.className + ": " + e.textContent);
  });
  expect(fuera).toEqual([]);
  // El multiplicador a todo el ancho de la tarjeta, como lo demás.
  const [mult, opt] = await Promise.all([panel.locator(".ru-mult").boundingBox(), panel.locator(".rw-opt").first().boundingBox()]);
  expect(Math.abs(mult.width - opt.width)).toBeLessThanOrEqual(2);
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

/* CI de beta 240 (18/11/2026): el libro de avisos (`trRecompensas`) no viaja solo. Este móvil ya sumó el
   Round up a Fondo Mundo Uno y lo apuntó en su libro; la nube trae un estado MÁS NUEVO de otro móvil que no
   lo había sumado y que no tiene libro (un móvil que nunca vio un aviso no escribe la clave). Gana la nube
   con sus posiciones, y el libro local se quedaba encima: el aviso constaba como sumado sin estarlo y no se
   aplicaba nunca más, 12,96 € fuera de la cartera. El libro va con las inversiones que ganan. Sin carreras:
   el estado viejo y el nuevo están sembrados, así que falla siempre sin el arreglo, no solo en una CI lenta. */
test("Round up de TR: si gana una nube sin libro, el aviso se vuelve a sumar sobre sus posiciones", async ({ page }) => {
  const ms = Date.parse(aviso.fecha);
  const fila = { id: aviso.id, date: aviso.fecha, merchant: "Round up", amount: 12.96, category: "inversion", source: "macrodroid", ent: "trade_republic", noCard: true, obName: "Round up" };
  const cuenta = { id: "daily", ent: "trade_republic", name: "Trade Republic", value: 1000, spendFrom: true, rewardInv: "f1", savebackInv: "" };
  const nube = {
    budget: 500, monthStartNet: 1000, history: [], accounts: [cuenta],
    investments: [investments[0], Object.assign({}, investments[1], { value: 777 })],
    assets: [], debts: [], fixed: [], flows: [], oneoffs: [], aportaciones: [], expenses: [], goals: [], shared: [],
    settings: { autoPrices: false, theme: "green" }, onboarded: true, _dataVer: 6, _savedAt: Date.now(),
  };
  await seedLoggedInDashboard(page, {
    // Lo de este móvil, más viejo: el aviso ya sumado y apuntado en su libro.
    investments: [Object.assign({}, investments[0], { value: 1012.96, cost: 912.96, shares: 10.1296 }), investments[1]],
    accounts: [Object.assign({}, cuenta, { trAvisosDesde: { roundup: ms } })],
    expenses: [fila],
    trRecompensas: { [aviso.id]: { k: "roundup", d: ms, eur: 12.96, inv: "f1", sh: 0.1296, c: 12.96, x: fila } },
    _savedAt: Date.now() - 60_000,
    __cloudRows: {
      app_state: [{ user_id: "e2e-user", data: nube, updated_at: new Date().toISOString() }],
      expenses: [aviso],
    },
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="cartera"]').click();
  const listaInv = page.locator(".v4-card-list").filter({ hasText: /posici|position/ }).first();
  await listaInv.locator("button.v4-mov").filter({ hasText: "Trade Republic" }).click();
  await expect(listaInv.locator('[data-inv-position="f2"]')).toContainText(/777/, { timeout: 10_000 });
  await expect(listaInv.locator('[data-inv-position="f1"]')).toContainText(/1[.,]?012[.,]96/, { timeout: 10_000 });
  await esperaNubeQuieta(page);
  const subido = await page.evaluate(() => {
    const d = window.__e2eCloudRows.app_state[0].data;
    return { inv: d.investments.map((i) => [i.id, i.value]), libro: Object.keys(d.trRecompensas || {}) };
  });
  expect(subido).toEqual({ inv: [["f1", 1012.96], ["f2", 777]], libro: [aviso.id] });
});
