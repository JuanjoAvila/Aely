import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, FIXTURE_NOW, installFixtureClock } from "./fixtures.mjs";
const day=new Date(FIXTURE_NOW).toISOString().slice(0,10);
const notice={id:"a1000000-0000-4000-8000-000000000001",date:day+"T08:00:00Z",merchant:"Compra sintética",amount:12,category:"otros",source:"macrodroid",ent:"trade_republic"};
const bank={id:"b1000000-0000-4000-8000-000000000001",date:day+"T12:00:00Z",merchant:"Movimiento",amount:12,category:"otros",source:"ob",ent:"trade_republic",possibleDup:true,possibleDupOf:notice.id};
const rows=page=>page.locator(".v4-gastos-list-body button.v4-mov");
async function open(page,manual=false){
  await installFixtureClock(page);
  await seedLoggedInDashboard(page,{
    __seedOnce:true,
    accounts:[{id:"tr",ent:"trade_republic",role:"diario",value:900}],
    settings:{autoPrices:false,theme:"green",expenseBanks:["trade_republic"]},
    expenses:[Object.assign({},notice,manual?{source:"manual"}:{}),bank],gemelos:[],
  });
  await page.goto("/");await expect(page.locator(".botnav")).toBeVisible();await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
}
test("migra al abrir: una fila sin pregunta; separar muestra ambas y sobrevive al reinicio",async({page})=>{
  await open(page);
  await expect(rows(page)).toHaveCount(1);
  await rows(page).filter({hasText:"Compra sintética"}).click();
  await expect(page.getByTestId("exp-auto-paired")).toBeVisible();
  await expect(page.getByRole("button",{name:/^Es el mismo$/})).toHaveCount(0);
  await page.getByTestId("exp-auto-separate").click();
  await expect(rows(page)).toHaveCount(2);
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("micartera_v3")||"{}").gemelos?.some(g=>g.separado))).toBe(true);
  await page.reload();await expect(page.locator(".botnav")).toBeVisible();await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await expect(rows(page)).toHaveCount(2);
});
test("un gasto manual conserva la pregunta en su ficha bancaria",async({page})=>{
  await open(page,true);await expect(rows(page)).toHaveCount(2);
  await rows(page).filter({hasText:"Movimiento"}).click();
  await expect(page.getByRole("button",{name:/^Es el mismo$/})).toBeVisible();
  await expect(page.getByTestId("exp-auto-separate")).toHaveCount(0);
});

