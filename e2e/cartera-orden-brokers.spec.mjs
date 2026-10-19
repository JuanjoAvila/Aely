import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, installFixtureClock } from "./fixtures.mjs";

const investments = [
  {id:"br-a",ent:"revolut",name:"Acción sintética",ticker:"SYN",shares:2,value:900.13,cost:700.01,cur:"USD",account:"acc-r"},
  {id:"br-b",ent:"trade_republic",name:"Fondo sintético",shares:3,value:1500.22,cost:1200.02,cur:"EUR",account:"acc-tr"},
  {id:"br-c",ent:"trade_republic",name:"Sin precio",shares:4,value:null,cost:500.03,cur:"EUR",account:"acc-tr"},
  {id:"br-d",ent:"myinvestor",name:"Índice sintético",shares:5,value:2000.34,cost:1800.04,cur:"EUR",account:"acc-mi"},
  {id:"br-e",ent:"broker_sintetico",name:"Posición importada",shares:6,value:123.45,cost:150.05,cur:"EUR",account:"acc-otro"},
];
const original = ["revolut","trade_republic","myinvestor","broker_sintetico"];
const reordered = ["trade_republic","revolut","myinvestor","broker_sintetico"];
const seed = { investments, __seedOnce:true, lastBackup:"2026-09-26",
  accounts:[{id:"acc-r",ent:"revolut",name:"Cuenta sintética",value:321.09,role:"fijos"}],
  settings:{autoPrices:false,theme:"green",secOrder:{cartera:["inv","accounts"]}},
};

