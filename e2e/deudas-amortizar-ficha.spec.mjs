import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, FIXTURE_NOW, installFixtureClock } from "./fixtures.mjs";

// Ronda 242 (decisión del dueño, 18/11/2026): «Amortizar ahora» deja la tarjeta de la lista y pasa a
// la ficha de la deuda. Mismo diálogo y misma operación; al aplicarse la ficha se cierra (su borrador
// llevaba el pendiente de antes) y con algo tecleado no se ofrece, para no tirar lo escrito.
test.beforeEach(async ({ page }) => { await installFixtureClock(page); });

const now=new Date(FIXTURE_NOW), mes=now.getUTCFullYear()*12+now.getUTCMonth();
const viva={id:"amf",name:"Préstamo sintético",value:1300,original:1300,monthly:100,amort:100,months:13,asOf:mes,day:1,apr:0,account:"sabadell"};
const pagada={id:"amz0",name:"Financiación sintética",value:0,original:400,monthly:100,account:"sabadell",settledAt:"2026-09-01T10:00:00Z"};

const ficha=(page)=>page.getByRole("dialog",{name:"Editar deuda",exact:true});
const pregunta=(page)=>page.getByRole("dialog").filter({has:page.locator(".ask-in")});
const saldo=(page,id)=>page.evaluate((id)=>{ const d=JSON.parse(localStorage.getItem("micartera_v3")).debts.find(x=>x.id===id);
  return Math.round(debtBalance(d)*100); },id);

async function abreDeudas(page){
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({timeout:15_000});
  await page.waitForFunction(()=>!document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  await page.locator(".v4-seg-btn").filter({hasText:/Deudas/}).click();
}
async function abreFicha(page,id){
  await page.locator(`[data-debt-id="${id}"]`).click(); // Plan A: fila -> ficha nueva -> Editar
  await page.locator('[data-act="ficha-editar"]').click();
  await expect(ficha(page)).toBeVisible();
}

test("la tarjeta ya no lleva Amortizar; la ficha sí, y amortizar baja el saldo y la cierra",async({page})=>{
  await seedLoggedInDashboard(page,{__seedOnce:true,debts:[viva],expenses:[]});
  await abreDeudas(page);
  await expect(page.locator("[data-debt-id]")).toHaveCount(1);
  await expect(page.locator("[data-debt-id]").getByRole("button",{name:/Amortizar/})).toHaveCount(0);
  await expect(page.locator("[data-debt-id] .v4-debt-amort")).toHaveCount(0);
  const antes=await saldo(page,"amf");

  await abreFicha(page,"amf");
  const boton=ficha(page).getByRole("button",{name:"Amortizar ahora"});
  await expect(boton).toBeVisible();
  await expect(boton).toBeEnabled();

  // Cancelar el diálogo no toca nada y deja la ficha abierta.
  await boton.click();
  await expect(pregunta(page)).toBeVisible();
  await pregunta(page).getByRole("button",{name:/Cancelar/}).click();
  await expect(pregunta(page)).toHaveCount(0);
  await expect(ficha(page)).toBeVisible();
  expect(await saldo(page,"amf")).toBe(antes);

  await boton.click();
  await pregunta(page).locator(".ask-in").fill("250");
  await expect(pregunta(page).locator("[data-ask-live]")).toHaveText(/Te quitas \d+ cuotas/);
  await pregunta(page).getByRole("button",{name:/Amortizar/}).click();
  await expect(ficha(page)).toHaveCount(0);
  await expect.poll(()=>saldo(page,"amf")).toBe(antes-25000);
  // La tarjeta pinta el saldo nuevo (con la cuota ya pasada este mes, por eso sale de `antes`).
  await page.locator('[data-debt-id="amf"]').click();
  await expect(page.getByTestId("ficha-saldo")).toHaveText(await page.evaluate((c)=>eur(c/100),antes-25000));
  await page.locator(".rpt-sx").click();
  // Amortizar no es un gasto: no aparece ningún movimiento.
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("micartera_v3_exp")||"[]"))).toHaveLength(0);
});

