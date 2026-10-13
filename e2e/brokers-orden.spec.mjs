import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

const investments=[
  {id:"r",ent:"revolut",name:"Acción sintética",value:90,cost:70,cur:"EUR"},
  {id:"t1",ent:"trade_republic",name:"Fondo sintético A",value:150,cost:120,cur:"EUR"},
  {id:"t2",ent:"trade_republic",name:"Fondo sintético B",value:null,cost:100,cur:"EUR"},
  {id:"t3",ent:"trade_republic",name:"Fondo sintético C",value:80,cost:100,cur:"EUR"},
  {id:"m",ent:"myinvestor",name:"Índice sintético",value:200,cost:180,cur:"EUR"},
];
const overview=page=>page.locator('[data-inv-brokers="1"]');
const headers=list=>list.locator('button[data-inv-broker-toggle]');
const order=list=>headers(list).evaluateAll(rows=>rows.map(r=>r.getAttribute("data-inv-broker-toggle")));

async function open(page,overrides={}){
  await seedLoggedInDashboard(page,{__seedOnce:true,investments,settings:{autoPrices:false,theme:"green"},...overrides});
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible();
  await page.waitForFunction(()=>!document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="cartera"]').click();
  await expect(overview(page)).toBeVisible();
}
async function child(page){
  await page.getByRole("button",{name:/Ver todas tus inversiones|See all your investments|Veure totes les inversions/i}).click();
  const list=page.locator("[data-inv-screen] .v4-broker-list");
  await expect(list).toBeVisible();
  return list;
}
async function hold(page,list,{cancel=false,moveBeforeHold=false}={}){
  const from=headers(list).nth(0), to=headers(list).nth(1);
  await to.scrollIntoViewIfNeeded();
  const a=await from.boundingBox(), b=await to.boundingBox();
  const x=Math.round(a.x+a.width/2), y=Math.round(a.y+a.height/2), target=Math.round(b.y+b.height/2);
  expect(y).toBeGreaterThan(0); expect(target).toBeLessThan(page.viewportSize().height);
  const cdp=await page.context().newCDPSession(page);
  try{
    await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x,y}]});
    if(moveBeforeHold) await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x,y:y+18}]});
    await page.waitForTimeout(480);
    if(moveBeforeHold) await expect(from).not.toHaveClass(/dragging/);
    else{
      await expect(from).toHaveClass(/dragging/);
      for(let n=1;n<=6;n++) await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x,y:Math.round(y+(target-y)*n/6)}]});
      await expect(to).toHaveClass(/drag-over/);
    }
    await cdp.send("Input.dispatchTouchEvent",{type:cancel?"touchCancel":"touchEnd",touchPoints:[]});
  }finally{ await cdp.detach(); }
}

test("auditoría DOM de portada y puerta de edición",async({page},testInfo)=>{
  // El modo base se ejecuta solo contra el archivo c5f62 reconstruido y guarda lo existente;
  // los guardianes de entrega siguientes siempre exigen el comportamiento nuevo.
  await seedLoggedInDashboard(page,{investments,settings:{autoPrices:false,theme:"green"}});
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible();
  await page.waitForFunction(()=>!document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="cartera"]').click();
  const list=page.locator(".v4-card-list").filter({hasText:/posiciones|positions|posicions/}).first();
  const buttons=list.locator("button.v4-mov");
  await expect(buttons).toHaveCount(3);
  const names=await buttons.locator(".nm > div:first-child").allTextContents();
  expect(names).toEqual(["Revolut","Trade Republic","MyInvestor"]);
  const manual=await list.locator("button.edit-link").count();
  expect(manual).toBe(process.env.MC_BROKER_AUDIT_MODE==="base"?1:0);
  await buttons.nth(1).click();
  await expect(list.locator("[data-inv-position]")).toHaveCount(3);
  const rows=await list.locator("[data-inv-position]").evaluateAll(rows=>rows.map(el=>({id:el.getAttribute("data-inv-position"),animation:getComputedStyle(el).animationName,delay:getComputedStyle(el).animationDelay,parentAnimation:getComputedStyle(el.parentElement).animationName})));
  await page.getByRole("button",{name:/Ver todas tus inversiones|See all your investments|Veure totes les inversions/i}).click();
  const card=page.locator('[data-inv-screen] [data-inv-broker="trade_republic"]');
  await card.locator("button.v4-mov").click();
  await card.locator('[data-act="inv-edit"]').click();
  await expect(card.locator("input")).toHaveCount(6);
  await testInfo.attach("brokers-dom-audit.json",{body:Buffer.from(JSON.stringify({source:process.env.MC_BROKER_SOURCE_SHA||"uncommitted",names,manualEditorOnOverview:manual,rows,childEditorInputs:6},null,2)),contentType:"application/json"});
});

