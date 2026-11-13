import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

// Auditoría del 9/11/2026, P1-11: la luz de 54,26 € llega como «IBERDROLA CLIENTES SAU / RECIBO LUZ»
// por 54,71 € el mismo día. No se paga sola: sale en «Para revisar» como «cobró distinto» y él dice
// «Sí, es este» o «No es este recibo», los dos con Deshacer. Datos inventados.
async function abreRecibos(page) {
  await page.clock.install({ time: new Date("2026-09-09T12:00:00+02:00") });
  await page.route("**/*", r => new URL(r.request().url()).hostname === "127.0.0.1" ? r.continue() : r.abort());
  await seedLoggedInDashboard(page, { __seedOnce:true, lastBackup:"2026-09-09",
    fixed:[{id:"luz",name:"Luz",amount:54.26,freq:"mes",day:8,account:"sabadell",category:"luz"}],
    accounts:[{id:"bank",ent:"sabadell",role:"fijos",value:3000}],
    bankTx:[{id:"ref-luz",ent:"sabadell",date:"2026-09-08",amount:54.71,merchant:"IBERDROLA CLIENTES SAU",concept:"RECIBO LUZ",status:"BOOK"}],
    expenses:[{id:"x-luz",extId:"ref-luz",ent:"sabadell",date:"2026-09-08T12:00:00.000Z",amount:54.71,merchant:"IBERDROLA CLIENTES SAU",obName:"IBERDROLA CLIENTES SAU",source:"ob",status:"BOOK",category:"otros"}],
    debts:[], flows:[], oneoffs:[],
    settings:{autoPrices:false,theme:"green",lang:"es",simpleMode:false,expenseBanks:["sabadell"]} });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({timeout:15000});
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  return page.locator('.page-live .v4-screen > [data-seg="recibos"]');
}

test("cobró distinto: se pregunta en «Para revisar» y «Sí, es este» lo pasa a Ya pagados (con Deshacer)", async ({page}) => {
  const recibos=await abreRecibos(page);
  const fila=recibos.getByTestId("plan-review").locator('[data-recibo="fixed_luz"]');
  await expect(fila).toHaveAttribute("data-review","cand");
  await expect(fila).toContainText("Esperabas 54,26 €");
  await expect(fila).toContainText("54,71 €");
  await expect(recibos.getByTestId("plan-due").locator('[data-recibo="fixed_luz"]')).toHaveCount(0);
  // Hasta que lo confirme sigue en lo que queda por pagar.
  await expect(recibos.getByTestId("plan-summary").locator(".serif.num")).toHaveText("54,26 €");
  await fila.click();
  const ficha=page.locator('[data-sheet="recibo"]');
  await expect(ficha.getByTestId("recibo-nota")).toHaveText("Cobró 54,71 € · esperabas 54,26 €");
  await expect(ficha.getByTestId("recibo-cargo-cand")).toContainText("IBERDROLA CLIENTES SAU");
  await expect(ficha.locator('[data-act="pagado"]')).toHaveCount(0);
  await ficha.locator('[data-act="es-este"]').click();
  const deshacer=page.getByTestId("plan-deshacer");
  await expect(deshacer).toContainText("Luz pasa a Ya pagados");
  await expect(recibos.getByTestId("plan-review")).toHaveCount(0);
  await expect(recibos.getByTestId("plan-paid").locator('[data-recibo="fixed_luz"]')).toHaveCount(1);
  await expect(recibos.getByTestId("plan-summary").locator(".serif.num")).toHaveText("0,00 €");
  await deshacer.locator("button").click();
  await expect(recibos.getByTestId("plan-review").locator('[data-recibo="fixed_luz"]')).toHaveAttribute("data-review","cand");
});

test("cobró distinto: «No es este recibo» lo deja en Por pagar y Deshacer lo vuelve a preguntar", async ({page}) => {
  const recibos=await abreRecibos(page);
  await recibos.getByTestId("plan-review").locator('[data-recibo="fixed_luz"]').click();
  await page.locator('[data-sheet="recibo"] [data-act="no-es-cargo"]').click();
  const deshacer=page.getByTestId("plan-deshacer");
  await expect(deshacer).toContainText("Luz vuelve a Por pagar");
  await expect(recibos.getByTestId("plan-review")).toHaveCount(0);
  await expect(recibos.getByTestId("plan-due").locator('[data-recibo="fixed_luz"]')).toHaveCount(1);
  await deshacer.locator("button").click();
  await expect(recibos.getByTestId("plan-review").locator('[data-recibo="fixed_luz"]')).toHaveAttribute("data-review","cand");
});
