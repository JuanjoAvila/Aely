import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, esperaNubeQuieta } from "./fixtures.mjs";

test("FIN12 día: alta desde Plan y gráfico real antes, en y después, cuota y recarga",async({page},info)=>{
  await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  await page.addInitScript(()=>{
    const NativeDate=Date,epoch=Number(sessionStorage.getItem('__fin12now'))||Date.parse('2026-10-10T12:00:00Z'),offset=epoch-NativeDate.now();
    function FixtureDate(...args){const values=args.length?args:[NativeDate.now()+offset];return new.target?Reflect.construct(NativeDate,values,new.target):new NativeDate(NativeDate.now()+offset).toString();}
    Object.setPrototypeOf(FixtureDate,NativeDate);FixtureDate.prototype=NativeDate.prototype;FixtureDate.now=()=>NativeDate.now()+offset;window.Date=FixtureDate;
  });
  const accounts=[{id:'cash',ent:'efectivo',value:5000.13,role:'fijos'}];
  await seedLoggedInDashboard(page,{__seedOnce:true,_dynBalAnchored:true,accounts,debts:[],accountBalanceHistory:{'acc:cash':[{day:'2026-09-30',value:5000.13}]},investments:[],assets:[],expenses:[],flows:[],fixed:[],oneoffs:[],obAccounts:[],settings:{lang:'es',autoPrices:false,theme:'green'}});
  const response=await page.goto('/');if(process.env.FIN12_HTML_SHA256)expect(response.headers()['x-fin12-html-sha256']).toBe(process.env.FIN12_HTML_SHA256);
  await page.waitForFunction(()=>!document.getElementById('mc-load')&&window.__mcBootReady);await dismissNews(page);
  const hero=page.getByTestId('inicio-net-current'),amount=hero.locator('.v4-hero-amt');await expect(amount).toContainText('5.000,13 €');
  await page.locator('.botnav-tab[data-tour="plan"]').click();await page.getByRole('tab',{name:'Deudas',exact:true}).click();await page.getByRole('button',{name:'Añadir deuda',exact:true}).click();
  const form=page.locator('.add-form');await form.getByPlaceholder('Concepto (ej. Financiación móvil)',{exact:true}).fill('Compra FIN12 sintética');await form.getByPlaceholder('Importe €',{exact:true}).fill('600,12');await form.getByPlaceholder('Cuota/mes € (vacío si 0%)',{exact:true}).fill('50,01');await form.getByPlaceholder('Plazo (meses)',{exact:true}).fill('12');await form.getByPlaceholder('Día',{exact:true}).fill('16');await form.getByRole('button',{name:'Añadir deuda',exact:true}).click();
  const stored=()=>page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('micartera_v3'));return{debts:s.debts,accounts:s.accounts};});
  await expect.poll(async()=> (await stored()).debts.length).toBe(1);const before=await stored();expect(before.debts[0]).toMatchObject({value:600.12,monthly:50.01,amort:50.01,months:12,day:16});
  await page.locator('.botnav-tab[data-tour="inicio"]').click();await expect(amount).toContainText('4.400,01 €');
  const samples=[],cdp=await page.context().newCDPSession(page);
  async function point(day,current,today,expected){
    await hero.locator('.v42-net-ranges button').last().click();const box=await hero.locator('.v42-net-chart svg').boundingBox(),fraction=(Date.parse(day)-Date.parse('2026-09-30'))/(Date.parse(today)-Date.parse('2026-09-30'));
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width*(4+312*fraction)/320,y:box.y+35}]});await expect(hero.getByTestId('inicio-net-date')).toContainText(new RegExp('^'+Number(day.slice(-2))+'\\b'));await expect(amount).toContainText(expected+' €');samples.push({day,shown:await amount.innerText()});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await expect(amount).toContainText(current+' €');
  }
  await point('2026-10-09','4.400,01','2026-10-10','5.000,13');await point('2026-10-10','4.400,01','2026-10-10','4.400,01');
  expect(before.debts[0].startDay).toBe('2026-10-10');
  await page.evaluate(()=>sessionStorage.setItem('__fin12now',String(Date.parse('2026-10-20T12:00:00Z'))));await page.reload();await page.waitForFunction(()=>!document.getElementById('mc-load')&&window.__mcBootReady);await dismissNews(page);await expect(amount).toContainText('4.450,02 €');
  for(const [day,value]of [['2026-10-09','5.000,13'],['2026-10-10','4.400,01'],['2026-10-11','4.400,01'],['2026-10-15','4.400,01'],['2026-10-16','4.450,02'],['2026-10-17','4.450,02']])await point(day,'4.450,02','2026-10-20',value);
  expect(await stored()).toEqual(before);await cdp.detach();await info.attach('fin12-day-series.json',{body:JSON.stringify({samples,before,after:await stored()},null,2),contentType:'application/json'});await info.attach('fin12-day-chart.png',{body:await hero.screenshot({animations:'disabled'}),contentType:'image/png'});
});

