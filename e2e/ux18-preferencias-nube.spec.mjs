import { test, expect } from "@playwright/test";

// App, SDK y JSON de idioma reales; solo identidad y transporte usan datos sintéticos.
const owner="11111111-1111-4111-8111-111111111111";
const copy=x=>JSON.parse(JSON.stringify(x));
const order=["acc:a","acc:b","acc:c"];
const titles={es:"Tu cartera",en:"Your portfolio",ca:"La teva cartera"};
function seed(){return {fx:1,budget:500,monthStartNet:620,accounts:[
  {id:"a",ent:"sabadell",name:"Cuenta A",value:500,role:"fijos"},
  {id:"b",ent:"revolut",name:"Cuenta B",value:80,role:"diario",spendFrom:true},
  {id:"c",ent:"efectivo",name:"Cuenta C",value:40,role:"fijos"}],
  investments:[],assets:[],debts:[],fixed:[],flows:[],oneoffs:[],aportaciones:[],goals:[],shared:[],expenses:[],history:[],catOverrides:{},obAccounts:[],obLabels:{},verNotes:[],
  settings:{autoPrices:false,theme:"green",lang:"es",accountListOrder:order,expenseBanks:["revolut"],reservaRules:[],futurePreference:{keep:["unknown",null]}},
  onboarded:true,tourSeen:true,setupHint:false,_dataVer:6,_savedAt:Date.now()-60000,lastBackup:new Date().toISOString().slice(0,10),trAnchor:new Date().toISOString().slice(0,7),reservaLog:[],_historyOwner:owner};}

