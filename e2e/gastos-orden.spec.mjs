import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* El orden manual no suplanta una hora que el banco no dio: guarda solo una lista de ids por
   fecha. Esta prueba usa dos horas distintas para demostrar que el orden elegido gana dentro del
   d├¡a y que sobrevive a cerrar/abrir, sin modificar `date`. */
test("Gastos: se arrastran dentro del mismo d├¡a y el orden persiste", async ({ page }) => {
  const day=new Date().toISOString().slice(0,10);
  const expenses=[
    {id:"nuevo",date:day+"T18:00:00.000Z",amount:12,merchant:"Segundo",category:"super",source:"manual"},
    {id:"viejo",date:day+"T08:00:00.000Z",amount:7,merchant:"Primero",category:"bares",source:"manual"},
  ];
  await seedLoggedInDashboard(page,{expenses:expenses,__seedOnce:true});
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({timeout:15_000});
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await expect(page.locator('.botnav-tab.active[data-tour="gastos"]')).toBeVisible();
  // Con cabecera m├ís alta el track a veces se queda a medias: la lista queda en leftÔëê379
  // (casi fuera) y elementFromPoint no la ve. Esperar a que la p├ígina de Gastos entre de verdad.
  await expect.poll(async () => page.evaluate(() => {
    const s=document.querySelector(".v4-gastos-summary");
    return s?s.getBoundingClientRect().left:999;
  })).toBeLessThan(40);

  const rows=page.locator(".v4-gastos-list button.v4-mov");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("Segundo");
  await page.evaluate(function(){
    const list=document.querySelector(".v4-gastos-list");
    const pageEl=list&&list.closest(".page");
    if(pageEl) pageEl.scrollTop=pageEl.scrollHeight;
  });
  const cdp=await page.context().newCDPSession(page);
  const from=await rows.nth(1).locator(".v4-mov-drag").boundingBox();
  const to=await rows.nth(0).boundingBox();
  const x0=Math.round(from.x+from.width/2), y0=Math.round(from.y+from.height/2);
  const y1=Math.round(to.y+to.height/2);
  const hit=await page.evaluate(({x,y}) => {
    const el=document.elementFromPoint(x,y);
    const drag=el&&el.closest&&el.closest(".v4-mov-drag");
    return drag&&{cls:String(drag.className||"")};
  },{x:x0,y:y0});
  expect(hit&&hit.cls).toContain("v4-mov-drag");
  await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x:x0,y:y0}]});
  await expect(rows.nth(1)).toHaveClass(/dragging/);
  for(let i=1;i<=5;i++){
    await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{
      x:x0, y:Math.round(y0+(y1-y0)*i/5)
    }]});
  }
  await expect(rows.nth(0)).toHaveClass(/drag-over/);
  await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});

  await expect(rows.nth(0)).toContainText("Primero");
  await expect.poll(() => page.evaluate(() => {
    const s=JSON.parse(localStorage.getItem("micartera_v3")||"{}");
    return s.settings&&s.settings.expenseOrder;
  })).toEqual({[day]:["viejo","nuevo"]});

  await page.reload();
  await expect(page.locator(".botnav")).toBeVisible({timeout:15_000});
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await expect.poll(async () => page.evaluate(() => {
    const s=document.querySelector(".v4-gastos-summary");
    return s?s.getBoundingClientRect().left:999;
  })).toBeLessThan(40);
  await expect(page.locator(".v4-gastos-list button.v4-mov").nth(0)).toContainText("Primero");
  const dates=await page.evaluate(() => JSON.parse(localStorage.getItem("micartera_v3_exp")||"[]").map((e) => e.date));
  expect(dates.sort()).toEqual(expenses.map((e) => e.date).sort());
});
