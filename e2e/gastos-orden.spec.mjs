import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, FIXTURE_NOW, installFixtureClock } from "./fixtures.mjs";

test.beforeEach(async ({ page }) => { await installFixtureClock(page); });

/* El orden manual no suplanta una hora que el banco no dio: guarda solo una lista de ids por
   fecha. Esta prueba usa dos horas distintas para demostrar que el orden elegido gana dentro del
   día y que sobrevive a cerrar/abrir, sin modificar `date`. */
test("Gastos: se mantienen pulsados, se arrastran dentro del mismo día y el orden persiste", async ({ page }) => {
  const day=new Date(FIXTURE_NOW).toISOString().slice(0,10);
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
  // Con cabecera más alta el track a veces se queda a medias: la lista queda en left≈379
  // (casi fuera) y elementFromPoint no la ve. Esperar a que la página de Gastos entre de verdad.
  await expect.poll(async () => page.evaluate(() => {
    const s=document.querySelector(".gx-head");   // Gastos v5: la cabecera fija sustituye a la tarjeta resumen
    return s?s.getBoundingClientRect().left:999;
  })).toBeLessThan(40);

  const rows=page.locator(".v4-gastos-list button.v4-mov");
  await expect(rows).toHaveCount(2);
  // Los dos son del mismo día: hay con qué ordenar, así que los dos se pueden mantener pulsados
  // (DIS-14: un día con un solo movimiento no; eso lo prueba `gastos-fila`).
  await expect(page.locator(".v4-gastos-list button.v4-mov[data-reorden]")).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("Segundo");
  /* Las filas a media pantalla: ni bajo la barra de abajo ni bajo la cabecera fija de Gastos v5
     (al fondo del todo, con el hueco final de la lista, quedaban tapadas por la cabecera). */
  await page.evaluate(function(){
    const row=document.querySelector(".page-scroll-host .v4-gastos-list button.v4-mov");
    if(row) row.scrollIntoView({block:"center"});
  });
  const cdp=await page.context().newCDPSession(page);
  const from=await rows.nth(1).boundingBox();
  const to=await rows.nth(0).boundingBox();
  // En mitad de la fila, no en un borde: la fila ENTERA es lo que se mantiene pulsado.
  const x0=Math.round(from.x+from.width/2), y0=Math.round(from.y+from.height/2);
  // Un poco más allá del centro de la otra: el hueco se cambia cuando el centro de la que vuela lo cruza.
  const y1=Math.round(to.y+to.height/2)-14;
  await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x:x0,y:y0}]});
  // Antes de la espera no hay nada levantado: un toque normal no puede parecer un arrastre.
  await page.waitForTimeout(200);
  await expect(rows.nth(1)).not.toHaveClass(/gx-alza/);
  await expect(rows.nth(1)).toHaveClass(/gx-alza/);
  for(let i=1;i<=8;i++){
    await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{
      x:x0, y:Math.round(y0+(y1-y0)*i/8)
    }]});
    await page.waitForTimeout(16);
  }
  // La otra fila se aparta hacia abajo para dejar el hueco (muelle sobre `transform`, sin tocar el layout).
  await expect.poll(() => rows.nth(0).evaluate((b) => new DOMMatrix(getComputedStyle(b).transform).m42)).toBeGreaterThan(20);
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
    const s=document.querySelector(".gx-head");   // Gastos v5: la cabecera fija sustituye a la tarjeta resumen
    return s?s.getBoundingClientRect().left:999;
  })).toBeLessThan(40);
  await expect(page.locator(".v4-gastos-list button.v4-mov").nth(0)).toContainText("Primero");
  const dates=await page.evaluate(() => JSON.parse(localStorage.getItem("micartera_v3_exp")||"[]").map((e) => e.date));
  expect(dates.sort()).toEqual(expenses.map((e) => e.date).sort());
});