async function harness(browser,baseURL,info,{holdFirst=false,failPack=false,holdPack=false}={}){
  let row={user_id:owner,data:seed(),updated_at:new Date().toISOString()},held=[],heldPacks=[],hold=holdFirst,failedPack=failPack,holdEnglish=holdPack;
  const requests=[],packs=[],errors=[],snapshots=[];
  const ctx=await browser.newContext({viewport:{width:375,height:812},isMobile:true,hasTouch:true,timezoneId:"Europe/Madrid",serviceWorkers:"block"});
  await ctx.route("**/*",async route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.origin===baseURL){
      if(/\/i18n\/(en|ca)\.json$/.test(url.pathname)){
        packs.push({path:url.pathname,failed:failedPack});
        if(holdEnglish&&url.pathname.endsWith("/en.json")){heldPacks.push(route);return;}
        if(failedPack==="offline")return route.abort("internetdisconnected");
        if(failedPack)return route.fulfill({status:503,body:"offline language package"});
      }
      return route.continue();
    }
    if(url.hostname.endsWith(".supabase.co")&&url.pathname.startsWith("/rest/v1/")){
      const table=url.pathname.split("/").at(-1),method=req.method(),body=req.postData()?req.postDataJSON():null;
      const entry={table,method,filters:Object.fromEntries(url.searchParams),body,at:Date.now()};requests.push(entry);
      let data=[];
      if(table==="app_state"){
        if(method==="GET"){
          // La foto se toma al recibir el GET; liberarla NO rebobina el servidor.
          data=[{data:copy(row.data),updated_at:row.updated_at}];
          if(hold){held.push({route,data});return;}
        }else if(method==="PATCH"){
          if(url.searchParams.get("user_id")==="eq."+owner&&url.searchParams.get("updated_at")==="eq."+row.updated_at){row=copy(body);data=[{updated_at:row.updated_at}];}
          entry.accepted=data.length===1;
        }else throw Error("Unexpected app_state method "+method);
      }
      entry.response=copy(data);
      return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(data)});
    }
    if(url.hostname.endsWith(".supabase.co")&&url.pathname.startsWith("/functions/v1/"))return route.fulfill({status:200,contentType:"application/json",body:"{}"});
    return route.abort();
  });
  await ctx.addInitScript(({local,owner})=>{
    if(location.protocol!=="http:")return;
    document.addEventListener("DOMContentLoaded",()=>{
      const create=ReactDOM.createRoot;
      ReactDOM.createRoot=function(...args){const root=create(...args);window.__ux18Root=root;return root;};
    },{once:true});
    let lib;const session={access_token:"synthetic-only",expires_at:4102444800,user:{id:owner}};
    Object.defineProperty(window,"supabase",{configurable:true,get:()=>lib,set:value=>{
      if(!value?.createClient){lib=value;return;}
      lib={...value,createClient:(url,key)=>{const c=value.createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
        c.auth.getSession=async()=>({data:{session},error:null});
        c.auth.onAuthStateChange=()=>({data:{subscription:{unsubscribe(){}}}});return c;}};
    }});
    if(!localStorage.getItem("__ux18Seed")){localStorage.setItem("micartera_v3",JSON.stringify(local));localStorage.setItem("__ux18Seed","1");}
    localStorage.setItem("_seenVersion","dev");["dash","metas","gastos","fijos","inv"].forEach(k=>localStorage.setItem("_coach_"+k,"1"));
    const d=new Date();localStorage.setItem("_mr"+d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0"),"1");
  },{local:copy(row.data),owner});
  const page=await ctx.newPage();page.on("pageerror",e=>errors.push(e.message));
  const rows=()=>page.locator(".v4-card-list button.v4-mov[data-account-key]");
  const keys=()=>rows().evaluateAll(els=>els.map(e=>e.dataset.accountKey));
  const title=()=>page.locator(".v4-screen .v4-title").filter({hasText:/Tu cartera|Your portfolio|La teva cartera/});
  async function ready(){await expect(page.locator(".botnav")).toBeVisible({timeout:15000});await page.waitForFunction(()=>!document.getElementById("mc-load"));await page.locator('.botnav-tab[data-tour="cartera"]').click();await expect(page.locator('.botnav-tab.active[data-tour="cartera"]')).toBeVisible();await expect(rows()).toHaveCount(3);await expect(title()).toBeVisible();await expect(title()).toBeInViewport();await expect.poll(()=>title().evaluate(e=>Math.abs(e.getBoundingClientRect().left))).toBeLessThan(40);}
  async function snap(label){snapshots.push({label,local:await page.evaluate(()=>loadState()),order:await keys(),title:await title().textContent(),row:copy(row),packs:copy(packs)});}
  async function quiet(){await expect.poll(async()=>(await page.evaluate(()=>loadState()._goalSync?.revision))===row.updated_at).toBe(true);await page.waitForTimeout(1600);}
  async function reconnect(){await page.evaluate(()=>window.dispatchEvent(new Event("offline")));await expect(page.locator(".offline-pill")).toBeVisible();await page.evaluate(()=>window.dispatchEvent(new Event("online")));}
  async function language(lang){
    await page.evaluate(()=>window.dispatchEvent(new CustomEvent("mc-open-settings")));await expect(page.locator(".settings-push")).toHaveClass(/open/);
    const choice=page.getByRole("button",{name:{en:"English",ca:"Català",es:"Español"}[lang],exact:true});
    if(!await choice.isVisible()){
      const row=page.locator(".set-row",{hasText:/Idioma|Language/}).first();
      const appearance=page.locator("button.set-row",{hasText:/Apariencia|Appearance|Aparença/}).first();
      const body=appearance.locator("..").locator(".collapsible").first();
      if(!(await body.getAttribute("class")).split(" ").includes("open"))await appearance.click();
      await expect(body).toHaveClass(/open/);
      await row.click();
    }
    await choice.click();
  }
  async function closeSettings(){await page.locator(".settings-push-h button").first().click();}
  return {page,rows,keys,title,ready,snap,quiet,reconnect,language,closeSettings,requests,packs,errors,
    async release(){hold=false;for(const q of held.splice(0))await q.route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(q.data)});},
    async held(){await expect.poll(()=>held.length).toBeGreaterThan(0);},
    async heldPack(){await expect.poll(()=>heldPacks.length).toBeGreaterThan(0);},
    async releasePack(){holdEnglish=false;for(const route of heldPacks.splice(0))await route.continue();},
    remote(lang,keys){row={user_id:owner,data:{...copy(row.data),settings:{...copy(row.data.settings),lang,accountListOrder:keys},_savedAt:Date.now()},updated_at:new Date().toISOString()};},
    row:()=>row,allowPack:()=>{failedPack=false;},
    async close(){await info.attach("ux18-preferences-evidence",{body:JSON.stringify({requests,packs,errors,snapshots,row},null,2),contentType:"application/json"});await Promise.race([ctx.close(),new Promise(resolve=>setTimeout(resolve,5000))]);}
  };
}

