import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* LONG-PRESS PARA ORDENAR CUENTAS (12/9).
 *
 * Él: *«el mantener pulsado los bancos no los mueve»* y *«que se eleve con un efecto chulo de
 * movimiento que se note smooth»*. No era un bug: estaba sin implementar. Blindamos el gesto
 * (mantener → clase dragging/elevación → arrastrar → el array `accounts` cambia y persiste).
 */

const accounts = [
  { id: "a", ent: "sabadell", name: "Nómina", value: 500, role: "fijos" },
  { id: "b", ent: "revolut", name: "Del día", value: 80, role: "diario", spendFrom: true },
  { id: "c", ent: "efectivo", name: "El sobre", value: 40, role: "fijos" },
];

test.use({ viewport: { width: 375, height: 812 } });

async function abrirCartera(page) {
  await seedLoggedInDashboard(page, {
    accounts,
    settings: { autoPrices: false, theme: "green", expenseBanks: ["revolut"] },
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="cartera"]').click();
  await expect(page.locator(".v4-card-list button.v4-mov[data-account-id]").first()).toBeVisible();
  /* El track a veces se queda a medias: elementFromPoint / CDP no ven la lista. */
  await expect.poll(async () => page.evaluate(() => {
    const el = document.querySelector(".v4-card-list button.v4-mov[data-account-id]");
    return el ? el.getBoundingClientRect().left : 999;
  })).toBeLessThan(40);
}

test("sin cuentas OB pendientes, Cartera no enseña el botón Editar", async ({ page }) => {
  await abrirCartera(page);
  await expect(page.locator(".v4-card-list button.edit-link")).toHaveCount(0);
});

test("mantener pulsado una cuenta la eleva y al soltar sobre otra cambia el orden", async ({ page }) => {
  await abrirCartera(page);
  const rows = page.locator(".v4-card-list button.v4-mov[data-account-id]");
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText(/Sabadell/);
  await expect(rows.nth(1)).toContainText(/Revolut/);

  const from = await rows.nth(0).boundingBox();
  const to = await rows.nth(1).boundingBox();
  const x0 = Math.round(from.x + from.width / 2);
  const y0 = Math.round(from.y + from.height / 2);
  const y1 = Math.round(to.y + to.height / 2);

  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y: y0 }] });
  /* HOLD de la app = 380 ms; un poco más para no flaquear en CI. */
  await page.waitForTimeout(480);
  await expect(rows.nth(0)).toHaveClass(/dragging/);

  for (let i = 1; i <= 6; i++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x0, y: Math.round(y0 + (y1 - y0) * i / 6) }],
    });
  }
  await expect(rows.nth(1)).toHaveClass(/drag-over/);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });

  await expect(rows.nth(0)).toContainText(/Revolut/);
  await expect(rows.nth(1)).toContainText(/Sabadell/);
  await expect.poll(() => page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("micartera_v3") || "{}");
    return (s.accounts || []).map((a) => a.id);
  })).toEqual(["b", "a", "c"]);

  /* Un toque corto sigue abriendo la ficha (el long-press no la deja «rota»). */
  await page.waitForTimeout(500);
  await rows.nth(0).click();
  await expect(page.locator(".v4-sheet")).toBeVisible();
});

test("una CaixaBank recién conectada se mueve con las demás sin cambiar rol ni saldo", async ({ page }) => {
  await seedLoggedInDashboard(page, {
    accounts,
    obAccounts: [{ key: "caixa-1", ent: "caixabank", aspsp: "CaixaBank", iban: "ES001", name: "Corriente", value: 321.45, cur: "EUR" }],
    settings: { autoPrices: false, theme: "green", expenseBanks: ["revolut"] },
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="cartera"]').click();

  const caixa=page.locator('button.v4-mov[data-ob-key="caixa-1"]');
  const rows=page.locator(".v4-card-list button.v4-mov[data-account-key]");
  await expect(caixa).toBeVisible();
  /* Caixa queda debajo de las tres cuentas sembradas. La llevamos sobre la inmediatamente anterior:
     así los dos centros están dentro del viewport y el CDP prueba el gesto, no un punto fuera. */
  await caixa.scrollIntoViewIfNeeded();
  const from=await caixa.boundingBox(), to=await rows.nth(2).boundingBox();
  const x=Math.round(from.x+from.width/2), y0=Math.round(from.y+from.height/2), y1=Math.round(to.y+to.height/2);
  const cdp=await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x,y:y0}]});
  await page.waitForTimeout(480);
  await expect(caixa).toHaveClass(/dragging/);
  for(let i=1;i<=6;i++) await cdp.send("Input.dispatchTouchEvent",{
    type:"touchMove",touchPoints:[{x,y:Math.round(y0+(y1-y0)*i/6)}]
  });
  await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});

  await expect(rows.nth(2)).toHaveAttribute("data-ob-key","caixa-1");
  await expect.poll(() => page.evaluate(() => {
    const s=JSON.parse(localStorage.getItem("micartera_v3")||"{}");
    return {
      order:s.settings&&s.settings.accountListOrder,
      accounts:(s.accounts||[]).map((a)=>[a.id,a.value,a.role]),
      ob:(s.obAccounts||[]).map((o)=>[o.key,o.value]),
      expenseBanks:s.settings&&s.settings.expenseBanks,
    };
  })).toEqual({
    order:["acc:a","acc:b","ob:caixa-1","acc:c"],
    accounts:[["a",500,"fijos"],["b",80,"diario"],["c",40,"fijos"]],
    ob:[["caixa-1",321.45]], expenseBanks:["revolut"],
  });
});