test("con algo tecleado en la ficha no se ofrece amortizar; deshacerlo lo devuelve",async({page})=>{
  await seedLoggedInDashboard(page,{__seedOnce:true,debts:[viva],expenses:[]});
  await abreDeudas(page);
  await abreFicha(page,"amf");
  const boton=ficha(page).getByRole("button",{name:"Amortizar ahora"});
  const nombre=ficha(page).locator('[data-debt-field="name"]');
  const porQue=ficha(page).getByTestId("debt-amortize-save-first");
  await expect(porQue).toHaveCount(0);
  await nombre.fill("Préstamo sintético 2");
  await expect(boton).toBeDisabled();
  // Apagado, dice por qué (filtro de diseño 242).
  await expect(porQue).toHaveText("Guarda antes los cambios.");
  await nombre.fill("Préstamo sintético");
  await expect(boton).toBeEnabled();
  await expect(porQue).toHaveCount(0);
});

test("el diálogo enseña el importe con formato, topado al pendiente",async({page})=>{
  await seedLoggedInDashboard(page,{__seedOnce:true,debts:[viva],expenses:[]});
  await abreDeudas(page);
  await abreFicha(page,"amf");
  const antes=await saldo(page,"amf");
  await ficha(page).getByRole("button",{name:"Amortizar ahora"}).click();
  const vivo=pregunta(page).locator("[data-ask-live]");
  await pregunta(page).locator(".ask-in").fill("250");
  await expect(vivo).toHaveText(/^📆 250,00 € · Te quitas \d+ cuotas\.$/);
  // Más que el pendiente: se ve lo que de verdad se amortiza, no lo tecleado.
  await pregunta(page).locator(".ask-in").fill("99999");
  await expect(vivo).toContainText(await page.evaluate((c)=>NF.format(c/100)+" €",antes));
});

/* Revisión de dinero 242, P3: si la deuda cambia con el diálogo abierto (otro móvil, un pull),
   `deudaAmortizada` no aplica nada. Antes salía «Amortizado» y la ficha se cerraba sin amortizar.
   El cambio se mete por el `set` real de la pantalla, como lo haría la sincronización. */
test("si la deuda cambió con el diálogo abierto, no amortiza, lo dice y la ficha sigue abierta",async({page})=>{
  await seedLoggedInDashboard(page,{__seedOnce:true,debts:[viva],expenses:[]});
  await abreDeudas(page);
  await abreFicha(page,"amf");
  const antes=await saldo(page,"amf");
  await ficha(page).getByRole("button",{name:"Amortizar ahora"}).click();
  await pregunta(page).locator(".ask-in").fill("250");
  await page.evaluate(()=>{
    const el=document.querySelector('[data-debt-id="amf"]'), k=Object.keys(el).find(x=>x.startsWith("__reactFiber"));
    let f=el[k]; while(f&&!(f.memoizedProps&&typeof f.memoizedProps.set==="function"&&f.memoizedProps.state)) f=f.return;
    f.memoizedProps.set(s=>Object.assign({},s,{debts:s.debts.map(d=>d.id==="amf"?Object.assign({},d,{value:+(d.value-100).toFixed(2)}):d)}));
  });
  await expect.poll(()=>saldo(page,"amf")).toBe(antes-10000);
  await pregunta(page).getByRole("button",{name:/Amortizar/}).click();
  await expect(page.getByText("La deuda ha cambiado. Vuelve a intentarlo.")).toBeVisible();
  // El aviso de hecho, no el «Amortizado N € (x %)» del pie de la tarjeta.
  await expect(page.getByText(/^✓ Amortizado/)).toHaveCount(0);
  await expect(ficha(page)).toBeVisible();
  expect(await saldo(page,"amf")).toBe(antes-10000);
});

test("una deuda pagada no ofrece amortizar en su ficha",async({page})=>{
  await seedLoggedInDashboard(page,{__seedOnce:true,debts:[viva,pagada],expenses:[]});
  await abreDeudas(page);
  await abreFicha(page,"amz0");
  await expect(ficha(page).getByRole("button",{name:/Amortizar/})).toHaveCount(0);
});
