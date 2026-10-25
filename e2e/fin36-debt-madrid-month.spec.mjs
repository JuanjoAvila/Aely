import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

test.describe.configure({retries:0});
test.use({serviceWorkers:"block"});
const cases=[
  {iso:"2026-09-30T22:30:00Z",today:"2026-10-01",before:"2026-09-30",month:2026*12+9},
  {iso:"2026-11-30T23:30:00Z",today:"2026-12-01",before:"2026-11-30",month:2026*12+11},
  {iso:"2026-12-31T23:30:00Z",today:"2027-01-01",before:"2026-12-31",month:2027*12},
];
for(const tz of ["UTC","Europe/Madrid","America/Los_Angeles"])test.describe(tz,()=>{
  test.use({timezoneId:tz});
  for(const sample of cases)for(const day of [5,1])test(sample.today+" cargo"+day+": alta real, Plan y gráfica Inicio",{annotation:{type:"own-clock",description:sample.iso}},async({page},info)=>{
    await page.route("**/*",r=>new URL(r.request().url()).hostname==="127.0.0.1"?r.continue():r.abort());
    await page.addInitScript(iso=>{
      const NativeDate=Date,epoch=NativeDate.parse(iso),offset=epoch-NativeDate.now();
      function FixtureDate(...args){const values=args.length?args:[NativeDate.now()+offset];return new.target?Reflect.construct(NativeDate,values,new.target):new NativeDate(NativeDate.now()+offset).toString();}
      Object.setPrototypeOf(FixtureDate,NativeDate);FixtureDate.prototype=NativeDate.prototype;FixtureDate.now=()=>NativeDate.now()+offset;window.Date=FixtureDate;
    },sample.iso);
    await seedLoggedInDashboard(page,{__seedOnce:true,_dynBalAnchored:true,accounts:[{id:"cash",ent:"efectivo",value:5000,role:"fijos"}],debts:[],accountBalanceHistory:{"acc:cash":[{day:sample.before,value:5000}]},investments:[],assets:[],expenses:[],flows:[],fixed:[],oneoffs:[],obAccounts:[],settings:{lang:"es",autoPrices:false,theme:"green"}});
    const response=await page.goto("/");
    if(process.env.FIN36_HTML_SHA256)expect(response.headers()["x-fin36-html-sha256"]).toBe(process.env.FIN36_HTML_SHA256);
    await page.waitForFunction(()=>!document.getElementById("mc-load")&&window.__mcBootReady);await dismissNews(page);
    const hero=page.getByTestId("inicio-net-current"),amount=hero.locator(".v4-hero-amt");await expect(amount).toContainText("5000,00 €");
    await page.locator('.botnav-tab[data-tour="plan"]').click();await page.getByRole("tab",{name:"Deudas",exact:true}).click();await page.getByRole("button",{name:"Añadir deuda",exact:true}).click();
    const form=page.locator(".add-form");await form.getByPlaceholder("Concepto (ej. Financiación móvil)",{exact:true}).fill("Deuda FIN36 sintética");await form.getByPlaceholder("Importe €",{exact:true}).fill("1000");await form.getByPlaceholder("Cuota/mes € (vacío si 0%)",{exact:true}).fill("100");await form.getByPlaceholder("Plazo (meses)",{exact:true}).fill("10");await form.getByPlaceholder("Día",{exact:true}).fill(String(day));await form.getByRole("button",{name:"Añadir deuda",exact:true}).click();
    const expectedBalance=day===1?"900,00 €":"1000,00 €",current=day===1?"4100,00 €":"4000,00 €";
    await expect(page.locator(".v4-debt-bal")).toContainText(expectedBalance);
    await expect(page.locator(".plan-summary").filter({has:page.getByText("Debes en total",{exact:true})}).locator(".plan-summary-amount")).toContainText(expectedBalance);
    const stored=()=>page.evaluate(()=>JSON.parse(localStorage.getItem("micartera_v3")).debts);
    await expect.poll(async()=> (await stored()).length).toBe(1);const debts=await stored();
    expect(debts[0]).toMatchObject({value:1000,monthly:100,amort:100,months:10,day,asOf:sample.month,startMonth:sample.month,startDay:sample.today});
    await page.locator('.botnav-tab[data-tour="inicio"]').click();await expect(amount).toContainText(current);
    await hero.locator(".v42-net-ranges button").last().click();
    const box=await hero.locator(".v42-net-chart svg").boundingBox(),cdp=await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x:box.x+box.width*4/320,y:box.y+35}]});
    await expect(hero.getByTestId("inicio-net-date")).toContainText(new RegExp("^"+Number(sample.before.slice(-2))+"\\b"));await expect(amount).toContainText("5000,00 €");
    await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});await expect(amount).toContainText(current);await cdp.detach();
    await page.reload();await page.waitForFunction(()=>!document.getElementById("mc-load")&&window.__mcBootReady);await dismissNews(page);await expect(amount).toContainText(current);expect(await stored()).toEqual(debts);
    await info.attach("fin36-money.json",{body:JSON.stringify({tz,...sample,day,expectedBalance,current,debts},null,2),contentType:"application/json"});
  });
});