test.use({timezoneId:"Europe/Madrid",serviceWorkers:"block"});
test.describe.configure({retries:0});
for(const reanchored of [false,true]) test("revision1: pasado conservado tras "+(reanchored?"reancla amort cero":"migración sin ancla"),{annotation:{type:"own-clock",description:"28/10/2026"}},async({page},testInfo)=>{
  await page.addInitScript(epoch=>{
    const NativeDate=Date,offset=epoch-NativeDate.now();
    function FixtureDate(...args){const values=args.length?args:[NativeDate.now()+offset];return new.target?Reflect.construct(NativeDate,values,new.target):new NativeDate(NativeDate.now()+offset).toString();}
    Object.setPrototypeOf(FixtureDate,NativeDate);FixtureDate.prototype=NativeDate.prototype;FixtureDate.now=()=>NativeDate.now()+offset;window.Date=FixtureDate;
  },Date.parse("2026-10-28T12:00:00Z"));
  const debt={id:"legacy",name:"Financiación heredada sintética",value:600.03,monthly:50.01,months:12,day:16,...(reanchored?{amort:0,asOf:2026*12+9}:{})};
  await seedLoggedInDashboard(page,{__seedOnce:true,_dynBalAnchored:true,accounts:[{id:"cash",ent:"efectivo",value:5000.13,role:"fijos"}],debts:[debt],
    accountBalanceHistory:{"acc:cash":[{day:"2026-08-15",value:5000.13}]},investments:[],assets:[],expenses:[],flows:[],fixed:[],oneoffs:[],obAccounts:[]});
  await page.goto("/");await page.waitForFunction(()=>!document.getElementById("mc-load"));await dismissNews(page);
  const hero=page.getByTestId("inicio-net-current"),amount=hero.locator(".v4-hero-amt"),current=reanchored?"4.400,10 €":"4.450,11 €";
  await expect(amount).toContainText(current);
  await hero.locator(".v42-net-ranges button").last().click();
  const box=await hero.locator(".v42-net-chart svg").boundingBox(),cdp=await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x:box.x+box.width*4/320,y:box.y+35}]});
  await expect(hero.getByTestId("inicio-net-date")).toContainText(/^15\b/);
  await expect(amount).toContainText("4.400,10 €");
  await testInfo.attach("revision1-pasado",{body:await hero.screenshot({animations:"disabled"}),contentType:"image/png"});
  await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});await expect(amount).toContainText(current);await cdp.detach();
});
test("financiaciones: el dedo muestra cero deuda antes del inicio y conserva hoy",{annotation:{type:"own-clock",description:"26/12/2026"}},async({page},testInfo)=>{
  await page.addInitScript(epoch=>{
    const NativeDate=Date,offset=epoch-NativeDate.now();
    function FixtureDate(...args){const values=args.length?args:[NativeDate.now()+offset];return new.target?Reflect.construct(NativeDate,values,new.target):new NativeDate(NativeDate.now()+offset).toString();}
    Object.setPrototypeOf(FixtureDate,NativeDate);FixtureDate.prototype=NativeDate.prototype;
    FixtureDate.now=()=>NativeDate.now()+offset;window.Date=FixtureDate;
  },Date.parse("2026-12-26T12:00:00Z"));
  const debts=[
    {id:"roomba",name:"Roomba sintética",value:600.03,monthly:50.01,months:12,day:16,asOf:2026*12+9,startMonth:2026*12+9},
    {id:"gym",name:"Gimnasio sintético",value:360.09,monthly:30.01,months:12,day:20,asOf:2026*12+10,startMonth:2026*12+10},
    {id:"floor",name:"Suelo sintético",value:1200.07,monthly:100.01,months:12,day:25,asOf:2026*12+11,startMonth:2026*12+11},
  ];
  await seedLoggedInDashboard(page,{__seedOnce:true,accounts:[{id:"cash",ent:"efectivo",value:5000.13,role:"fijos"}],debts,
    accountBalanceHistory:{"acc:cash":[{day:"2026-09-30",value:5000.13}]},investments:[],assets:[],expenses:[],flows:[],fixed:[],oneoffs:[],obAccounts:[]});
  await page.goto("/");await page.waitForFunction(()=>!document.getElementById("mc-load"));await dismissNews(page);
  const hero=page.getByTestId("inicio-net-current"),amount=hero.locator(".v4-hero-amt");
  await expect(amount).toContainText("3.150,00 €");
  await hero.locator(".v42-net-ranges button").last().click();
  const chart=hero.locator(".v42-net-chart svg"),box=await chart.boundingBox(),cdp=await page.context().newCDPSession(page);
  const samples=[];
  for(const [day,value] of [["2026-09-30","5.000,13"],["2026-10-01","4.400,10"],["2026-10-16","4.450,11"],["2026-11-01","4.090,02"],["2026-12-01","2.969,97"],["2026-12-26","3.150,00"]]){
    const fraction=(Date.parse(day)-Date.parse("2026-09-30"))/(Date.parse("2026-12-26")-Date.parse("2026-09-30"));
    await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x:box.x+box.width*(4+312*fraction)/320,y:box.y+35}]});
    await expect(hero.getByTestId("inicio-net-date")).toContainText(new RegExp("^"+Number(day.slice(-2))+"\\b"));
    await expect(amount).toContainText(value+" €");
    samples.push({day,shown:await amount.innerText()});
    await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
    await expect(amount).toContainText("3.150,00 €");
  }
  await cdp.detach();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("micartera_v3")).debts)).toEqual(debts);
  await testInfo.attach("fin12-dom",{body:Buffer.from(JSON.stringify(samples)),contentType:"application/json"});
  await testInfo.attach("fin12-inicio",{body:await hero.screenshot({animations:"disabled"}),contentType:"image/png"});
});


