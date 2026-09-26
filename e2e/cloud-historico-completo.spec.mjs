import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

const uuid=n=>"00000000-0000-4000-8000-"+n.toString(16).padStart(12,"0");
const rows=Array.from({length:2501},(_,i)=>({id:uuid(i+1),fecha:"2020-01-01T12:00:00Z",importe:i+1,
  comercio:i===0?"Archivo antiguo FIN07":"Histórico "+i,cat:"otros",source:"manual:sabadell",nota:"Concepto "+i}));
const local={id:uuid(9999),date:"2019-01-01T12:00:00.000Z",amount:5,merchant:"Solo local FIN07",category:"otros",source:"manual",ent:"sabadell"};

async function setup(page,{fail=false}={}){
  await seedLoggedInDashboard(page,{__seedOnce:true,expenses:[local],
    accounts:[{id:"s",ent:"sabadell",name:"Sabadell",value:500,role:"diario",spendFrom:true}],
    settings:{autoPrices:false,theme:"green",expenseBanks:["sabadell"]},__cloudRows:{expenses:rows}});
  await page.addInitScript(({fail})=>{
    const seed=JSON.parse(localStorage.getItem("micartera_v3"));
    localStorage.setItem("micartera_v3_exp",JSON.stringify(seed.expenses));
    delete seed.expenses;localStorage.setItem("micartera_v3",JSON.stringify(seed));
    window.__fin07={fail,queries:[],writes:[]};
    const raw=localStorage.setItem.bind(localStorage);
    localStorage.setItem=(k,v)=>{if(k==="micartera_v3_exp")window.__fin07.writes.push(JSON.parse(v).length);return raw(k,v);};
    const descriptor=Object.getOwnPropertyDescriptor(window,"supabase");
    Object.defineProperty(window,"supabase",{configurable:true,get:descriptor.get,set(lib){
      descriptor.set(lib);
      const mock=descriptor.get();if(!mock?.createClient)return;
      const create=mock.createClient;
      mock.createClient=()=>{
        const sb=create(),from=sb.from;
        sb.from=t=>{
          if(t!=="expenses")return from(t);
          const chain=from(t),lt=chain.lt,limit=chain.limit,then=chain.then;
          let cursor=null,read=true;
          for(const method of ["upsert","update","delete"]){const original=chain[method];chain[method]=(...args)=>{read=false;return original(...args);};}
          chain.lt=(k,v)=>{if(k==="id")cursor=v;return lt(k,v);};
          chain.limit=n=>limit(Math.min(n,317)); // Límite distinto del solicitado, a propósito.
          chain.then=resolve=>{
            if(!read)return then(resolve);
            window.__fin07.queries.push(cursor);
            if(window.__fin07.fail&&cursor){resolve({data:null,error:{message:"offline página 2"}});return;}
            return then(resolve);
          };
          return chain;
        };
        return sb;
      };
    }});
  },{fail});
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible();
  await dismissNews(page);
}
const expenses=page=>page.evaluate(()=>JSON.parse(localStorage.getItem("micartera_v3_exp")||"[]"));

test("FIN07: más de 2000, histórico antiguo en Gastos y guardado una sola vez",async({page})=>{
  await setup(page);
  await expect.poll(async()=> (await expenses(page)).length).toBe(2502);
  const out=await expenses(page);
  expect(new Set(out.map(r=>r.id)).size).toBe(2502);
  expect(out.find(r=>r.id===uuid(1))).toMatchObject({merchant:"Archivo antiguo FIN07",note:"Concepto 0",amount:1});
  expect(out.find(r=>r.id===local.id)).toEqual(local);
  expect(await page.evaluate(()=>window.__fin07.queries.length)).toBe(9);
  // La carga inicial guarda su copia local; la descarga completa produce una sola escritura más.
  expect(await page.evaluate(()=>window.__fin07.writes)).toEqual([1,2502]);
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await page.locator(".v4-period-btn").last().click();
  await page.getByRole("button",{name:"Todo",exact:true}).click();
  await page.locator(".searchbar-in").fill("Archivo antiguo FIN07");
  const hit=page.locator(".v4-gastos-list-body button.v4-mov");
  await expect(hit).toHaveCount(1);await expect(hit).toContainText("Archivo antiguo FIN07");
  await expect(hit).toContainText("Concepto 0");
  const before=await page.evaluate(()=>window.__fin07.queries.length);
  await page.evaluate(()=>document.dispatchEvent(new Event("visibilitychange")));
  await expect.poll(()=>page.evaluate(()=>window.__fin07.queries.length)).toBeGreaterThan(before);
  await page.waitForFunction(n=>window.__fin07.queries.length>=n+9,before);
  expect(await page.evaluate(()=>window.__fin07.writes)).toEqual([1,2502]);
  expect(await expenses(page)).toEqual(out);
});
test("FIN07: fallo de página mantiene histórico local; reintento recupera todo",async({page})=>{
  await setup(page,{fail:true});
  await expect.poll(()=>page.evaluate(()=>window.__fin07.queries.length)).toBe(2);
  expect(await expenses(page)).toEqual([local]);
  expect(await page.evaluate(()=>window.__fin07.writes)).toEqual([1]);
  await page.evaluate(()=>{window.__fin07.fail=false;document.dispatchEvent(new Event("visibilitychange"));});
  await expect.poll(async()=> (await expenses(page)).length,{timeout:15000}).toBe(2502);
  expect(new Set((await expenses(page)).map(r=>r.id)).size).toBe(2502);
  expect(await page.evaluate(()=>window.__fin07.writes)).toEqual([1,2502]);
});
