import {test,expect} from "@playwright/test";
import {seedLoggedInDashboard,dismissNews,estadoHeredado} from "./fixtures.mjs";
const texts={es:{debts:"Deudas",goals:"Metas",editDebt:"Editar deuda",editGoal:"Editar meta",saveDebt:"Guardar cambios",saveGoal:"Guardar cambios",saved:"Cambios guardados",cancel:"Cancelar",deleteDebt:"Eliminar esta deuda",deleteGoal:"Eliminar meta"},
 en:{debts:"Debts",goals:"Goals",editDebt:"Edit debt",editGoal:"Edit goal",saveDebt:"Save changes",saveGoal:"Save changes",saved:"Changes saved",cancel:"Cancel",deleteDebt:"Delete this debt",deleteGoal:"Delete goal"},
 ca:{debts:"Deutes",goals:"Metes",editDebt:"Edita el deute",editGoal:"Edita l’objectiu",saveDebt:"Desa els canvis",saveGoal:"Desa els canvis",saved:"Canvis desats",cancel:"Cancel·la",deleteDebt:"Elimina aquest deute",deleteGoal:"Elimina objectiu"}};
const debt={id:"debt",name:"Préstamo sintético",value:176714.8,original:180000,monthly:660.85,amort:450.15,months:309,asOf:2026*12+9-40,day:1,apr:2,account:"sabadell",unknown:{keep:7}};
const goal={id:"goal",name:"Viaje sintético",target:4000.55,saved:1500.25,monthly:75.1,emoji:"✈️",unknown:{keep:8}};
const saved=page=>page.evaluate(()=>JSON.parse(localStorage.getItem("micartera_v3")));
async function open(page,lang,overrides={}){
 await page.clock.install({time:new Date("2026-10-14T12:00:00Z")});
 await seedLoggedInDashboard(page,{__seedOnce:true,...estadoHeredado("2026-10-14"),obAccounts:estadoHeredado("2026-10-14").obAccounts.map(o=>({...o,key:o.id})),debts:[debt],goals:[goal],expenses:[],settings:{lang,autoPrices:false,theme:"green",reservaRules:[]},...overrides});
 await page.goto("/");await page.waitForFunction(()=>!document.getElementById("mc-load"));await dismissNews(page);
 await page.locator('.botnav-tab[data-tour="plan"]').click();await page.getByRole("tab",{name:texts[lang].debts,exact:true}).click();
}
const debtSheet=(page,lang)=>page.getByRole("dialog",{name:texts[lang].editDebt,exact:true});
const goalSheet=(page,lang)=>page.getByRole("dialog",{name:texts[lang].editGoal,exact:true});
for(const lang of Object.keys(texts)){
 test(`TAE tecleada conserva coma/punto, null y cero, confirma y persiste (${lang})`,async({page})=>{
  await open(page,lang);const t=texts[lang],row=page.locator('[data-debt-id="debt"]');
  const initial=await saved(page);
  const subtitle=await row.locator(".plan-debt-details").innerText();
  expect((subtitle.match(/661/g)||[]).length).toBe(1);
  for(const raw of ["1,05","1.05","","0"]){
   await row.locator(".plan-item-open").click();const sheet=debtSheet(page,lang),input=sheet.locator('[data-debt-field="apr"]');
   const before=await saved(page);await input.fill("");let value="";
   for(const char of raw){value+=char;await input.pressSequentially(char);await expect(input).toHaveValue(value);}
   expect((await saved(page)).debts).toEqual(before.debts);
   await sheet.getByRole("button",{name:t.saveDebt,exact:true}).click();await expect(sheet).toHaveCount(0);
   await expect(page.getByText(t.saved,{exact:true})).toBeVisible();
   await expect.poll(async()=> (await saved(page)).debts[0].apr).toBe(raw===""?null:raw==="0"?0:1.05);
   const state=await saved(page);expect(state.debts[0].apr).toBe(raw===""?null:raw==="0"?0:1.05);
   for(const key of ["value","asOf","amort","months","original","monthly","day","unknown"])expect(state.debts[0][key]).toEqual(initial.debts[0][key]);
  }
  await page.reload();await page.waitForFunction(()=>!document.getElementById("mc-load"));expect((await saved(page)).debts[0].apr).toBe(0);
 });
 test(`deuda: cancelar y guardar sin cambios conservan todo; el asesor abre la misma hoja (${lang})`,async({page})=>{
  await open(page,lang);const t=texts[lang],row=page.locator('[data-debt-id="debt"]'),before=await saved(page);
  await row.locator(".plan-item-open").click();const sheet=debtSheet(page,lang);
  await sheet.locator('[data-debt-field="name"]').fill("Borrador");await sheet.getByRole("button",{name:t.cancel,exact:true}).click();await expect(sheet).toHaveCount(0);
  expect((await saved(page)).debts).toEqual(before.debts);
  await row.locator(".plan-item-open").click();await sheet.getByRole("button",{name:t.saveDebt,exact:true}).click();await expect(sheet).toHaveCount(0);
  expect((await saved(page)).debts).toEqual(before.debts);
  await page.getByText(/¿Cuándo amortizar\?|When to pay down|Quan amortitzar/i).first().click();
  await page.getByRole("button",{name:/2 %/}).click();await expect(sheet).toBeVisible();
 });
 test(`meta: hoja individual conserva céntimos, cancelar y eliminar requiere confirmación (${lang})`,async({page})=>{
  await open(page,lang);const t=texts[lang];await page.getByRole("tab",{name:t.goals,exact:true}).click();
  const row=page.locator('[data-goal-id="goal"]'),sheet=goalSheet(page,lang),before=await saved(page);
  await row.locator(".plan-item-open").click();await sheet.getByRole("button",{name:t.saveGoal,exact:true}).click();await expect(sheet).toHaveCount(0);
  expect((await saved(page)).goals).toEqual(before.goals);
  await row.locator(".plan-item-open").click();await sheet.locator('[data-goal-field="saved"]').fill("1600,35");await sheet.locator('[data-goal-field="target"]').fill("4200.75");
  await sheet.getByRole("button",{name:t.saveGoal,exact:true}).click();await expect(sheet).toHaveCount(0);
  await expect.poll(async()=> (await saved(page)).goals[0].saved).toBe(1600.35);
  expect((await saved(page)).goals[0]).toMatchObject({id:"goal",saved:1600.35,target:4200.75,unknown:goal.unknown});
  await row.locator(".plan-item-open").click();await sheet.getByRole("button",{name:t.deleteGoal,exact:true}).click();
  await expect(page.locator(".askback")).toBeVisible();expect((await saved(page)).goals).toHaveLength(1);
  await page.locator(".askback").getByRole("button",{name:/Cancelar|Cancel·la|Cancel/,exact:true}).click();expect((await saved(page)).goals).toHaveLength(1);
 });
}
test("saldo, cuota, día y plazo se editan sin perder identidad ni campos desconocidos",async({page})=>{
 await open(page,"es");await page.locator('[data-debt-id="debt"] .plan-item-open').click();const sheet=debtSheet(page,"es");
 for(const [key,value] of Object.entries({name:"Deuda corregida",balance:"750,25",monthly:"80.35",day:"29",months:"50"}))await sheet.locator('[data-debt-field="'+key+'"]').fill(value);
 await sheet.getByRole("button",{name:texts.es.saveDebt,exact:true}).click();await expect(sheet).toHaveCount(0);
 await expect.poll(async()=> (await saved(page)).debts[0].name).toBe("Deuda corregida");
 const d=(await saved(page)).debts[0];expect(d).toMatchObject({id:"debt",name:"Deuda corregida",monthly:80.35,day:29,months:50,unknown:debt.unknown});
 const balance=await page.evaluate(d=>Math.round(debtBalance(d)*100),d);expect(balance).toBe(75025);
});
test("eliminar deuda pide confirmación y una cuota vinculada impide perder su identidad",async({page})=>{
 await open(page,"es",{expenses:[{id:"linked",debtId:"debt",date:"2026-10-01",amount:660.85,ent:"sabadell",category:"deudas",merchant:"Cuota sintética"}]});
 await page.locator('[data-debt-id="debt"] .plan-item-open').click();await debtSheet(page,"es").getByRole("button",{name:texts.es.deleteDebt,exact:true}).click();
 expect((await saved(page)).debts).toHaveLength(1);await expect(page.locator(".askback")).toHaveCount(0);
 await expect(page.getByText(/Esta deuda tiene pagos vinculados/)).toBeVisible();
});
test("una corrección encolada mientras la hoja estaba abierta no se pisa ni se anuncia guardada",async({page})=>{
 await open(page,"es");await page.locator('[data-debt-id="debt"] .plan-item-open').click();const sheet=debtSheet(page,"es");await sheet.locator('[data-debt-field="apr"]').fill("1,05");
 await page.evaluate(()=>{
  let fiber=document.querySelector('[data-debt-id="debt"]')[Object.keys(document.querySelector('[data-debt-id="debt"]')).find(k=>k.startsWith("__reactFiber$"))];
  while(fiber&&!(fiber.memoizedProps&&fiber.memoizedProps.state&&fiber.memoizedProps.set))fiber=fiber.return;
  if(!fiber)throw Error("No se encontró el set real de Deudas");
  fiber.memoizedProps.set(s=>({...s,debts:s.debts.map(d=>({...d,value:99999.25}))}));
  document.querySelector('.plan-edit-sheet .btn-primary').click();
 });
 await expect(sheet.getByRole("alert")).toContainText("cambió o se borró");await expect(sheet.locator('[data-debt-field="apr"]')).toHaveValue("1,05");
 await expect.poll(async()=> (await saved(page)).debts[0].value).toBe(99999.25);
 const d=(await saved(page)).debts[0];expect(d.value).toBe(99999.25);expect(d.apr).toBe(2);
});
test("la regla sin nombre no repite su meta y se edita en una hoja conservando identidad",async({page})=>{
 const rule={id:"rule",name:"",kind:"fixed",value:50.25,goalId:"goal",mensual:true,unknown:{keep:9}};
 await open(page,"es",{settings:{lang:"es",autoPrices:false,theme:"green",reservaRules:[rule]}});
 await page.getByRole("tab",{name:"Metas",exact:true}).click();
 const row=page.locator('[data-reserva-rule="rule"]');await expect(row).toBeVisible();
 expect(((await row.innerText()).match(/Viaje sintético/g)||[]).length).toBe(1);
 const before=await saved(page);await row.getByRole("button",{name:"Editar regla",exact:true}).click();
 const sheet=page.getByRole("dialog",{name:"Editar regla",exact:true});await expect(sheet).toBeVisible();
 await sheet.getByRole("button",{name:"Guardar regla",exact:true}).click();await expect(sheet).toHaveCount(0);
 expect((await saved(page)).settings.reservaRules).toEqual(before.settings.reservaRules);
 expect((await saved(page)).reservaLog).toEqual(before.reservaLog);
});
