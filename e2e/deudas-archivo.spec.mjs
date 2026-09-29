import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

const today=new Date();
const expense={id:"cuota-guardada",date:new Date(today.getFullYear(),today.getMonth(),Math.max(1,today.getDate()-1),12).toISOString(),
  amount:80,merchant:"Cuota ejemplo",category:"deudas",debtId:"d-archivada",source:"manual",ent:"sabadell"};
const debt={id:"d-archivada",name:"Préstamo ejemplo",value:0,original:800,monthly:80,account:"sabadell"};

async function openDebts(page){
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({timeout:15_000});
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  await page.locator(".v4-seg-btn").filter({hasText:/Deudas|Debts|Deutes/i}).click();
}

test("saldo proyectado cero pide confirmación; archivar conserva la cuota y permite volver a mostrar",async({page})=>{
  await seedLoggedInDashboard(page,{__seedOnce:true,debts:[debt],expenses:[expense]});
  await openDebts(page);
  const cards=page.locator(".v4-debt-card");
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText("Saldo estimado: 0 €");
  await cards.first().getByRole("button",{name:"Marcar liquidada"}).click();
  await expect(page.getByRole("dialog")).toContainText("no crea pagos");
  await page.getByRole("dialog").getByRole("button",{name:"Cancelar"}).click();
  await expect(cards.first()).toContainText("Saldo estimado: 0 €");
  await cards.first().getByRole("button",{name:"Marcar liquidada"}).click();
  await page.getByRole("dialog").getByRole("button",{name:"Marcar liquidada"}).click();
  await expect(cards.first()).toContainText("Liquidada");
  await cards.first().getByRole("button",{name:"Archivar deuda"}).click();
  await expect(cards).toHaveCount(0);
  await expect(page.getByRole("button",{name:/Deudas archivadas \(1\)/})).toBeVisible();
  await page.getByRole("button",{name:/Deudas archivadas \(1\)/}).click();
  await expect(page.locator('[data-archived-debt="d-archivada"]')).toContainText("Préstamo ejemplo");

  // El archivo solo afecta la lista de Deudas: Gastos sigue encontrando la cuota por su id.
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await expect(page.locator(".v4-gastos-list-body button.v4-mov").filter({hasText:"Cuota ejemplo"})).toContainText("Préstamo ejemplo");
  await page.reload();
  await expect(page.locator(".botnav")).toBeVisible({timeout:15_000});
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  await page.locator(".v4-seg-btn").filter({hasText:/Deudas|Debts|Deutes/i}).click();
  await expect(cards).toHaveCount(0);
  await page.getByRole("button",{name:/Deudas archivadas \(1\)/}).click();
  await page.locator('[data-archived-debt="d-archivada"]').getByRole("button",{name:"Volver a mostrar"}).click();
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText("Liquidada");
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("micartera_v3")).debts[0].archivedAt)).toBeFalsy();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem("micartera_v3")));
  expect(saved.debts).toHaveLength(1);
  expect(saved.debts[0].settledAt).toBeTruthy();
  expect(saved.debts[0].archivedAt).toBeFalsy();
});

test("la amortización total marca la deuda una vez y no crea un movimiento",async({page})=>{
  const live=Object.assign({},debt,{value:80,original:80});
  await seedLoggedInDashboard(page,{debts:[live],expenses:[]});
  await openDebts(page);
  await page.locator(".v4-debt-card").getByRole("button",{name:/Amortizar/}).click();
  await page.getByRole("dialog").locator(".ask-in").fill("80");
  await page.getByRole("dialog").getByRole("button",{name:/Amortizar/}).click();
  await expect(page.locator(".v4-debt-card")).toContainText("Liquidada");
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("micartera_v3")).debts[0].settledAt)).toBeTruthy();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem("micartera_v3")));
  expect(saved.debts).toHaveLength(1);
  expect(saved.debts[0].settledAt).toBeTruthy();
  expect(saved.expenses||[]).toHaveLength(0);
});

test("una deuda con cuotas vinculadas no se puede borrar y conserva su nombre",async({page})=>{
  await seedLoggedInDashboard(page,{debts:[debt],expenses:[expense]});
  await openDebts(page);
  await page.getByRole("button",{name:"Editar saldos pendientes"}).click();
  await page.locator(".v4-debt-card").getByRole("button",{name:"Eliminar esta deuda"}).click();
  await expect(page.locator(".v4-debt-card")).toHaveCount(1);
  await expect(page.locator(".v4-debt-card")).toContainText("Préstamo ejemplo");
});

test("un saldo positivo corregido en otro dispositivo no queda oculto por el archivo",async({page})=>{
  await seedLoggedInDashboard(page,{debts:[Object.assign({},debt,{value:80,archivedAt:"2026-09-28T12:00:00Z",settledAt:"2026-09-28T12:00:00Z"})]});
  await openDebts(page);
  await expect(page.locator(".v4-debt-card")).toHaveCount(1);
  await expect(page.locator(".v4-debt-card")).toContainText("Préstamo ejemplo");
  await expect(page.getByRole("button",{name:/Deudas archivadas/})).toHaveCount(0);
});

for(const lang of [
  {id:"en",estimated:"Estimated balance",confirm:"Mark as settled",archive:"Archive debt"},
  {id:"ca",estimated:"Saldo estimat",confirm:"Marca'l com a liquidat",archive:"Arxiva el deute"},
]) test(`liquidación y archivo están traducidos (${lang.id})`,async({page})=>{
  await seedLoggedInDashboard(page,{debts:[debt],settings:{autoPrices:false,theme:"green",lang:lang.id}});
  await openDebts(page);
  const card=page.locator(".v4-debt-card");
  await expect(card).toContainText(lang.estimated);
  await card.getByRole("button",{name:lang.confirm}).click();
  await page.getByRole("dialog").getByRole("button",{name:lang.confirm}).click();
  await expect(card.getByRole("button",{name:lang.archive})).toBeVisible();
});