const links=[{aspsp_name:"Trade Republic",aspsp_country:"DE",status:"active",valid_until:"2027-01-01T00:00:00Z",accounts:[{uid:"tr-e2e"}]}];
const response=n=>({data:{ok:true,links:[{aspsp:"Trade Republic",ok:true,accounts:[{uid:"tr-e2e",ok:true,balances:[],transactions:Array.from({length:n},()=>({date:day,amount:12,merchant:"Movimiento",status:"BOOK"}))}]}]},error:null});
async function bankApp(page,expenses,n,merchant){
 const feed=response(n);if(merchant)feed.data.links[0].accounts[0].transactions.forEach(t=>{t.merchant=merchant;});
 await installFixtureClock(page);
 await seedLoggedInDashboard(page,{__seedOnce:true,accounts:[{id:"tr",ent:"trade_republic",role:"diario",value:900}],settings:{autoPrices:false,theme:"green",expenseBanks:["trade_republic"]},hasBankLink:true,expenses,gemelos:[],__cloudRows:{bank_links:links},__cloudFns:{"bank-sync":feed}});
 await page.goto("/");await expect(page.locator(".botnav")).toBeVisible();await dismissNews(page);
 await page.evaluate(()=>{
   window.__pairWrites=[];
   const add=cloud.addExpense;cloud.addExpense=function(e){window.__pairWrites.push({kind:"add",id:e.id,key:keyOfExpense(e),source:expenseSourceForCloud(e)});return add.call(cloud,e);};
   const dup=cloud.setExpenseDup;cloud.setExpenseDup=function(e,value){window.__pairWrites.push({kind:"dup",id:e.id,value});return dup.call(cloud,e,value);};
 });
}
const saved=page=>page.evaluate(()=>JSON.parse(localStorage.getItem("micartera_v3_exp")||"[]"));
const syncBank=page=>page.evaluate(()=>window.dispatchEvent(new CustomEvent("mc-bank-role-changed")));
test("sync real une el aviso, sube #dup y separar/volver a unir escribe la decision",async({page})=>{
 await bankApp(page,[notice],2);await syncBank(page);
 await expect.poll(async()=>(await saved(page)).length).toBe(3);
 await page.locator('.botnav-tab[data-tour="gastos"]').click();await expect(rows(page)).toHaveCount(2);
 await expect.poll(()=>page.evaluate(()=>new Set(window.__pairWrites.filter(x=>x.kind==="add"&&x.source.includes("#dup")).map(x=>x.key)).size)).toBe(1);
 await rows(page).filter({hasText:"Compra sintética"}).click();await expect(page.getByTestId("exp-auto-paired")).toBeVisible();
 await expect(page.getByRole("button",{name:/^Es el mismo$/})).toHaveCount(0);
 await page.getByTestId("exp-auto-separate").click();await expect(rows(page)).toHaveCount(3);
 await expect.poll(()=>page.evaluate(()=>window.__pairWrites.some(x=>x.kind==="dup"&&x.value===false))).toBe(true);
 await rows(page).filter({hasText:"Compra sintética"}).click();await page.getByTestId("exp-auto-rejoin").click();await expect(rows(page)).toHaveCount(2);
 await expect.poll(()=>page.evaluate(()=>window.__pairWrites.some(x=>x.kind==="dup"&&x.value===true))).toBe(true);
 await syncBank(page);await expect.poll(async()=>(await saved(page)).length).toBe(3);await expect(rows(page)).toHaveCount(2);
});
test("pull real empareja aviso tardio y repara la marca bancaria en nube",async({page})=>{
 await bankApp(page,[],1);await syncBank(page);await expect.poll(async()=>(await saved(page)).length).toBe(1);
 await page.locator('.botnav-tab[data-tour="gastos"]').click();await expect(rows(page)).toHaveCount(1);
 await page.evaluate(n=>{
   const b=JSON.parse(localStorage.getItem("micartera_v3_exp"))[0];
   window.__e2eCloudRows.expenses=[{id:b.id,fecha:b.date,importe:b.amount,comercio:b.merchant,source:expenseSourceForCloud(b),cat:b.category,ob_name:b.obName},{id:n.id,fecha:n.date,importe:n.amount,comercio:n.merchant,source:"macrodroid",cat:"otros"}];
   document.dispatchEvent(new Event("visibilitychange"));
 },notice);
 await expect.poll(async()=>(await saved(page)).filter(e=>e.autoGemelo).length).toBe(1);
 await expect(rows(page)).toHaveCount(1);await expect(rows(page)).toContainText("Compra sintética");
 await expect.poll(()=>page.evaluate(()=>window.__pairWrites.some(x=>x.kind==="dup"&&x.value===true))).toBe(true);
});
test("borrar la pareja explica ambas filas y Deshacer restaura ambas",async({page})=>{
 await open(page);await rows(page).first().click();
 await page.getByRole("button",{name:/borrar/i}).last().click();
 await page.locator('[aria-labelledby="ask-dialog-title"]').getByRole("button",{name:"Borrar",exact:true}).click();
 await expect(page.getByText("Aviso y apunte del banco borrados")).toBeVisible();
 await expect.poll(async()=>(await saved(page)).length).toBe(0);
 await page.getByRole("button",{name:/^Deshacer$/}).click();await expect(rows(page)).toHaveCount(1);
 await expect.poll(async()=>(await saved(page)).length).toBe(2);
});


test("sync real conserva el apunte con comercio real y no oculta dinero por importe igual",async({page})=>{
 await bankApp(page,[notice],1,"COMERCIO IDENTIFICADO SL");await syncBank(page);
 await expect.poll(async()=>(await saved(page)).length).toBe(2);
 await page.locator('.botnav-tab[data-tour="gastos"]').click();await expect(rows(page)).toHaveCount(2);
 await expect(rows(page).filter({hasText:"COMERCIO IDENTIFICADO SL"})).toHaveCount(1);
 await expect(rows(page).filter({hasText:"Compra sintética"})).toHaveCount(1);
 expect((await saved(page)).filter(e=>e.possibleDup||e.autoGemelo)).toHaveLength(0);
 expect(await page.evaluate(()=>window.__pairWrites.filter(x=>x.kind==="add"&&x.source.includes("#dup")).length)).toBe(0);
 await syncBank(page);await expect(rows(page)).toHaveCount(2);
});

