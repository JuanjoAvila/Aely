import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

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
  const hero=page.getByTestId("inicio-net-current"),amount=hero.locator(".v4-hero-amt"),current=reanchored?"4400,10 €":"4450,11 €";
  await expect(amount).toContainText(current);
  await hero.locator(".v42-net-ranges button").last().click();
  const box=await hero.locator(".v42-net-chart svg").boundingBox(),cdp=await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x:box.x+box.width*4/320,y:box.y+35}]});
  await expect(hero.getByTestId("inicio-net-date")).toContainText(/^15\b/);
  await expect(amount).toContainText("4400,10 €");
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
  await expect(amount).toContainText("3150,00 €");
  await hero.locator(".v42-net-ranges button").last().click();
  const chart=hero.locator(".v42-net-chart svg"),box=await chart.boundingBox(),cdp=await page.context().newCDPSession(page);
  const samples=[];
  for(const [day,value] of [["2026-09-30","5000,13"],["2026-10-01","4400,10"],["2026-10-16","4450,11"],["2026-11-01","4090,02"],["2026-12-01","2969,97"],["2026-12-26","3150,00"]]){
    const fraction=(Date.parse(day)-Date.parse("2026-09-30"))/(Date.parse("2026-12-26")-Date.parse("2026-09-30"));
    await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x:box.x+box.width*(4+312*fraction)/320,y:box.y+35}]});
    await expect(hero.getByTestId("inicio-net-date")).toContainText(new RegExp("^"+Number(day.slice(-2))+"\\b"));
    await expect(amount).toContainText(value+" €");
    samples.push({day,shown:await amount.innerText()});
    await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
    await expect(amount).toContainText("3150,00 €");
  }
  await cdp.detach();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("micartera_v3")).debts)).toEqual(debts);
  await testInfo.attach("fin12-dom",{body:Buffer.from(JSON.stringify(samples)),contentType:"application/json"});
  await testInfo.attach("fin12-inicio",{body:await hero.screenshot({animations:"disabled"}),contentType:"image/png"});
});
