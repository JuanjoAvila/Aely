import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* El orden manual no suplanta una hora que el banco no dio: guarda solo una lista de ids por
   fecha. Esta prueba usa dos horas distintas para demostrar que el orden elegido gana dentro del
   día y que sobrevive a cerrar/abrir, sin modificar `date`. */
test("Gastos: se arrastran dentro del mismo día y el orden persiste", async ({ page }) => {
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

  const rows=page.locator("button.v4-mov");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("Segundo");
  await rows.nth(1).scrollIntoViewIfNeeded();
  const cdp=await page.context().newCDPSession(page);
  const from=await rows.nth(1).locator(".v4-mov-drag").boundingBox();
  const to=await rows.nth(0).boundingBox();
  const hit=await page.evaluate(({x,y}) => {
    const el=document.elementFromPoint(x,y);
    return el&&{tag:el.tagName,cls:el.className,text:el.textContent};
  },{x:from.x+from.width/2,y:from.y+from.height/2});
  expect(hit&&hit.cls).toContain("v4-mov-drag");
  await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x:from.x+from.width/2,y:from.y+from.height/2}]});
  await expect(rows.nth(1)).toHaveClass(/dragging/);
  for(let i=1;i<=5;i++){
    await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{
      x:from.x+from.width/2,
      y:from.y+from.height/2+(to.y+to.height/2-from.y-from.height/2)*i/5
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
  await expect(page.locator("button.v4-mov").nth(0)).toContainText("Primero");
  const dates=await page.evaluate(() => JSON.parse(localStorage.getItem("micartera_v3_exp")||"[]").map((e) => e.date));
  expect(dates.sort()).toEqual(expenses.map((e) => e.date).sort());
});