// Los controles y la prueba causal se ejecutan con las mismas fuentes ensambladas A/B y sin red externa.
const noDayCases=[
  ...[undefined,null,"",0,"inválido"].flatMap(day=>[1,15,31].map(today=>({label:"sin día "+String(day)+"/"+today,day,today,pending:true,unknown:true}))),
  {label:"día20 futuro",day:20,today:15,pending:true},
  {label:"día15 hoy",day:15,today:15,pending:false},
  {label:"día3 vencido",day:3,today:15,pending:false},
  {label:"día3 pagado real el2",day:3,today:2,pending:false,charge:60.01,chargeDay:2},
  {label:"día3 cargo parcial",day:3,today:2,pending:true,charge:15,chargeDay:2},
  {label:"día3 cargo futuro",day:3,today:2,pending:true,charge:60.01,chargeDay:4},
  {label:"sin día con vínculo BOOK",day:undefined,today:15,pending:true,unknown:true,charge:60.01,chargeDay:2,book:true},
  {label:"finalizada sin día",day:null,today:15,pending:false,finished:true},
];
for(const item of noDayCases)test("debt-no-day-r150: Inicio y Plan "+item.label,{annotation:{type:"own-clock",description:"Octubre 2026 Europe/Madrid"}},async({page},info)=>{
  const pageErrors=[];page.on("pageerror",error=>pageErrors.push(error.message));
  const iso="2026-10-"+String(item.today).padStart(2,"0")+"T12:00:00Z";
  await page.route("**/*",route=>new URL(route.request().url()).hostname==="127.0.0.1"?route.continue():route.abort());
  await page.addInitScript(epoch=>{
    const NativeDate=Date,offset=epoch-NativeDate.now();
    function FixtureDate(...args){const values=args.length?args:[NativeDate.now()+offset];return new.target?Reflect.construct(NativeDate,values,new.target):new NativeDate(NativeDate.now()+offset).toString();}
    Object.setPrototypeOf(FixtureDate,NativeDate);FixtureDate.prototype=NativeDate.prototype;FixtureDate.now=()=>NativeDate.now()+offset;window.Date=FixtureDate;
  },Date.parse(iso));
  const debt={id:"synthetic-loan",name:"Cuota sin día sintética",value:item.finished?0:12000.07,monthly:60.01,account:"sabadell",asOf:2026*12+9,
    ...(item.day===undefined?{}:{day:item.day}),...(item.finished?{months:1,settledAt:"2026-10-01",archivedAt:"2026-10-01"}:{})};
  const expenses=item.charge==null?[]:[{id:"synthetic-charge",merchant:"Prestamista sintético",obName:"Prestamista sintético",amount:item.charge,
    date:"2026-10-"+String(item.chargeDay).padStart(2,"0"),ent:"sabadell",category:"deudas",source:"ob",debtId:debt.id}];
  await seedLoggedInDashboard(page,{__seedOnce:true,_dynBalAnchored:true,accounts:[{id:"synthetic-daily",ent:"sabadell",value:800.13,role:"diario",spendFrom:true,inject:0,roundup:0,monthlyInvest:0}],
    debts:[debt],expenses,bankTx:item.book?expenses.map(x=>({...x,status:"BOOK"})):[],fixed:[],flows:[],oneoffs:[],investments:[],assets:[],aportaciones:[],obAccounts:[],deleted:[],
    settings:{lang:"es",autoPrices:false,theme:"green",expenseBanks:["sabadell"]}});
  const response=await page.goto("/");
  if(process.env.DEBT_SOURCE_SHA256)expect(response.headers()["x-debt-source-sha256"]).toBe(process.env.DEBT_SOURCE_SHA256);
  await page.waitForFunction(()=>!document.getElementById("mc-load")&&window.__mcBootReady);await dismissNews(page);await esperaNubeQuieta(page);
  const saved=()=>page.evaluate(()=>{const s=JSON.parse(localStorage.getItem("micartera_v3"));return{debts:s.debts,accounts:s.accounts,expensesJSON:localStorage.getItem("micartera_v3_exp")};});
  const before=await saved();expect(before.debts[0]).toMatchObject(debt);
  const current=page.locator('[data-testid="inicio-upcoming"][data-mes="este"] .v4-charge').filter({has:page.locator(".nm",{hasText:debt.name})});
  await info.attach("debt-source-and-inicio",{body:JSON.stringify({source:response.headers()["x-debt-source-sha256"]||null,item,current:await current.allTextContents(),pageErrors,before},null,2),contentType:"application/json"});
  expect(pageErrors).toEqual([]);
  await expect(current).toHaveCount(item.pending?1:0);
  if(item.pending){await expect(current.locator(".am")).toHaveText("60,01 €");await expect(current.locator(".dt .d")).toHaveText(item.unknown?"—":String(item.day).padStart(2,"0"));}
  await page.locator('.botnav-tab[data-tour="plan"]').click();await page.getByRole("tab",{name:"Recibos",exact:true}).click();
  const due=page.getByTestId("plan-due").locator('[data-recibo="debt_synthetic-loan"]');
  await expect(due).toHaveCount(item.pending?1:0);
  if(item.pending){await expect(due.locator(".am")).toHaveText("60,01 €");if(item.unknown)await expect(due.locator(".dt .d")).toHaveText("—");}
  await expect(page.getByTestId("plan-summary").locator(".pr6-big")).toHaveText(item.pending?"60,01 €":"0,00 €");
  expect(await saved()).toEqual(before);
  // La recarga conserva la nube confirmada: __seedOnce protege el disco local, no las filas del doble.
  await esperaNubeQuieta(page);
  const reloadCloudRows=await page.evaluate(()=>{
    const rows=window.__e2eCloudRows,row=rows.app_state?.[0];
    const local=JSON.parse(localStorage.getItem(mcStateKey())||"{}");
    if(!row||local._goalSync?.revision!==row.updated_at)throw new Error("La recarga requiere app_state confirmado");
    return JSON.parse(JSON.stringify(rows));
  });
  await page.addInitScript(rows=>{
    // addInitScript puede ir antes o después de la siembra: se rellena su objeto sin romper el alias del mock.
    function restore(target){Object.keys(target).forEach(key=>delete target[key]);Object.assign(target,JSON.parse(JSON.stringify(rows)));return target;}
    let current=window.__e2eCloudRows;if(current)restore(current);
    Object.defineProperty(window,"__e2eCloudRows",{configurable:true,enumerable:true,get(){return current;},set(value){current=restore(value);}});
  },reloadCloudRows);
  await page.reload();await page.waitForFunction(()=>!document.getElementById("mc-load")&&window.__mcBootReady);await dismissNews(page);await esperaNubeQuieta(page);
  expect(await saved()).toEqual(before);
  await page.locator('.botnav-tab[data-tour="inicio"]').click();await expect(current).toHaveCount(item.pending?1:0);
  if(item.pending&&item.unknown)await expect(current.locator(".dt .d")).toHaveText("—");
  expect(pageErrors).toEqual([]);
});
