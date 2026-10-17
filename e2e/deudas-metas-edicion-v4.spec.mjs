import {test,expect} from "@playwright/test";
import {seedLoggedInDashboard,dismissNews,estadoHeredado} from "./fixtures.mjs";
const texts={es:{debts:"Deudas",goals:"Metas",editDebt:"Editar deuda",editGoal:"Editar meta",saveDebt:"Guardar cambios",saveGoal:"Guardar cambios",saved:"Cambios guardados",cancel:"Cancelar",deleteDebt:"Eliminar esta deuda",deleteGoal:"Eliminar meta"},
 en:{debts:"Debts",goals:"Goals",editDebt:"Edit debt",editGoal:"Edit goal",saveDebt:"Save changes",saveGoal:"Save changes",saved:"Changes saved",cancel:"Cancel",deleteDebt:"Delete this debt",deleteGoal:"Delete goal"},
 ca:{debts:"Deutes",goals:"Metes",editDebt:"Edita el deute",editGoal:"Edita l’objectiu",saveDebt:"Desa els canvis",saveGoal:"Desa els canvis",saved:"Canvis desats",cancel:"Cancel·la",deleteDebt:"Elimina aquest deute",deleteGoal:"Elimina objectiu"}};
const debt={id:"debt",name:"Préstamo sintético",value:176714.8,original:180000,monthly:660.85,amort:450.15,months:309,asOf:2026*12+9-40,day:1,apr:2,account:"sabadell",unknown:{keep:7}};
const goal={id:"goal",name:"Viaje sintético",target:4000.55,saved:1500.25,monthly:75.1,emoji:"✈️",unknown:{keep:8}};
const saved=page=>page.evaluate(()=>JSON.parse(localStorage.getItem("micartera_v3")));
async function open(page,lang,overrides={},realClock=false){
 // El reloj falso también sustituye requestAnimationFrame: para medir frames hay que ir sin él.
 if(!realClock)await page.clock.install({time:new Date("2026-10-14T12:00:00Z")});
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
 for(const [key,value] of Object.entries({name:"Deuda corregida",balance:"750,25",monthly:"80.35",day:"29",months:"42"}))await sheet.locator('[data-debt-field="'+key+'"]').fill(value);
 await sheet.getByRole("button",{name:texts.es.saveDebt,exact:true}).click();await expect(sheet).toHaveCount(0);
 await expect.poll(async()=> (await saved(page)).debts[0].name).toBe("Deuda corregida");
 const d=(await saved(page)).debts[0];expect(d).toMatchObject({id:"debt",name:"Deuda corregida",monthly:80.35,day:29,months:42,unknown:debt.unknown});
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

// Dos filas distintas y edición de la segunda: guardar por índice no puede pasar inadvertido.
const reviewDebt={id:"debt",name:"Deuda segunda sintética",value:2000,monthly:200,months:10,day:15,asOf:2026*12+9-4,unknown:{keep:7}};
const reviewRows={debts:[{...reviewDebt,id:"debt-first",name:"Primera deuda sintética",value:900},reviewDebt],goals:[{...goal,id:"goal-first",name:"Primera meta sintética"},goal]};
for(const scenario of [
 {id:"día",field:"day",value:"1",balance:120000,left:6,total:11,last:20000},
 {id:"saldo residual",field:"balance",value:"1300,25",balance:130025,left:7,total:11,last:10025}
])test(`R1/M5: cambiar ${scenario.id} conserva saldo y muestra cuotas coherentes`,async({page})=>{
 await open(page,"es",reviewRows);const before=await saved(page),row=page.locator('[data-debt-id="debt"]');
 await expect(row.locator(".plan-debt-details")).toContainText("Quedan 6/10 cuotas");
 await row.locator(".plan-item-open").click();const sheet=debtSheet(page,"es");await sheet.locator('[data-debt-field="'+scenario.field+'"]').fill(scenario.value);
 await sheet.getByRole("button",{name:texts.es.saveDebt,exact:true}).click();await expect(sheet).toHaveCount(0);
 await expect(row.locator(".plan-debt-details")).toContainText(`Quedan ${scenario.left}/${scenario.total} cuotas`);
 await expect.poll(async()=>(await saved(page)).debts.find(x=>x.id==="debt").months).toBe(scenario.total);
 const after=await saved(page),d=after.debts.find(x=>x.id==="debt");expect(after.debts).toHaveLength(2);expect(after.debts[0]).toEqual(before.debts[0]);expect(after.goals).toEqual(before.goals);expect(d).toMatchObject({id:"debt",months:scenario.total,asOf:reviewDebt.asOf,unknown:reviewDebt.unknown});
 expect(await page.evaluate(d=>({balance:Math.round(debtBalance(d)*100),left:debtLeft(d)}),d)).toEqual({balance:scenario.balance,left:scenario.left});
 await page.reload();await page.waitForFunction(()=>!document.getElementById("mc-load"));
 await expect.poll(async()=>(await saved(page)).debts.find(x=>x.id==="debt").months).toBe(scenario.total);
 const restored=(await saved(page)).debts.find(x=>x.id==="debt");expect(restored).toEqual(d);
 // Avanza el reloj real del navegador hasta la penúltima y última cuota, sin resembrar estado.
 const firstMonth=9+(d.day<=14?1:0),penultimate=new Date(Date.UTC(2026,firstMonth+scenario.left-2,d.day,12)),last=new Date(Date.UTC(2026,firstMonth+scenario.left-1,d.day,12));
 await page.clock.setSystemTime(penultimate);expect(await page.evaluate(d=>Math.round(debtBalance(d)*100),d)).toBe(scenario.last);
 await page.clock.setSystemTime(last);expect(await page.evaluate(d=>({balance:Math.round(debtBalance(d)*100),left:debtLeft(d)}),d)).toEqual({balance:0,left:0});
});

test("M2: edita la segunda de DOS deudas por id y conserva las DOS metas",async({page})=>{
 await open(page,"es",reviewRows);const before=await saved(page);await page.locator('[data-debt-id="debt"] .plan-item-open').click();const sheet=debtSheet(page,"es");await sheet.locator('[data-debt-field="name"]').fill("Segunda deuda editada");await sheet.getByRole("button",{name:texts.es.saveDebt,exact:true}).click();await expect.poll(async()=>JSON.stringify((await saved(page)).debts)!==JSON.stringify(before.debts)).toBe(true);
 const after=await saved(page);expect(after.debts).toEqual([before.debts[0],{...before.debts[1],name:"Segunda deuda editada"}]);expect(after.goals).toEqual(before.goals);
 await expect(sheet).toHaveCount(0);
 await expect(page.locator('[data-debt-id="debt-first"]')).toHaveCount(1);await expect(page.locator('[data-debt-id="debt"]')).toHaveCount(1);
});

test("M2/M7: baja el objetivo de la segunda de DOS metas y recalcula done",async({page})=>{
 await open(page,"es",reviewRows);const before=await saved(page);await page.getByRole("tab",{name:"Metas",exact:true}).click();await page.locator('[data-goal-id="goal"] .plan-item-open').click();const sheet=goalSheet(page,"es");await sheet.locator('[data-goal-field="target"]').fill("1400,15");await sheet.getByRole("button",{name:texts.es.saveGoal,exact:true}).click();await expect.poll(async()=>JSON.stringify((await saved(page)).goals)!==JSON.stringify(before.goals)).toBe(true);
 const after=await saved(page);expect(after.goals).toHaveLength(2);expect(after.goals[0]).toEqual(before.goals[0]);expect(after.debts).toEqual(before.debts);expect(after.goals[1]).toMatchObject({...before.goals[1],target:1400.15,done:true});expect(after.goals[1].doneAt).toMatch(/^2026-10-14T/);
 await expect(sheet).toHaveCount(0);
 await page.reload();await page.waitForFunction(()=>!document.getElementById("mc-load"));expect((await saved(page)).goals).toEqual(after.goals);
});

// PC: plazo y cuota se validan juntos sin perder el borrador ni tocar otra fila.
const pcErrors={es:"El plazo y la cuota no encajan con el saldo pendiente. Revisa el plazo o la cuota.",en:"The term and payment do not match the remaining balance. Check the term or payment.",ca:"El termini i la quota no encaixen amb el saldo pendent. Revisa el termini o la quota."};
const pcRange={es:"Con 6 cuotas por pagar, la cuota tiene que estar entre",en:"With 6 payments left, the payment must be between",ca:"Amb 6 quotes per pagar, la quota ha d'estar entre"};
const pcDebt=extra=>({...reviewDebt,original:2000,...extra}),pcRows=d=>({...reviewRows,debts:[reviewRows.debts[0],d]});
const pcInvalid=[{id:"fantasma",months:20,debt:{}},{id:"residual",months:8,debt:{}},{id:"amort",months:16,debt:{monthly:300,amort:200}},{id:"balloon",months:20,debt:{value:2400,balloon:400}}];
for(const lang of ["es","en","ca"])for(const scenario of pcInvalid.filter(x=>lang==="es"||x.id==="fantasma"||x.id==="residual"))test(`PC: rechaza ${scenario.id} y conserva borrador (${lang})`,async({page})=>{
 await open(page,lang,pcRows(pcDebt(scenario.debt)));const before=await saved(page);await page.locator('[data-debt-id="debt"] .plan-item-open').click();const sheet=debtSheet(page,lang);
 await sheet.locator('[data-debt-field="months"]').fill(String(scenario.months));await sheet.locator('[data-debt-field="monthly"]').fill("100");await sheet.getByRole("button",{name:texts[lang].saveDebt,exact:true}).click();
 await expect(sheet.getByRole("alert")).toHaveText(pcErrors[lang]);
 await expect(sheet).toBeVisible();await expect(sheet.locator('[data-debt-field="months"]')).toHaveValue(String(scenario.months));await expect(sheet.locator('[data-debt-field="monthly"]')).toHaveValue("100");
 const after=await saved(page);expect(after.debts).toEqual(before.debts);expect(after.goals).toEqual(before.goals);expect(after.expenses).toEqual(before.expenses);
 await sheet.getByRole("button",{name:texts[lang].cancel,exact:true}).click();await expect(sheet).toHaveCount(0);await page.reload();await page.waitForFunction(()=>!document.getElementById("mc-load"));expect((await saved(page)).debts).toEqual(before.debts);
});
// Paso del panel de beta 4.26.138.1, tal cual: deuda con plazo, SOLO se baja la cuota y Guardar.
// Antes se guardaba alargando el plazo por debajo; ahora avisa, no guarda y la tarjeta no cambia.
for(const lang of ["es","en","ca"])test(`panel: cuota baja con plazo avisa y no guarda (${lang})`,async({page})=>{
 await open(page,lang,pcRows(pcDebt({})));const before=await saved(page),row=page.locator('[data-debt-id="debt"]');const card=await row.locator(".plan-debt-details").innerText();
 await row.locator(".plan-item-open").click();const sheet=debtSheet(page,lang);
 await expect(sheet.locator('[data-debt-field="months"]')).toHaveValue("10");await sheet.locator('[data-debt-field="monthly"]').fill("100");
 await sheet.getByRole("button",{name:texts[lang].saveDebt,exact:true}).click();
 // Y dice entre qué cuotas cuadra: el «no encajan» a secas no decía qué valor aceptaba (revisión d139c).
 const alert=sheet.getByRole("alert");await expect(alert).toContainText(pcErrors[lang]);await expect(alert).toContainText(pcRange[lang]);await expect(alert).toContainText(/239[,.]99/);await expect(sheet).toBeVisible();
 await expect(sheet.locator('[data-debt-field="monthly"]')).toHaveValue("100");await expect(sheet.locator('[data-debt-field="months"]')).toHaveValue("10");
 await expect(page.getByText(texts[lang].saved,{exact:true})).toHaveCount(0);
 const after=await saved(page);expect(after.debts).toEqual(before.debts);expect(after.goals).toEqual(before.goals);
 await sheet.getByRole("button",{name:texts[lang].cancel,exact:true}).click();await expect(sheet).toHaveCount(0);await expect(row.locator(".plan-debt-details")).toHaveText(card);
 await page.reload();await page.waitForFunction(()=>!document.getElementById("mc-load"));expect((await saved(page)).debts).toEqual(before.debts);
});
for(const scenario of [
 {id:"parcial",debt:{value:2000.25},months:17,value:1600.25,balance:120025,left:13,last:25},
 {id:"amort",debt:{value:1800,monthly:300,amort:200},months:9,value:1800,balance:100000,left:5,last:20000},
 {id:"balloon",debt:{value:2400.11,balloon:400.11},months:16,value:2000.11,balance:160011,left:12,last:50011}
])test(`PC: acepta ${scenario.id} y conserva el contrato`,async({page})=>{
 await open(page,"es",pcRows(pcDebt(scenario.debt)));const before=await saved(page);await page.locator('[data-debt-id="debt"] .plan-item-open').click();const sheet=debtSheet(page,"es");await sheet.locator('[data-debt-field="months"]').fill(String(scenario.months));await sheet.locator('[data-debt-field="monthly"]').fill("100");await sheet.getByRole("button",{name:texts.es.saveDebt,exact:true}).click();await expect(sheet).toHaveCount(0);
 await expect.poll(async()=>(await saved(page)).debts.find(x=>x.id==="debt").months).toBe(scenario.months);const after=await saved(page),d=after.debts.find(x=>x.id==="debt");expect(after.debts[0]).toEqual(before.debts[0]);expect(after.goals).toEqual(before.goals);expect(d).toMatchObject({...before.debts[1],value:scenario.value,monthly:100,months:scenario.months});
 expect(await page.evaluate(d=>({balance:Math.round(debtBalance(d)*100),left:debtLeft(d)}),d)).toEqual({balance:scenario.balance,left:scenario.left});await page.reload();await page.waitForFunction(()=>!document.getElementById("mc-load"));expect((await saved(page)).debts.find(x=>x.id==="debt")).toEqual(d);
 await page.clock.setSystemTime(new Date(Date.UTC(2026,9+scenario.left-2,15,12)));expect(await page.evaluate(d=>Math.round(debtBalance(d)*100),d)).toBe(scenario.last);await page.clock.setSystemTime(new Date(Date.UTC(2026,9+scenario.left-1,15,12)));expect(await page.evaluate(d=>Math.round(debtBalance(d)*100),d)).toBe(0);
});
for(const mode of ["solo-plazo","plazo-dia","plazo-saldo"])for(const months of [20,7])test(`PC revisión: ${mode} rechaza plazo ${months} sin cambiar cuota`,async({page})=>{
 await open(page,"es",pcRows(pcDebt({})));const before=await saved(page);await page.locator('[data-debt-id="debt"] .plan-item-open').click();const sheet=debtSheet(page,"es");await sheet.locator('[data-debt-field="months"]').fill(String(months));if(mode==="plazo-dia")await sheet.locator('[data-debt-field="day"]').fill("1");if(mode==="plazo-saldo")await sheet.locator('[data-debt-field="balance"]').fill("1300,25");await sheet.getByRole("button",{name:texts.es.saveDebt,exact:true}).click();await expect(sheet.getByRole("alert")).toHaveText(pcErrors.es);await expect(sheet.locator('[data-debt-field="monthly"]')).toHaveValue("200");await expect(sheet.locator('[data-debt-field="months"]')).toHaveValue(String(months));const after=await saved(page);expect(after.debts).toEqual(before.debts);expect(after.goals).toEqual(before.goals);
});
const finishedHints={es:"Deuda terminada: solo se pueden cambiar datos no financieros.",en:"Completed debt: only non-financial details can be changed.",ca:"Deute acabat: només es poden canviar dades no financeres."};
for(const lang of ["es","en","ca"])for(const scenario of [
 {id:"dia15",asOf:2026*12+9-20,day:15},
 {id:"dia1",asOf:2026*12+9-20,day:1},
 {id:"corte",asOf:2026*12+9-9,day:1},
 {id:"balloon",asOf:2026*12+9-9,day:1,value:2400.11,balloon:400.11}
])test(`PC revisión: terminada bloquea dia y plazo, conserva historia y permite nombre: ${scenario.id} (${lang})`,async({page})=>{
 const {id,...fields}=scenario;await open(page,lang,pcRows(pcDebt(fields)));const before=await saved(page),old=before.debts.find(x=>x.id==="debt");await page.locator('[data-debt-id="debt"] .plan-item-open').click();const sheet=debtSheet(page,lang);
 await expect(sheet.locator('[data-debt-field="day"]')).toBeDisabled();await expect(sheet.locator('[data-debt-field="months"]')).toBeDisabled();await expect(sheet.getByText(finishedHints[lang],{exact:true})).toBeVisible();
 for(const key of ["apr","balance","monthly"])await expect(sheet.locator('[data-debt-field="'+key+'"]')).toBeDisabled();await expect(sheet.locator('[data-debt-field="name"]')).toBeEnabled();
 await sheet.getByRole("button",{name:texts[lang].saveDebt,exact:true}).click();await expect(sheet).toHaveCount(0);expect((await saved(page)).debts).toEqual(before.debts);
 await page.locator('[data-debt-id="debt"] .plan-item-open').click();await sheet.locator('[data-debt-field="name"]').fill("Nombre corregido");await sheet.getByRole("button",{name:texts[lang].saveDebt,exact:true}).click();await expect(sheet).toHaveCount(0);
 await expect.poll(async()=>(await saved(page)).debts.find(x=>x.id==="debt").name).toBe("Nombre corregido");const after=await saved(page),d=after.debts.find(x=>x.id==="debt");expect(d).toEqual({...old,name:"Nombre corregido"});expect(after.debts[0]).toEqual(before.debts[0]);expect(after.goals).toEqual(before.goals);expect(await page.evaluate(d=>({balance:Math.round(debtBalance(d)*100),left:debtLeft(d),active:debtActive(d)}),d)).toEqual({balance:0,left:0,active:false});
 await page.reload();await page.waitForFunction(()=>!document.getElementById("mc-load"));expect((await saved(page)).debts.find(x=>x.id==="debt")).toEqual(d);
});

// Rechazo de beta 4.26.138.1: «al abrir la hoja de editar parpadea o salta». Medido frame a frame
// con la CPU frenada no había remontaje ni movimiento del fondo; lo que cambiaba de golpe era el
// velo negro al 55 % y la subida en 280 ms de `.tabsheet`, ya rechazados en Apuntar. Este guardián
// abre las dos hojas reales y exige: un solo montaje, fondo quieto, subida sin retrocesos y la
// misma hoja que Apuntar (velo suave y ritmo pausado).
for(const kind of ["debt","goal"])test(`apertura de la hoja de ${kind==="debt"?"deuda":"meta"}: sin remontaje, fondo quieto y hoja de Apuntar`,async({page})=>{
 const many={debts:[1,2,3,4].map(i=>pcDebt({id:"d"+i,name:"Deuda "+i,value:2000*i,original:2000*i,months:10*i})),goals:[1,2,3,4].map(i=>({...goal,id:"g"+i,name:"Meta "+i,target:4000*i}))};
 await open(page,"es",many,true);if(kind==="goal")await page.getByRole("tab",{name:"Metas",exact:true}).click();
 const cdp=await page.context().newCDPSession(page);await cdp.send("Emulation.setCPUThrottlingRate",{rate:4});
 const card=page.locator(kind==="debt"?'[data-debt-id="d2"]':'[data-goal-id="g2"]');
 await page.evaluate(()=>{const host=document.querySelector(".page-scroll-host");host.scrollTop=200;});await page.waitForTimeout(400);
 await page.evaluate(sel=>{
  const rec=window.__apertura={frames:[],mounts:0,unmounts:0},pg=document.querySelector(sel).closest(".page");
  const watch=n=>n.nodeType===1&&!!(n.matches(".plan-edit-sheet")||n.querySelector&&n.querySelector(".plan-edit-sheet"));
  new MutationObserver(ms=>{for(const m of ms){for(const n of m.addedNodes)if(watch(n))rec.mounts++;for(const n of m.removedNodes)if(watch(n))rec.unmounts++;}}).observe(document.body,{childList:true,subtree:true});
  const t0=performance.now();(function f(){const sh=document.querySelector(".plan-edit-sheet"),c=document.querySelector(sel);
   rec.frames.push({sheet:sh?sh.getBoundingClientRect().top:null,card:c.getBoundingClientRect().top,scroll:pg.scrollTop});
   if(performance.now()-t0<2500)requestAnimationFrame(f);})();
 },kind==="debt"?'[data-debt-id="d2"]':'[data-goal-id="g2"]');
 // Clic crudo: el de Playwright puede desplazar la página para «ver» el botón y falsear el fondo.
 await card.locator(".plan-item-open").evaluate(b=>b.click());
 const sheet=kind==="debt"?debtSheet(page,"es"):goalSheet(page,"es");await expect(sheet).toBeVisible();
 await page.waitForFunction(()=>{const el=document.querySelector(".plan-edit-sheet");return !!el&&getComputedStyle(el).transform==="none";},null,{timeout:10000});
 await page.waitForTimeout(150);await cdp.send("Emulation.setCPUThrottlingRate",{rate:1});
 const rec=await page.evaluate(()=>window.__apertura),shown=rec.frames.filter(f=>f.sheet!=null);
 expect(rec.mounts).toBe(1);expect(rec.unmounts).toBe(0);
 expect(new Set(rec.frames.map(f=>Math.round(f.card))).size).toBe(1);expect(new Set(rec.frames.map(f=>f.scroll))).toEqual(new Set([200]));
 expect(shown.length).toBeGreaterThan(3);
 for(let i=1;i<shown.length;i++)expect(shown[i].sheet,"la hoja nunca retrocede al subir").toBeLessThanOrEqual(shown[i-1].sheet+0.5);
 const look=await sheet.evaluate(el=>{const back=getComputedStyle(el.parentElement).backgroundColor.match(/[\d.]+/g).map(Number);return {sheet:el.classList.contains("v4-sheet"),back:el.parentElement.classList.contains("v4-sheet-back"),alpha:back.length>3?back[3]:1,duration:parseFloat(getComputedStyle(el).animationDuration)};});
 expect(look).toMatchObject({sheet:true,back:true});expect(look.alpha).toBeLessThanOrEqual(0.3);expect(look.duration).toBeGreaterThanOrEqual(0.4);
});
// El atrás del sistema cierra la hoja con el borrador sin escribir y sin salir de la app. Sin
// useBackClose el atrás se iba a la página anterior del historial y ningún test lo veía (revisión d139).
for(const kind of ["debt","goal"])test(`atrás del sistema cierra la hoja de ${kind==="debt"?"deuda":"meta"} sin escribir ni salir`,async({page})=>{
 await open(page,"es");if(kind==="goal")await page.getByRole("tab",{name:"Metas",exact:true}).click();
 const url=page.url(),before=await saved(page),navs=[];page.on("framenavigated",f=>{if(f===page.mainFrame())navs.push(f.url());});
 await page.locator(kind==="debt"?'[data-debt-id="debt"] .plan-item-open':'[data-goal-id="goal"] .plan-item-open').click();
 const sheet=kind==="debt"?debtSheet(page,"es"):goalSheet(page,"es");await expect(sheet).toBeVisible();
 await sheet.locator(kind==="debt"?'[data-debt-field="name"]':'[data-goal-field="name"]').fill("Borrador sin guardar");
 await expect.poll(()=>page.evaluate(()=>_mcBackStack.length)).toBe(1);
 await page.goBack();
 await expect(sheet).toHaveCount(0);await expect(page).toHaveURL(url);await expect(page.locator(".botnav")).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>({stack:_mcBackStack.length,pending:_mcIgnorePop}))).toEqual({stack:0,pending:false});
 expect(navs.every(n=>n===url)).toBe(true);
 const after=await saved(page);expect(after.debts).toEqual(before.debts);expect(after.goals).toEqual(before.goals);
});
test("R2: residual del alta1000 en3 admite corregir un centimo a cero",async({page})=>{
 const d=pcDebt({value:1000,original:1000,monthly:333.33,amort:333.33,months:3,asOf:2026*12+9-3});await open(page,"es",pcRows(d));const before=await saved(page);await page.locator('[data-debt-id="debt"] .plan-item-open').click();const sheet=debtSheet(page,"es");for(const key of ["balance","monthly","day","months","apr"])await expect(sheet.locator('[data-debt-field="'+key+'"]')).toBeEnabled();await expect(sheet.locator('[data-debt-field="balance"]')).toHaveValue("0.01");await expect(sheet.getByText(finishedHints.es,{exact:true})).toHaveCount(0);await sheet.locator('[data-debt-field="balance"]').fill("0");await sheet.getByRole("button",{name:texts.es.saveDebt,exact:true}).click();await expect(sheet).toHaveCount(0);await expect.poll(async()=>(await saved(page)).debts[1].value).toBe(999.99);const after=await saved(page);expect(after.debts).toEqual([before.debts[0],{...before.debts[1],value:999.99}]);expect(after.goals).toEqual(before.goals);expect(await page.evaluate(d=>({balance:Math.round(debtBalance(d)*100),left:debtLeft(d)}),after.debts[1])).toEqual({balance:0,left:0});await page.reload();await page.waitForFunction(()=>!document.getElementById("mc-load"));expect((await saved(page)).debts).toEqual(after.debts);
});
test("R2: legado2500 tras10 cuotas de200 permite cuota normal y conserva500",async({page})=>{
 await open(page,"es",pcRows(pcDebt({value:2500,original:2500,asOf:2026*12+9-10})));const before=await saved(page);await page.locator('[data-debt-id="debt"] .plan-item-open').click();const sheet=debtSheet(page,"es");for(const key of ["balance","monthly","day","months","apr"])await expect(sheet.locator('[data-debt-field="'+key+'"]')).toBeEnabled();await expect(sheet.locator('[data-debt-field="balance"]')).toHaveValue("500");await sheet.locator('[data-debt-field="monthly"]').fill("100");await sheet.locator('[data-debt-field="months"]').fill("15");await sheet.getByRole("button",{name:texts.es.saveDebt,exact:true}).click();await expect(sheet).toHaveCount(0);await expect.poll(async()=>(await saved(page)).debts[1].monthly).toBe(100);const after=await saved(page);expect(after.debts).toEqual([before.debts[0],{...before.debts[1],monthly:100,months:15,value:1500,settledAt:null,archivedAt:null}]);expect(await page.evaluate(d=>({balance:Math.round(debtBalance(d)*100),left:debtLeft(d)}),after.debts[1])).toEqual({balance:50000,left:5});await page.reload();await page.waitForFunction(()=>!document.getElementById("mc-load"));expect((await saved(page)).debts).toEqual(after.debts);
});
test("R2: terminada real mantiene bloqueo financiero y nombre editable",async({page})=>{
 await open(page,"es",pcRows(pcDebt({asOf:2026*12+9-10})));const before=await saved(page);await page.locator('[data-debt-id="debt"] .plan-item-open').click();const sheet=debtSheet(page,"es");for(const key of ["balance","monthly","day","months","apr"])await expect(sheet.locator('[data-debt-field="'+key+'"]')).toBeDisabled();await expect(sheet.getByText(finishedHints.es,{exact:true})).toBeVisible();await sheet.locator('[data-debt-field="name"]').fill("Terminada corregida");await sheet.getByRole("button",{name:texts.es.saveDebt,exact:true}).click();await expect(sheet).toHaveCount(0);await expect.poll(async()=>(await saved(page)).debts[1].name).toBe("Terminada corregida");expect((await saved(page)).debts).toEqual([before.debts[0],{...before.debts[1],name:"Terminada corregida"}]);
});
test("R2: plazo sin cuotas restantes con saldo0 y balloon conserva borrador",async({page})=>{
 await open(page,"es",pcRows(pcDebt({value:2100,balloon:100})));const before=await saved(page);await page.locator('[data-debt-id="debt"] .plan-item-open').click();const sheet=debtSheet(page,"es");await sheet.locator('[data-debt-field="months"]').fill("4");await sheet.locator('[data-debt-field="balance"]').fill("0");await sheet.getByRole("button",{name:texts.es.saveDebt,exact:true}).click();await expect(sheet.getByRole("alert")).toHaveText(pcErrors.es);await expect(sheet.locator('[data-debt-field="months"]')).toHaveValue("4");await expect(sheet.locator('[data-debt-field="balance"]')).toHaveValue("0");expect((await saved(page)).debts).toEqual(before.debts);
});
// Rechazo de beta 4.26.139.1: «un suave parpadeo cuando se cierra solo». Medido fotograma a
// fotograma con la CPU a 4×: al Guardar la hoja desaparecía de golpe (sin bajar) y, en cualquier
// cierre —también en Apuntar—, el velo seguía al 28 % hasta desmontarse y la pantalla entera se
// aclaraba en un solo fotograma. Este guardián exige que la hoja baje y que el velo llegue ya
// desvanecido al último fotograma, en Deudas, Metas y en Apuntar como control.
for(const scenario of [{kind:"debt",how:"save"},{kind:"debt",how:"x"},{kind:"goal",how:"save"},{kind:"goal",how:"back"},{kind:"apuntar",how:"velo"}])test(`cierre de la hoja (${scenario.kind}, ${scenario.how}): baja y el velo se va con ella`,async({page})=>{
 const {kind,how}=scenario;
 await open(page,"es",reviewRows,true);if(kind==="goal")await page.getByRole("tab",{name:"Metas",exact:true}).click();
 if(kind==="apuntar")await page.locator(".botnav-fab").evaluate(b=>b.click());
 else await page.locator(kind==="debt"?'[data-debt-id="debt"] .plan-item-open':'[data-goal-id="goal"] .plan-item-open').evaluate(b=>b.click());
 await page.waitForFunction(()=>{const el=document.querySelector(".v4-sheet");return !!el&&getComputedStyle(el).transform==="none";},null,{timeout:10000});
 const cdp=await page.context().newCDPSession(page);await cdp.send("Emulation.setCPUThrottlingRate",{rate:4});
 await page.evaluate(()=>{const rec=window.__cierre=[],t0=performance.now();(function f(){const sh=document.querySelector(".v4-sheet"),bk=document.querySelector(".v4-sheet-back");
  const c=bk&&getComputedStyle(bk).backgroundColor.match(/[\d.]+/g).map(Number);
  rec.push({sheet:sh?Math.round(sh.getBoundingClientRect().top):null,alpha:c?(c.length>3?c[3]:1):null});if(performance.now()-t0<1500)requestAnimationFrame(f);})();});
 // Clics crudos: el de Playwright espera sondeando el DOM y falsea el ritmo de fotogramas.
 await page.evaluate(how=>{
  if(how==="save")document.querySelector(".plan-edit-sheet .btn-primary").click();
  if(how==="x")document.querySelector(".plan-edit-head button").click();
  if(how==="velo")document.querySelector(".v4-sheet-back").click();
  if(how==="back")history.back();
 },how);
 await expect(page.locator(".v4-sheet")).toHaveCount(0);await page.waitForTimeout(300);await cdp.send("Emulation.setCPUThrottlingRate",{rate:1});
 const rec=await page.evaluate(()=>window.__cierre),live=rec.filter(f=>f.sheet!=null);
 expect(rec[rec.length-1].sheet,"la hoja termina desmontada").toBeNull();
 expect(new Set(live.map(f=>f.sheet)).size,"la hoja baja en varios fotogramas, no desaparece de golpe").toBeGreaterThan(4);
 for(let i=1;i<live.length;i++)expect(live[i].alpha,"el velo nunca se oscurece al cerrar").toBeLessThanOrEqual(live[i-1].alpha+0.001);
 expect(live[live.length-1].alpha,"el velo ya se ha ido cuando se desmonta").toBeLessThanOrEqual(0.03);
 if(kind!=="apuntar"&&how==="save")await expect(page.getByText(texts.es.saved,{exact:true})).toHaveCount(1);
});
