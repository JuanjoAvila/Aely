import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

test.use({ viewport:{width:375,height:812}, hasTouch:true });

async function abrirGastos(page){
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({timeout:30_000});
  await page.waitForFunction(()=>!document.getElementById("mc-load"));
  await dismissNews(page);
  const ajustes=page.locator(".settings-push.open");
  if(await ajustes.count()) await ajustes.locator(".settings-push-h .back").click();
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
}

for(const caso of [
  {lang:"es",period:"Mi ciclo",from:"Del 26/9",hint:"Los ingresos posteriores",show:"Ayuda",hide:"Ocultar"},
  {lang:"en",period:"My cycle",from:"From 26/09",hint:"Later income",show:"Help",hide:"Hide"},
  {lang:"ca",period:"El meu cicle",from:"Del 26/09",hint:"Els ingressos posteriors",show:"Ajuda",hide:"Amaga"},
]) test(`Mi ciclo pliega, recupera y conserva la ayuda (${caso.lang})`,async({page})=>{
  await page.clock.install({time:new Date("2026-09-28T12:00:00Z")});
  await seedLoggedInDashboard(page,{
    __seedOnce:true,budget:1000,
    settings:{autoPrices:false,theme:"green",lang:caso.lang,budgetCycle:true},
    expenses:[{id:"nomina",date:"2026-09-26T12:00:00Z",amount:-2000,merchant:"Nómina",category:"ingreso"}],
  });
  await abrirGastos(page);
  const card=page.getByTestId("gastos-cycle-help");
  const toggle=card.getByRole("button");
  await expect(page.locator(".v4-period-btn.on")).toHaveText(caso.period);
  await expect(card).toContainText(caso.from);
  await expect(card.locator(".v4-cycle-explanation")).toContainText(caso.hint);
  await expect(toggle).toHaveText(caso.hide);
  await toggle.click();
  await expect(card).toContainText(caso.from);
  await expect(card.locator(".v4-cycle-explanation")).toHaveCount(0);
  await expect(toggle).toHaveText(caso.show);
  await expect(toggle).toHaveAttribute("aria-expanded","false");
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("micartera_v3")||"{}").settings?.gastosCycleHelpOff)).toBe(true);
  await page.locator('.botnav-tab[data-tour="inicio"]').click();
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await expect(card.locator(".v4-cycle-explanation")).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".botnav")).toBeVisible();
  await page.waitForFunction(()=>!document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await expect(page.locator(".v4-period-btn.on")).toHaveText(caso.period);
  await expect(card).toContainText(caso.from);
  await expect(card.locator(".v4-cycle-explanation")).toHaveCount(0);
  await toggle.click();
  await expect(card.locator(".v4-cycle-explanation")).toContainText(caso.hint);
  await expect(toggle).toHaveAttribute("aria-expanded","true");
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("micartera_v3")||"{}").settings?.gastosCycleHelpOff)).toBeUndefined();
});

test("sin nómina, plegar la ayuda conserva visible que el presupuesto usa el mes natural",async({page})=>{
  await page.clock.install({time:new Date("2026-09-28T12:00:00Z")});
  await seedLoggedInDashboard(page,{budget:1000,settings:{autoPrices:false,theme:"green",lang:"es",budgetCycle:true},expenses:[]});
  await abrirGastos(page);
  const card=page.getByTestId("gastos-cycle-help");
  await expect(card).toContainText("Sin nómina detectada");
  await expect(card.locator(".v4-cycle-explanation")).toContainText("Apunta la nómina");
  await card.getByRole("button",{name:"Ocultar"}).click();
  await expect(card).toContainText("El presupuesto usa el mes natural");
  await expect(card.locator(".v4-cycle-explanation")).toHaveCount(0);
  await expect(page.locator(".v4-period-btn.on")).toHaveText("Mi ciclo");
});

test("el filtro Mi ciclo sin presupuesto conserva una ayuda útil",async({page})=>{
  await page.clock.install({time:new Date("2026-09-28T12:00:00Z")});
  await seedLoggedInDashboard(page,{
    settings:{autoPrices:false,theme:"green",lang:"es",budgetCycle:false},
    expenses:[{id:"cobro",date:"2026-09-26T12:00:00Z",amount:-2000,merchant:"Cobro",category:"ingreso"}],
  });
  await abrirGastos(page);
  await page.getByRole("button",{name:"Mi ciclo",exact:true}).click();
  const card=page.getByTestId("gastos-cycle-help");
  await expect(card).toContainText("Del 26/9");
  await expect(card.locator(".v4-cycle-explanation")).toContainText("no cambia el presupuesto mensual");
});