// El cliente de fixtures es enteramente simulado. Este doble conserva el contrato CAS de
// app_state: ejercitamos pushState/pullState de producción sin añadir otro escritor a la app.
async function setup(page, overrides = seed) {
  await installFixtureClock(page);
  await seedLoggedInDashboard(page, overrides);
  await page.addInitScript(() => {
    window.__brokerWrites=[];
    const d=Object.getOwnPropertyDescriptor(window,"supabase");
    Object.defineProperty(window,"supabase",{configurable:true,get:d.get,set(lib){
      d.set.call(window,lib); const mock=d.get.call(window); if(!mock?.createClient)return;
      const create=mock.createClient;
      mock.createClient=()=>{
        const client=create(),from=client.from;
        client.from=(table)=>{
          if(table!=="app_state")return from(table);
          let payload=null,operation=null,filters={};
          const q={select:()=>q,eq:(k,v)=>{filters[k]=v;return q;},
            maybeSingle:async()=>({data:window.__e2eCloudRows.app_state?.[0]||null,error:null}),
            update:p=>{payload=p;operation="update";return q;},
            upsert:p=>{payload=p;operation="upsert";return q;},
            then:resolve=>{
              const prior=window.__e2eCloudRows.app_state?.[0];
              const ok=operation==="upsert"||(prior&&prior.updated_at===filters.updated_at&&prior.user_id===filters.user_id);
              if(payload&&ok){window.__e2eCloudRows.app_state=[structuredClone(payload)];window.__brokerWrites.push({operation,filters,payload:structuredClone(payload)});}
              resolve({data:ok?[{updated_at:payload.updated_at}]:[],error:null});
            }};
          return q;
        };
        return client;
      };
    }});
  });
  // Una regresión del mock tampoco puede llegar al servicio real.
  await page.context().route("**/*",route=>new URL(route.request().url()).origin===new URL(test.info().project.use.baseURL).origin?route.continue():route.abort());
}
async function open(page, full) {
  await page.goto("/");
  await page.locator("#mc-load").waitFor({state:"detached"});
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="cartera"]').click();
  if(full) await page.getByRole("button",{name:/Ver todas tus inversiones/}).click();
  const list=full?page.locator(".v4-investments-full"):page.locator(".v4-card-list").filter({hasText:/posiciones/}).first();
  await expect(list).toBeVisible();
  await expect.poll(()=>list.evaluate(el=>el.getBoundingClientRect().left)).toBeLessThan(40);
  return list;
}
function headers(list, full) {return full?list.locator('[data-inv-broker] > button.v4-mov'):list.locator('button.v4-mov');}
async function ids(list, full) {
  return headers(list,full).evaluateAll(nodes=>nodes.map(el=>el.querySelector('img')?.getAttribute('src')||el.textContent));
}
async function snapshot(page) {
  return page.evaluate(()=>{
    const s=mcLoadRaw("micartera_v3");
    return Object.fromEntries(["investments","accounts","obAccounts","assets","debts","fixed","flows","oneoffs","aportaciones","expenses","goals","budget","monthStartNet","fx","fxRates","soldCash"].map(k=>[k,s[k]]));
  });
}
async function membership(list, full) {
  const rows=headers(list,full), result=[];
  for(let i=0;i<await rows.count();i++){
    await rows.nth(i).click();
    const group=full?rows.nth(i).locator(".."):list;
    const visible=full?group.locator("[data-inv-position]"):rows.nth(i).locator("xpath=following-sibling::*[1]").locator("[data-inv-position]");
    result.push(await visible.evaluateAll(nodes=>nodes.map(el=>({id:el.getAttribute("data-inv-position"),text:el.textContent}))));
    await rows.nth(i).click();
  }
  return result;
}
for(const full of [false,true])test(`brókers: pulsación larga, recarga y sincronización (${full?"pantalla":"portada"})`,async({page,browser},info)=>{
  await setup(page); const list=await open(page,full), rows=headers(list,full);
  await expect(rows).toHaveCount(4);
  await expect(rows.nth(0)).toContainText("Revolut");await expect(rows.nth(1)).toContainText("Trade Republic");
  const before=await snapshot(page), membershipBefore=await membership(list,full), labelsBefore=await ids(list,full);
  expect(membershipBefore.map(group=>group.map(x=>x.id))).toEqual([["br-a"],["br-b","br-c"],["br-d"],["br-e"]]);
  await rows.nth(0).scrollIntoViewIfNeeded();
  const from=await rows.nth(0).boundingBox(),to=await rows.nth(1).boundingBox();
  const point={x:Math.round(from.x+from.width/2),y:Math.round(from.y+from.height/2)},end=Math.round(to.y+to.height/2);
  expect(end).toBeLessThan(await page.evaluate(()=>innerHeight-60));
  expect(await page.evaluate(p=>document.elementFromPoint(p.x,p.y)?.closest("button.v4-mov")?.textContent,point)).toContain("Revolut");
  await info.attach("before",{body:JSON.stringify({before,membershipBefore,labelsBefore,point,end}),contentType:"application/json"});
  await info.attach("before-screen",{body:await page.screenshot(),contentType:"image/png"});
  const cdp=await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[point]});
  await page.waitForTimeout(480);
  // RED causal: el gesto aterriza pero el bloque aún no entra en ordenación.
  await expect(rows.nth(0)).toHaveClass(/dragging/);
  await info.attach("hold-screen",{body:await page.screenshot(),contentType:"image/png"});
  for(let i=1;i<=6;i++)await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x:point.x,y:Math.round(point.y+(end-point.y)*i/6)}]});
  await expect(rows.nth(1)).toHaveClass(/drag-over/);
  await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
  await expect(rows.nth(0)).toContainText("Trade Republic");await expect(rows).toHaveCount(4);
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("micartera_v3")).settings.secOrder.inv)).toEqual(reordered);
  await page.waitForTimeout(500);
  const after=await snapshot(page),membershipAfter=await membership(list,full);
  expect(after).toEqual(before);expect(membershipAfter).toEqual([membershipBefore[1],membershipBefore[0],membershipBefore[2],membershipBefore[3]]);
  await expect.poll(()=>page.evaluate(()=>window.__brokerWrites.some(w=>JSON.stringify(w.payload.data.settings.secOrder.inv)===JSON.stringify(["trade_republic","revolut","myinvestor","broker_sintetico"]))),{timeout:10000}).toBe(true);
  const remote=await page.evaluate(()=>window.__e2eCloudRows.app_state[0]);
  const writesBeforeReload=await page.evaluate(()=>window.__brokerWrites);
  const orderedWrite=writesBeforeReload.find(w=>JSON.stringify(w.payload.data.settings.secOrder.inv)===JSON.stringify(reordered));
  expect(orderedWrite.operation).toBe("update");
  expect(orderedWrite.filters.user_id).toBe("e2e-user");
  expect(orderedWrite.filters.updated_at).toBeTruthy();
  expect(remote.data.investments).toEqual(before.investments);expect(remote.data.accounts).toEqual(before.accounts);
  expect(remote.data.settings.secOrder.cartera).toEqual(seed.settings.secOrder.cartera);
  const reloaded=await open(page,full);
  await expect(headers(reloaded,full).nth(0)).toContainText("Trade Republic");
  expect(await snapshot(page)).toEqual(before);expect(await membership(reloaded,full)).toEqual(membershipAfter);
  await info.attach("after-screen",{body:await page.screenshot(),contentType:"image/png"});
  // Otro contexto obtiene la preferencia por el pull habitual, sin copiar su almacenamiento local.
  const context=await browser.newContext({...info.project.use,serviceWorkers:"block"});
  try{
    const second=await context.newPage();
    await setup(second,{...seed,__cloudRows:{app_state:[remote]}});
    const pulled=await open(second,full);
    await expect(headers(pulled,full).nth(0)).toContainText("Trade Republic");
    expect(await membership(pulled,full)).toEqual(membershipAfter);
    expect((await snapshot(second)).investments).toEqual(before.investments);
    await info.attach("evidence",{body:JSON.stringify({original,reordered,before,after,membershipBefore,membershipAfter,remote,writesBeforeReload,writesAfterReload:await page.evaluate(()=>window.__brokerWrites)}),contentType:"application/json"});
  }finally{await context.close();}
});

test("orden guardado antiguo conserva todos los grupos y posiciones",async({page})=>{
  await setup(page,{...seed,settings:{...seed.settings,secOrder:{inv:["desconectado","myinvestor","myinvestor"]}}});
  const list=await open(page,true),rows=headers(list,true);
  await expect(rows).toHaveCount(4);
  await expect(rows.nth(0)).toContainText("MyInvestor");
  expect((await membership(list,true)).map(group=>group.map(x=>x.id))).toEqual([["br-d"],["br-a"],["br-b","br-c"],["br-e"]]);
});