for(const lang of ["en","ca"])test("UX18 remoto posterior "+lang+" carga el paquete y repinta sin recargar",async({browser,baseURL},info)=>{
  const h=await harness(browser,baseURL,info);
  try{
    await test.step("abrir documento",()=>h.page.goto(baseURL+"/",{waitUntil:"domcontentloaded",timeout:10000}));
    await test.step("abrir Cartera",()=>h.ready());await test.step("esperar CAS",()=>h.quiet());await expect(h.title()).toHaveText(titles.es);
    expect(h.packs).toHaveLength(0);
    h.remote(lang,["acc:c","acc:a","acc:b"]);await h.reconnect();
    await expect.poll(()=>h.keys()).toEqual(["acc:c","acc:a","acc:b"]);
    await expect.poll(()=>h.page.evaluate(()=>loadState().settings.lang)).toBe(lang);
    await h.snap("remote-preference-adopted");
    try{await expect(h.title()).toHaveText(titles[lang]);}
    catch(red){await h.snap("before-reload-RED");await info.attach("visible-before-reload",{body:await h.page.screenshot(),contentType:"image/png"});await h.page.reload({waitUntil:"domcontentloaded"});await h.ready();await expect(h.title()).toHaveText(titles[lang]);await expect(h.title()).toBeVisible();await h.snap("reload-heals");await info.attach("visible-after-reload",{body:await h.page.screenshot(),contentType:"image/png"});throw red;}
    await expect.poll(()=>h.packs.filter(x=>x.path.endsWith(lang+".json")).length).toBe(1);
    await h.page.reload();await h.ready();await expect(h.title()).toHaveText(titles[lang]);expect(await h.keys()).toEqual(["acc:c","acc:a","acc:b"]);
    expect(h.row().data.settings.futurePreference).toEqual({keep:["unknown",null]});
    expect(h.row().data.accounts.map(a=>[a.id,a.value,a.role])).toEqual([["a",500,"fijos"],["b",80,"diario"],["c",40,"fijos"]]);
    await h.snap("reload-preserves-server");
  }finally{await h.close();}
});

async function drag(page,rows,from,to){
  await rows.nth(from).scrollIntoViewIfNeeded();
  let previous=null;
  await expect.poll(async()=>{const b=await rows.nth(from).boundingBox(),ok=b&&b.x<40&&previous!==null&&Math.abs(b.x-previous)<0.5;previous=b?.x;return !!ok;}).toBe(true);
  const a=await rows.nth(from).boundingBox(),b=await rows.nth(to).boundingBox(),x=Math.round(a.x+a.width/2),y=Math.round(a.y+a.height/2),end=Math.round(b.y+b.height/2);
  const cdp=await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x,y}]});
  await expect(rows.nth(from)).toHaveClass(/dragging/);
  for(let i=1;i<=6;i++)await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x,y:Math.round(y+(end-y)*i/6)}]});
  await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});await cdp.detach();
}

test("UX18 pull viejo tras orden e idioma locales conserva el CAS aceptado al recargar",async({browser,baseURL},info)=>{
  const h=await harness(browser,baseURL,info,{holdFirst:true});
  try{
    await h.page.goto(baseURL+"/",{waitUntil:"domcontentloaded"});await h.held();await h.ready();
    await drag(h.page,h.rows(),0,2);await expect.poll(()=>h.keys()).toEqual(["acc:b","acc:c","acc:a"]);
    await h.language("en");await expect(h.page.getByRole("heading",{name:"Settings",exact:true})).toBeVisible();await h.closeSettings();
    await expect(h.title()).toHaveText(titles.en);await h.snap("local-controls-before-old-pull");
    expect(h.requests.filter(r=>r.table==="app_state"&&r.method!=="GET")).toHaveLength(0);
    await h.release();await h.quiet();
    await expect.poll(()=>({lang:h.row().data.settings.lang,order:h.row().data.settings.accountListOrder})).toEqual({lang:"en",order:["acc:b","acc:c","acc:a"]});
    expect(h.requests.some(r=>r.table==="app_state"&&r.method==="PATCH"&&r.accepted)).toBe(true);
    await h.page.reload({waitUntil:"domcontentloaded"});await h.ready();await expect(h.title()).toHaveText(titles.en);expect(await h.keys()).toEqual(["acc:b","acc:c","acc:a"]);
    await h.reconnect();await h.quiet();await expect(h.title()).toHaveText(titles.en);expect(await h.keys()).toEqual(["acc:b","acc:c","acc:a"]);
    expect(h.row().data.settings.futurePreference).toEqual({keep:["unknown",null]});await h.snap("accepted-write-reload-and-replay");expect(h.errors).toEqual([]);
  }finally{await h.close();}
});