for(const count of [2,3]) test(`${count} brókers: pulsación mantenida ordena, conserva posiciones y sobrevive a recarga`,async({page})=>{
  const rows=investments.filter(i=>count===3||i.ent!=="myinvestor");
  await open(page,{investments:rows});
  const list=overview(page);
  await expect(headers(list)).toHaveCount(count);
  await hold(page,list);
  const expected=count===3?["trade_republic","revolut","myinvestor"]:["trade_republic","revolut"];
  await expect.poll(()=>order(list)).toEqual(expected);
  await expect(list.locator("[data-inv-position]")).toHaveCount(0);
  await expect(list.locator(".edit-link,input")).toHaveCount(0);
  await page.waitForTimeout(500);
  for(const id of expected){
    await list.locator(`[data-inv-broker-toggle="${id}"]`).click();
    const ids=rows.filter(i=>i.ent===id).map(i=>i.id);
    for(const pid of ids) await expect(list.locator(`[data-inv-position="${pid}"]`)).toContainText(rows.find(i=>i.id===pid).name);
  }
  await expect(list.locator("[data-inv-position]")).toHaveCount(rows.length);
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("micartera_v3")).settings.invBrokerOrder)).toEqual(expected);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("micartera_v3")).investments)).toEqual(rows);
  await page.reload();
  await page.waitForFunction(()=>!document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="cartera"]').click();
  await expect.poll(()=>order(overview(page))).toEqual(expected);
  const full=await child(page);
  await expect.poll(()=>order(full)).toEqual(expected);
  for(const id of expected) await full.locator(`[data-inv-broker-toggle="${id}"]`).click();
  await expect(full.locator("[data-inv-position]")).toHaveCount(rows.length);
  await full.locator('[data-inv-broker="trade_republic"] [data-act="inv-edit"]').click();
  await expect(full.locator('[data-inv-broker="trade_republic"] input')).toHaveCount(6);
  await expect(full.locator('[data-inv-broker="revolut"] input')).toHaveCount(0);
});

test("pantalla hija: orden por teclado conserva foco y expansión no abre el editor",async({page})=>{
  await open(page);
  const list=await child(page), first=list.locator('[data-inv-broker-toggle="revolut"]');
  await first.focus(); await first.press("Alt+ArrowDown");
  await expect.poll(()=>order(list)).toEqual(["trade_republic","revolut","myinvestor"]);
  await expect(first).toBeFocused(); await expect(first).toHaveAttribute("aria-expanded","false");
  await first.press("Enter");
  await expect(first).toHaveAttribute("aria-expanded","true");
  await expect(list.locator('[data-inv-position="r"]')).toContainText("Acción sintética");
  await expect(list.locator("input")).toHaveCount(0);
});

test("cancelar el arrastre o empezar desplazando no guarda ni abre posiciones",async({page})=>{
  await open(page);
  const list=overview(page);
  await hold(page,list,{cancel:true});
  await expect.poll(()=>order(list)).toEqual(["revolut","trade_republic","myinvestor"]);
  await expect(list.locator("[data-inv-position]")).toHaveCount(0);
  await hold(page,list,{moveBeforeHold:true});
  await expect.poll(()=>order(list)).toEqual(["revolut","trade_republic","myinvestor"]);
  await expect(list.locator("[data-inv-position]")).toHaveCount(0);
});

for(const reduced of ["system","setting"]) test(`despliegue sin escalonado con reducir movimiento: ${reduced}`,async({page})=>{
  if(reduced==="system") await page.emulateMedia({reducedMotion:"reduce"});
  await open(page,{settings:{autoPrices:false,theme:"green",reduceMotion:reduced==="setting"}});
  for(const list of [overview(page),await child(page)]){
    // La portada sigue montada bajo la hija: se comprueba su DOM sin forzar un clic tapado.
    await list.locator('[data-inv-broker-toggle="trade_republic"]').evaluate(el=>el.click());
    await expect(list.locator('[data-inv-position="t3"]')).toHaveCount(1);
    expect(await list.locator(".v4-inv-drop").evaluateAll(rows=>rows.map(el=>{
      const s=getComputedStyle(el); return {name:s.animationName,delay:s.animationDelay,opacity:s.opacity};
    }))).toEqual(Array(3).fill({name:"none",delay:"0s",opacity:"1"}));
  }
});

test("las posiciones tienen retrasos sucesivos acotados en ambas pantallas",async({page})=>{
  await open(page);
  for(const list of [overview(page),await child(page)]){
    await list.locator('[data-inv-broker-toggle="trade_republic"]').evaluate(el=>el.click());
    await expect(list.locator(".v4-inv-drop")).toHaveCount(3);
    expect(await list.locator(".v4-inv-drop").evaluateAll(rows=>rows.map(el=>getComputedStyle(el).animationDelay))).toEqual(["0s","0.024s","0.048s"]);
  }
});