const spentCents=page=>page.evaluate(()=>{
 const s=JSON.parse(localStorage.getItem("micartera_v3")||"{}");s.expenses=JSON.parse(localStorage.getItem("micartera_v3_exp")||"[]");
 return s.expenses.filter(e=>expenseCountsBudget(e,s)).reduce((n,e)=>n+Math.round(e.amount*100),0);
});
test("NO-GO 1: borrar pareja y recibir otro pago igual no duplica el gastado",async({page})=>{
 await bankApp(page,[notice],1);await syncBank(page);await expect.poll(async()=>(await saved(page)).length).toBe(2);
 await page.locator('.botnav-tab[data-tour="gastos"]').click();await rows(page).first().click();
 await page.getByRole("button",{name:/borrar/i}).last().click();await page.locator('[aria-labelledby="ask-dialog-title"]').getByRole("button",{name:"Borrar",exact:true}).click();
 await expect.poll(async()=>(await saved(page)).length).toBe(0);expect(await spentCents(page)).toBe(0);
 const second={...notice,id:"a1000000-0000-4000-8000-000000000002",merchant:"Segundo pago sintético"};
 await page.evaluate(({n,feed})=>{
  cloud.bankSync=async()=>feed.data;
  window.__e2eCloudRows.expenses=[{id:n.id,fecha:n.date,importe:n.amount,comercio:n.merchant,cat:n.category,source:"macrodroid"}];
  document.dispatchEvent(new Event("visibilitychange"));
 },{n:second,feed:response(2)});
 await expect.poll(async()=>(await saved(page)).some(e=>e.id===second.id)).toBe(true);
 await syncBank(page);await expect.poll(async()=>(await saved(page)).length).toBe(2);
 await expect(rows(page)).toHaveCount(1);await expect(rows(page)).toContainText("Segundo pago sintético");expect(await spentCents(page)).toBe(1200);
});
test("NO-GO 2: refresh real sin #dup conserva una fila y repara la nube",async({page})=>{
 await bankApp(page,[notice],1);await syncBank(page);await expect.poll(async()=>(await saved(page)).length).toBe(2);
 await page.locator('.botnav-tab[data-tour="gastos"]').click();await expect(rows(page)).toHaveCount(1);
 await page.evaluate(()=>{
  const list=JSON.parse(localStorage.getItem("micartera_v3_exp"));window.__pairWrites=[];
  window.__e2eCloudRows.expenses=list.map(e=>({id:e.id,fecha:e.date,importe:e.amount,comercio:e.merchant,cat:e.category,ob_name:e.obName,source:e.source==="ob"?"ob:trade_republic":"macrodroid"}));
  document.dispatchEvent(new Event("visibilitychange"));
 });
 await expect.poll(()=>page.evaluate(()=>window.__pairWrites.some(x=>x.kind==="dup"&&x.value===true))).toBe(true);
 await expect(rows(page)).toHaveCount(1);expect(await spentCents(page)).toBe(1200);
 await rows(page).first().click();await expect(page.getByTestId("exp-auto-paired")).toBeVisible();
});
test("NO-GO 3: otro móvil vuelve a unir antes del refresco de gastos con tabla atrasada",async({page})=>{
 await bankApp(page,[notice],1);await syncBank(page);await expect.poll(async()=>(await saved(page)).length).toBe(2);
 await page.locator('.botnav-tab[data-tour="gastos"]').click();await rows(page).first().click();await page.getByTestId("exp-auto-separate").click();await expect(rows(page)).toHaveCount(2);
 await expect.poll(()=>page.evaluate(()=>window.__pairWrites.some(x=>x.kind==="dup"&&x.value===false))).toBe(true);
 await expect.poll(async()=>(await saved(page)).filter(e=>e.gemeloSeparado===notice.id).length).toBe(1);
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("micartera_v3")).gemelos.some(g=>g.separado))).toBe(true);
 const remote=await page.evaluate(id=>{
  const s=JSON.parse(localStorage.getItem("micartera_v3"));s.expenses=JSON.parse(localStorage.getItem("micartera_v3_exp"));
  const joined=unirGemeloAutomatico(s,id,Date.now()+1000);
  window.__e2eCloudRows.app_state=[{data:slimForCloud(joined),updated_at:new Date().toISOString()}];
  window.__e2eCloudRows.expenses=s.expenses.map(e=>({id:e.id,fecha:e.date,importe:e.amount,comercio:e.merchant,cat:e.category,ob_name:e.obName,source:expenseSourceForCloud(e)}));
  window.__pairReads=[];window.__pairWrites=[];
  const state=cloud.pullState,expenses=cloud.pullExpenses;
  cloud.pullState=function(){window.__pairReads.push("state");return state.apply(cloud,arguments);};
  cloud.pullExpenses=function(){window.__pairReads.push("expenses");return expenses.apply(cloud,arguments);};
  document.dispatchEvent(new Event("visibilitychange"));
  return {paired:joined.expenses.filter(e=>e.autoGemelo===id).length,decisions:joined.gemelos.map(g=>({at:g.at,separado:!!g.separado,auto:!!g.auto}))};
 },notice.id);
 expect(remote.paired).toBe(1);expect(remote.decisions.some(g=>g.auto&&!g.separado)).toBe(true);
 await expect(rows(page)).toHaveCount(1);await expect.poll(()=>page.evaluate(()=>window.__pairWrites.some(x=>x.kind==="dup"&&x.value===true))).toBe(true);
 await expect.poll(()=>spentCents(page)).toBe(1200);
 expect(await page.evaluate(()=>window.__pairReads.slice(0,2))).toEqual(["state","expenses"]);
 expect(await page.evaluate(()=>window.__pairWrites.filter(x=>x.kind==="dup"&&x.value===false).length)).toBe(0);
});