for(const failure of ["http","offline"])test("UX18 paquete "+failure+" conserva preferencia, fallback y recuperación sin recargar",async({browser,baseURL},info)=>{
  const h=await harness(browser,baseURL,info,{failPack:failure});
  try{
    await h.page.goto(baseURL+"/",{waitUntil:"domcontentloaded"});await h.ready();await h.quiet();h.remote("en",order);await h.reconnect();
    await expect.poll(()=>h.packs.length).toBe(1);await h.quiet();
    await expect(h.title()).toHaveText(titles.es);expect(await h.page.evaluate(()=>loadState().settings.lang)).toBe("en");
    await h.snap("package-failed-preference-kept");h.allowPack();await h.reconnect();await expect(h.title()).toHaveText(titles.en);await expect(h.title()).toBeVisible();
    expect(await h.page.evaluate(()=>loadState().settings.lang)).toBe("en");expect(h.packs).toHaveLength(2);
    await h.quiet();const writes=h.requests.filter(r=>r.table==="app_state"&&r.method==="PATCH").length;await h.page.waitForTimeout(1500);expect(h.requests.filter(r=>r.table==="app_state"&&r.method==="PATCH")).toHaveLength(writes);
    await h.snap("package-recovered-without-reload");expect(h.errors).toEqual([]);
  }finally{await h.close();}
});

test("UX18 paquete tardío no resucita el idioma que ya se cambió en Ajustes",async({browser,baseURL},info)=>{
  const h=await harness(browser,baseURL,info,{holdPack:true});
  try{
    await h.page.goto(baseURL+"/",{waitUntil:"domcontentloaded"});await h.ready();await h.quiet();h.remote("en",order);await h.reconnect();await h.heldPack();
    await h.language("ca");await expect(h.page.getByRole("heading",{name:"Configuració",exact:true})).toBeVisible();await h.closeSettings();
    await expect(h.title()).toHaveText(titles.ca);await h.releasePack();await h.page.waitForTimeout(1500);
    await expect(h.title()).toHaveText(titles.ca);expect(await h.page.evaluate(()=>loadState().settings.lang)).toBe("ca");await h.snap("late-English-does-not-replace-Catalan");expect(h.errors).toEqual([]);
  }finally{await h.close();}
});

test("UX18 dos elecciones locales conservan la última aunque el primer paquete llegue después",async({browser,baseURL},info)=>{
  const h=await harness(browser,baseURL,info,{holdPack:true});
  try{
    await h.page.goto(baseURL+"/",{waitUntil:"domcontentloaded"});await h.ready();await h.quiet();
    await h.language("en");await h.heldPack();await h.language("ca");await expect(h.page.getByRole("heading",{name:"Configuració",exact:true})).toBeVisible();await h.closeSettings();
    await expect(h.title()).toHaveText(titles.ca);await h.snap("last-local-choice-before-English");await h.releasePack();
    await expect.poll(()=>h.page.evaluate(()=>langPackReady("en"))).toBe(true);await h.page.waitForTimeout(500);await h.snap("after-earlier-English-arrives");
    await expect(h.title()).toHaveText(titles.ca);expect(await h.page.evaluate(()=>loadState().settings.lang)).toBe("ca");expect(h.errors).toEqual([]);
  }finally{await h.close();}
});

test("UX18 desmontar App cancela el repintado de un paquete pendiente",async({browser,baseURL},info)=>{
  const h=await harness(browser,baseURL,info,{holdPack:true});
  try{
    await h.page.goto(baseURL+"/",{waitUntil:"domcontentloaded"});await h.ready();await h.quiet();h.remote("en",order);await h.reconnect();await h.heldPack();await h.quiet();
    await h.page.evaluate(()=>window.__ux18Root.unmount());const writes=h.requests.filter(r=>r.table==="app_state"&&r.method==="PATCH").length;
    await h.releasePack();await h.page.waitForTimeout(1500);await expect(h.page.locator("#root")).toBeEmpty();
    expect(h.requests.filter(r=>r.table==="app_state"&&r.method==="PATCH")).toHaveLength(writes);expect(h.errors).toEqual([]);
  }finally{await h.close();}
});

test("UX18 desmontar Ajustes invalida la selección local pendiente",async({browser,baseURL},info)=>{
  const h=await harness(browser,baseURL,info,{holdPack:true});
  try{
    await h.page.goto(baseURL+"/",{waitUntil:"domcontentloaded"});await h.ready();await h.quiet();await h.language("en");await h.heldPack();
    expect(await h.page.evaluate(()=>CURLANG)).toBe("es");await h.page.evaluate(()=>window.__ux18Root.unmount());
    const writes=h.requests.filter(r=>r.table==="app_state"&&r.method==="PATCH").length;await h.releasePack();
    await expect.poll(()=>h.page.evaluate(()=>langPackReady("en"))).toBe(true);await h.page.waitForTimeout(500);
    expect(await h.page.evaluate(()=>CURLANG)).toBe("es");await expect(h.page.locator("#root")).toBeEmpty();
    expect(h.requests.filter(r=>r.table==="app_state"&&r.method==="PATCH")).toHaveLength(writes);expect(h.errors).toEqual([]);
  }finally{await h.close();}
});
