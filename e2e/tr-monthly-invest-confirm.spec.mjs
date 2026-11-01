import {test,expect} from "@playwright/test";
import fs from "node:fs";
import {seedLoggedInDashboard,dismissNews} from "./fixtures.mjs";

const id="550e8400-e29b-41d4-a716-446655440000", now=Date.parse("2026-11-04T12:00:00Z");
const row=(note="")=>({id,date:"2026-11-03T12:00:00.000Z",amount:50,merchant:"Movimiento",obName:"Movimiento",note,category:"otros",source:"ob",ent:"trade_republic",obAcc:"tr-synthetic",extId:"monthly-ref"});
const remote=e=>({id:e.id,user_id:"e2e-user",fecha:e.date,importe:e.amount,comercio:e.merchant,cat:e.category,source:"ob:trade_republic#refmonthly-ref#acctr-synthetic",nota:e.note||null,ob_name:e.obName});
async function open(page,note=""){
  test.info().annotations.push({type:"own-clock",description:"November confirmation followed by December bank row"});
  await page.addInitScript(epoch=>{const Native=Date,offset=epoch-Native.now();class MonthlyDate extends Native{constructor(...args){super(...(args.length?args:[Native.now()+offset]))}static now(){return Native.now()+offset}};window.Date=MonthlyDate;},now);
  const e=row(note);
  await seedLoggedInDashboard(page,{__seedOnce:true,user:{id:"e2e-user",email:"e2e@test.local"},_historyOwner:"e2e-user",_fixMovInvasion2:true,
    accounts:[{id:"tr",ent:"trade_republic",role:"diario",spendFrom:true,value:950}],expenses:[e],
    bankTx:[{id:"monthly-ref",ent:e.ent,acc:e.obAcc,date:"2026-11-03",amount:50,merchant:"Movimiento",note,card:false,status:"BOOK"}],
    settings:{autoPrices:false,theme:"green",expenseBanks:["trade_republic"],brokersOn:["trade_republic"]},hasBankLink:true,
    investments:[{id:"fund",ent:"trade_republic",name:"Vanguard FTSE All-World",shares:10.5,value:1050,cost:950,cur:"EUR"}],trAnchor:"2026-11",
    __cloudRows:{expenses:[remote(e)],bank_links:[{aspsp_name:"Trade Republic",aspsp_country:"DE",status:"active",valid_until:"2027-01-01T00:00:00Z",accounts:[{uid:"tr-synthetic"}]}]}});
  // El fixture común no ejecuta CAS de expenses: este doble acotado sí devuelve la fila escrita.
  await page.route("**/vendor/supabase.min.js",async route=>{
    const source=fs.readFileSync(new URL("../public/vendor/supabase.min.js",import.meta.url),"utf8");
    const hook=`;(()=>{const saved=sessionStorage.getItem("monthly-synthetic-server");if(saved)Object.assign(window.__e2eCloudRows,JSON.parse(saved));const persist=()=>sessionStorage.setItem("monthly-synthetic-server",JSON.stringify(window.__e2eCloudRows));const library=window.supabase,create=library.createClient;library.createClient=function(){const client=create(),from=client.from;(window.__monthlyClients||(window.__monthlyClients=[])).push(client);
      client.from=function(table){
        if(table!=="expenses"&&table!=="app_state")return from(table);
        let patch=null,insert=null,filters=[],columns="*";
        const all=()=>window.__e2eCloudRows[table]||(window.__e2eCloudRows[table]=[]);
        const rows=()=>all().filter(r=>filters.every(([k,v])=>(r[k]??null)===v));
        const selected=rows=>rows.map(r=>columns==="*"?{...r}:Object.fromEntries(columns.split(",").map(k=>[k,r[k]])));
        const q={select(v="*"){columns=v;return q},eq(k,v){filters.push([k,v]);return q},is(k,v){filters.push([k,v]);return q},order(){return q},limit(){return q},lt(){return q},
          insert(v){insert=v;return q},update(v){patch=v;return q},async maybeSingle(){return {data:rows().length===1?selected(rows())[0]:null,error:null}},
          then(resolve){let found=rows();
            if(insert){if(all().some(r=>r.user_id===insert.user_id))return resolve({data:null,error:{code:"23505"}});const row=JSON.parse(JSON.stringify(insert));all().push(row);found=[row];}
            if(patch){if(table==="expenses")(window.__monthlyUpdates||(window.__monthlyUpdates=[])).push({patch,filters});
              if(table==="expenses"&&window.__monthlyReject)found=[];else found.forEach(r=>Object.assign(r,JSON.parse(JSON.stringify(patch))));}
            if(table==="app_state"&&(insert||patch&&found.length))window.__e2eStateWrites=(window.__e2eStateWrites||0)+1;
            persist();return resolve({data:selected(found),error:null});}};return q};
      const invoke=client.functions.invoke;client.functions.invoke=(name,opts)=>name==="bank-sync"&&window.__monthlyFeed?Promise.resolve(window.__monthlyFeed):invoke(name,opts);return client};})();`;
    await route.fulfill({contentType:"application/javascript",body:source+hook});
  });
  await page.route("https://**",route=>route.abort());
  await page.goto("/");await expect(page.locator(".botnav")).toBeVisible();await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await page.locator("button.v4-mov").filter({hasText:"Movimiento"}).first().click();
  await expect(page.getByTestId("tr-monthly-proposal")).toBeVisible();
}
const saved=page=>page.evaluate(()=>JSON.parse(localStorage.getItem("micartera_v3_exp")));
test("genérico: cancelar no cambia y confirmar solo esa fila, durable al recargar",async({page})=>{
  await open(page);
  await page.getByTestId("tr-monthly-confirm").click();
  await page.getByRole("button",{name:"Cancelar",exact:true}).last().click();
  expect((await saved(page))[0].category).toBe("otros");
  await page.getByTestId("tr-monthly-confirm").click();await page.getByRole("button",{name:"Confirmar inversión",exact:true}).click();
  await expect.poll(async()=>(await saved(page))[0].category).toBe("inversion");
  const result=await page.evaluate(()=>({main:JSON.parse(localStorage.getItem("micartera_v3")),updates:window.__monthlyUpdates}));
  expect(result.updates).toHaveLength(1);expect(result.updates[0].patch).toEqual({cat:"inversion"});
  expect(result.main.settings.trMonthlyInvestRecognition).toBeUndefined();expect(result.main.investments[0].value).toBe(1050);expect(result.main.accounts[0].value).toBe(950);
  await page.reload();await expect(page.locator(".botnav")).toBeVisible();expect((await saved(page))[0].category).toBe("inversion");
});
test("ACK cero no activa categoría ni regla",async({page})=>{
  await open(page,"Plan de inversión Vanguard FTSE All-World");await page.evaluate(()=>window.__monthlyReject=true);
  await page.getByTestId("tr-monthly-confirm").click();await page.getByRole("button",{name:"Confirmar inversión",exact:true}).click();
  await expect(page.locator(".toast")).toContainText("No se ha podido confirmar");expect((await saved(page))[0].category).toBe("otros");
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("micartera_v3")).settings.trMonthlyInvestRecognition)).toBeUndefined();
});
test("semántico: consentimientoNov4 durable y syncDec3 clasifica sin comprar dos veces",async({page})=>{
  await open(page,"Plan de inversión Vanguard FTSE All-World");
  await page.getByTestId("tr-monthly-confirm").click();await page.getByRole("button",{name:"Confirmar inversión",exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("micartera_v3")).settings.trMonthlyInvestRecognition?.enabled)).toBe(true);
  await page.reload();await expect(page.locator(".botnav")).toBeVisible();await page.waitForFunction(()=>!!JSON.parse(localStorage.getItem("micartera_v3")).lastSync);
  await expect.poll(async()=>(await saved(page))[0].category).toBe("inversion");
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem("micartera_v3")).investments);
  await page.evaluate(()=>{
    const Native=Date,epoch=Date.parse("2026-12-04T12:00:00Z");class DecemberDate extends Native{constructor(...args){super(...(args.length?args:[epoch]))}static now(){return epoch}};window.Date=DecemberDate;
    window.__monthlyFeed={data:{ok:true,links:[{aspsp:"Trade Republic",ok:true,accounts:[{uid:"tr-synthetic",ok:true,balances:[],transactions:[{ext_id:"dec-ref",date:"2026-12-03",amount:50,merchant:"Movimiento",note:"Plan de inversión Vanguard FTSE All-World",card:false,status:"BOOK"}]}]}]},error:null};
    cloud.bankSync=async function(){window.__monthlyBankCalled=(window.__monthlyBankCalled||0)+1;return window.__monthlyFeed.data;};
    window.dispatchEvent(new CustomEvent("mc-bank-role-changed"));
  });
  await expect.poll(async()=>(await saved(page)).find(e=>e.extId==="dec-ref")?.category,{timeout:15000}).toBe("inversion");
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("micartera_v3")).investments)).toEqual(before);
});
