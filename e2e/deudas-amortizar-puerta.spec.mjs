import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, FIXTURE_NOW, installFixtureClock } from "./fixtures.mjs";

// DIS-26 (15/11/2026): el simulador «¿Cuándo amortizar?» solo informa; la única puerta para
// amortizar es «Amortizar ahora» de cada deuda (en su ficha desde la 242), y su diálogo cuenta las cuotas que quita.
test.beforeEach(async ({ page }) => { await installFixtureClock(page); });

const now=new Date(FIXTURE_NOW);
const debt={id:"amz",name:"Préstamo sintético",value:1300,original:1300,monthly:100,amort:100,months:13,
  asOf:now.getUTCFullYear()*12+now.getUTCMonth(),day:1,apr:0,account:"sabadell"};

async function openDebts(page){
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({timeout:15_000});
  await page.waitForFunction(()=>!document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  await page.locator(".v4-seg-btn").filter({hasText:/Deudas/}).click();
}

test("el simulador ya no amortiza y «Amortizar ahora» sí, contando las cuotas que quita",async({page})=>{
  await seedLoggedInDashboard(page,{__seedOnce:true,debts:[debt],expenses:[]});
  await openDebts(page);

  // Simulador abierto con su importe por defecto: informa, pero no hay botón de aplicar.
  const tip=page.locator(".v4-tip");
  await tip.getByText("¿Cuándo amortizar?").click();
  await expect(tip).toContainText("Te quitas");
  await expect(tip.locator(".btn-primary")).toHaveCount(0);
  await expect(tip.getByRole("button",{name:/Amortizar/})).toHaveCount(0);

  const before=await page.evaluate(()=>{ const d=JSON.parse(localStorage.getItem("micartera_v3")).debts[0];
    return {bal:Math.round(debtBalance(d)*100),left:debtLeft(d)}; });

  // La puerta está en la ficha de la deuda (ronda 242), no en la tarjeta.
  await expect(page.locator('[data-debt-id="amz"]').getByRole("button",{name:/Amortizar/})).toHaveCount(0);
  await page.locator('[data-debt-id="amz"]').getByRole("button",{name:/^Editar /}).click();
  await page.getByRole("dialog",{name:"Editar deuda",exact:true}).getByRole("button",{name:/Amortizar ahora/}).click();
  const dlg=page.getByRole("dialog").filter({has:page.locator(".ask-in")});
  // Sin importe no se sabe cuántas cuotas quita: no se pinta nada.
  await expect(dlg.locator("[data-ask-live]")).toHaveCount(0);
  await dlg.locator(".ask-in").fill("500");
  const live=dlg.locator("[data-ask-live]");
  await expect(live).toHaveText(/^📆 Te quitas \d+ cuotas\.$/);
  const shown=Number((await live.textContent()).match(/\d+/)[0]);
  await dlg.getByRole("button",{name:/Amortizar/}).click();

  // Comprobación por la otra vía: lo que dijo el diálogo es lo que de verdad baja el plazo.
  await expect.poll(()=>page.evaluate(()=>Math.round(debtBalance(JSON.parse(localStorage.getItem("micartera_v3")).debts[0])*100)))
    .toBe(before.bal-50000);
  const left=await page.evaluate(()=>debtLeft(JSON.parse(localStorage.getItem("micartera_v3")).debts[0]));
  expect(shown).toBe(5);
  expect(before.left-left).toBe(shown);
  const expenses=await page.evaluate(()=>JSON.parse(localStorage.getItem("micartera_v3_exp")||"[]"));
  expect(expenses).toHaveLength(0);
});
