import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";
import fs from "node:fs";

const settingsNames={es:"Ir a Ajustes",en:"Go to Settings",ca:"Ves a Ajustos"};

async function start(page,lang,previous=false){
  await seedLoggedInDashboard(page,{settings:{autoPrices:false,theme:"green",lang}});
  if(previous) await page.goto("/privacy.html");
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible();
  await page.locator("#mc-load").waitFor({state:"detached"});
  await dismissNews(page);
  // El helper heredado no reconoce «Entesos!»; cerrar Novedades con su texto real evita
  // que el catalán se quede antes de Perfil, sin tocar el historial del flujo observado.
  const news=page.locator(".wn-panel");
  if(await news.count()){
    const close=await page.evaluate(()=>t("wn_close"));
    await news.getByRole("button",{name:close,exact:true}).click();
  }
  await expect(news).toHaveCount(0);
}

async function handover(page,lang){
  await page.locator(".v4-avatar").click();
  await expect(page.locator(".profile-pull.open")).toBeVisible();
  await page.getByRole("button",{name:settingsNames[lang],exact:true}).click();
  await expect(page.locator(".settings-push.open")).toBeVisible();
  await expect(page.locator(".profile-pull.open")).toHaveCount(0);
}

async function closeSettings(page,method){
  if(method==="ui") await page.locator(".settings-push-h .back").click();
  else await page.goBack();
  await expect(page.locator(".settings-push.open")).toHaveCount(0);
}

async function financial(page){
  return page.evaluate(()=>{
    const s=JSON.parse(localStorage.getItem("micartera_v3"));
    return {accounts:s.accounts,expenses:localStorage.getItem("micartera_v3_exp"),
      debts:s.debts,goals:s.goals,fixed:s.fixed,flows:s.flows,aportaciones:s.aportaciones,
      budget:s.budget,monthStartNet:s.monthStartNet};
  });
}

for(const lang of Object.keys(settingsNames)) for(const method of ["ui","browser"]){
  test(`Perfil → Ajustes → atrás conserva app e historial: ${lang}/${method}`,async({page})=>{
    await start(page,lang);
    const url=page.url(),navigations=[];
    page.on("framenavigated",frame=>{if(frame===page.mainFrame())navigations.push(frame.url());});
    const before=await financial(page);
    // Se pulsa el cierre real sin esperar al booleano del historial: esa espera taparía la carrera.
    await handover(page,lang);
    await closeSettings(page,method);
    await expect(page).toHaveURL(url);
    await expect(page.locator(".botnav")).toBeVisible();
    await expect.poll(()=>page.evaluate(()=>({stack:_mcBackStack.length,pending:_mcIgnorePop})))
      .toEqual({stack:0,pending:false});
    expect(navigations.every(next=>next===url)).toBe(true);
    expect(await financial(page)).toEqual(before);
    // Abrir y cerrar otra vez detecta una pila que aparenta estar vacía pero quedó desarmada.
    await page.locator(".v4-avatar").click();
    await expect(page.locator(".profile-pull.open")).toBeVisible();
    await page.goBack();
    await expect(page.locator(".profile-pull.open")).toHaveCount(0);
    await expect(page).toHaveURL(url);
    await expect(page.locator(".botnav")).toBeVisible();
  });
}

for(const method of ["ui","browser"]){
  test(`Un único atrás después del cierre vuelve a la ruta anterior: ${method}`,async({page})=>{
    await start(page,"es",true);
    const appUrl=page.url();
    await handover(page,"es");
    await closeSettings(page,method);
    await expect(page).toHaveURL(appUrl);
    await expect.poll(()=>page.evaluate(()=>({stack:_mcBackStack.length,pending:_mcIgnorePop})))
      .toEqual({stack:0,pending:false});
    // Navegación real previa: una entrada muerta obligaría a pulsar dos veces.
    await page.goBack();
    await expect(page).toHaveURL(new URL("/privacy.html",appUrl).href);
  });
}

async function nativeButton(page){
  await page.addInitScript(()=>{
    window.__backExitCalls=0;
    window.Capacitor={isNativePlatform:()=>false,Plugins:{App:{
      addListener(name,callback){if(name==="backButton")window.__backButton=callback;return {remove(){}};},
      exitApp(){window.__backExitCalls++;},
    }}};
  });
}

test("backButton real de App consume Ajustes sin salir y permite reabrir Perfil",async({page})=>{
  await nativeButton(page);await start(page,"es");const url=page.url(),before=await financial(page);
  const state=await page.evaluate(()=>history.state);
  await handover(page,"es");await page.evaluate(()=>window.__backButton());
  await expect(page.locator(".settings-push.open")).toHaveCount(0);
  await expect.poll(()=>page.evaluate(()=>({stack:_mcBackStack.length,pending:_mcIgnorePop})))
    .toEqual({stack:0,pending:false});
  expect(await page.evaluate(()=>history.state)).toEqual(state);
  await expect(page).toHaveURL(url);expect(await page.evaluate(()=>window.__backExitCalls)).toBe(0);
  await page.locator(".v4-avatar").click();await expect(page.locator(".profile-pull.open")).toBeVisible();
  await page.evaluate(()=>window.__backButton());await expect(page.locator(".profile-pull.open")).toHaveCount(0);
  await expect.poll(()=>page.evaluate(()=>({stack:_mcBackStack.length,pending:_mcIgnorePop,state:history.state})))
    .toEqual({stack:0,pending:false,state});
  expect(await financial(page)).toEqual(before);await expect(page).toHaveURL(url);
});

test("Ask encadenado cancela el diálogo actual una vez y conserva Perfil",async({page})=>{
  await start(page,"es");const url=page.url(),before=await financial(page);
  const initialName=await page.evaluate(()=>JSON.parse(localStorage.getItem("micartera_v3")).settings.profile?.fullName);
  await page.evaluate(()=>{
    window.__askResolutions=[];const emit=askEmit;
    askEmit=function(o){const record={calls:0},resolve=o.resolve;window.__askResolutions.push(record);
      emit(Object.assign({},o,{resolve:function(value){record.calls++;resolve(value);}}));};
  });
  await page.locator(".v4-avatar").click();
  const basic=await page.evaluate(()=>t("pf_basic"));
  await page.locator(".profile-pull .profile-row").filter({hasText:basic}).click();
  const ask=page.locator(".askback [role=dialog]");await expect(ask).toBeVisible();
  const title=await ask.locator("#ask-dialog-title").innerText();
  await ask.locator("input").fill("Persona sintética");await ask.locator(".btn-primary").click();
  await expect(ask.locator("#ask-dialog-title")).not.toHaveText(title);
  await page.goBack();await expect(ask).toHaveCount(0);
  await expect(page.locator(".profile-pull.open")).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>_mcBackStack.length)).toBe(1);
  expect(await page.evaluate(()=>window.__askResolutions.map(r=>r.calls))).toEqual([1,1]);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("micartera_v3")).settings.profile?.fullName)).toEqual(initialName);
  expect(await financial(page)).toEqual(before);
  await page.goBack();await expect(page.locator(".profile-pull.open")).toHaveCount(0);await expect(page).toHaveURL(url);
});

for(const method of ["ui","browser","native"]){
  test(`Recibos: tres retrocesos de pasos conservan el hub y cancelan sin guardar: ${method}`,async({page})=>{
    if(method==="native") await nativeButton(page);
    await start(page,"es");const url=page.url(),before=await financial(page);
    await page.locator('.botnav-tab[data-tour="plan"]').click();
    await expect(page.locator('.botnav-tab[data-tour="plan"]')).toHaveClass(/active/);
    const manage=await page.evaluate(()=>t("v4_gestionar"));
    await page.locator('.v4-screen > [data-seg="recibos"]').getByRole("button",{name:manage,exact:true}).click();
    const hub=page.locator("[data-bills-manage]");await expect(hub).toBeVisible();
    const hubState=await page.evaluate(()=>history.state);
    await hub.locator('[data-act="bill-add"]').first().click();
    const wizard=page.locator('[data-sheet="bill-add"]');await expect(wizard).toHaveAttribute("data-step","what");
    await wizard.locator("input.v4-bills-search").fill("Recibo sintético");await wizard.locator('[data-act="next"]').click();
    await wizard.getByRole("button",{name:"3",exact:true}).click();await wizard.locator('[data-act="next"]').click();
    await expect(wizard).toHaveAttribute("data-step","freq");
    for(const next of ["amount","what",null]){
      if(method==="ui") await wizard.locator('[data-act="back"]').click();
      else if(method==="browser") await page.goBack();
      else await page.evaluate(()=>window.__backButton());
      if(next) await expect(wizard).toHaveAttribute("data-step",next);
      else await expect(wizard).toHaveCount(0);
    }
    await expect(hub).toBeVisible();
    await expect.poll(()=>page.evaluate(()=>({pending:_mcIgnorePop,state:history.state}))).toEqual({pending:false,state:hubState});
    expect(await financial(page)).toEqual(before);await expect(page).toHaveURL(url);
    await page.goBack();await expect(hub).toHaveCount(0);await expect(page.locator(".botnav")).toBeVisible();
    await expect(page).toHaveURL(url);
    if(method==="native") expect(await page.evaluate(()=>window.__backExitCalls)).toBe(0);
  });
}

// Estos ensayos adicionales montan el hook de fuente con React real y History del navegador.
// Son contratos de ciclo de vida aislados, no sustituyen el flujo de producto de arriba.
const uiSource=fs.readFileSync(new URL("../src/modules/02-ui-shared.js",import.meta.url),"utf8");
const controller=uiSource.slice(uiSource.indexOf("var _mcBackStack=[];"),uiSource.indexOf("/* Pantallas hijas a página completa"));
const reactScripts=[...fs.readFileSync(new URL("../src/shell.html",import.meta.url),"utf8").matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
  .map(m=>m[1]).filter(s=>/react.production.min.js|react-dom.production.min.js/.test(s));

async function layers(page,pushThrows=false){
  await page.goto("/privacy.html");const url=page.url();
  for(const content of reactScripts) await page.addScriptTag({content});
  await page.addScriptTag({content:"var useRef=React.useRef,useEffect=React.useEffect;\n"+controller});
  await page.evaluate(pushThrows=>{
    window.__layerCalls={parent:0,child:0};
    if(pushThrows){const push=history.pushState.bind(history);history.pushState=function(){history.pushState=push;throw new Error("pushState sintético bloqueado");};}
    function Layer({open,name,close}){useBackClose(open,close);return open?React.createElement("div",{"data-back-layer":name},name):null;}
    function Fixture(){
      const [parent,setParent]=React.useState(false),[child,setChild]=React.useState(false),[mounted,setMounted]=React.useState(true);
      const button=(name,fn)=>React.createElement("button",{onClick:fn},name);
      return React.createElement(React.Fragment,null,
        button("Abrir padre",()=>setParent(true)),button("Abrir hijo",()=>setChild(true)),
        button("Cerrar padre",()=>setParent(false)),button("Cerrar hijo",()=>setChild(false)),
        button("Desmontar capas",()=>setMounted(false)),
        mounted&&React.createElement(Layer,{open:parent,name:"parent",close:()=>{window.__layerCalls.parent++;setParent(false);}}),
        mounted&&React.createElement(Layer,{open:child,name:"child",close:()=>{window.__layerCalls.child++;setChild(false);}}));
    }
    const mount=document.createElement("div");mount.id="back-lifecycle-fixture";document.body.appendChild(mount);
    ReactDOM.createRoot(mount).render(React.createElement(Fixture));
  },pushThrows);
  const fixture=page.locator("#back-lifecycle-fixture");await expect(fixture.getByRole("button",{name:"Abrir padre",exact:true})).toBeVisible();
  const state=await page.evaluate(()=>history.state);
  return {fixture,url,state};
}

async function openLayers(page,fixture){
  await fixture.getByRole("button",{name:"Abrir padre",exact:true}).click();await expect(page.locator('[data-back-layer="parent"]')).toBeVisible();
  await fixture.getByRole("button",{name:"Abrir hijo",exact:true}).click();await expect(page.locator('[data-back-layer="child"]')).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>_mcBackStack.length)).toBe(2);
}

async function layersClosed(page,url,state){
  await expect.poll(()=>page.evaluate(()=>({stack:_mcBackStack.length,pending:_mcIgnorePop}))).toEqual({stack:0,pending:false});
  await expect(page).toHaveURL(url);expect(await page.evaluate(()=>history.state)).toEqual(state);
}

test("React real: retirar padre cubierto conserva hijo y compacta las dos entradas al cerrarlo",async({page})=>{
  const {fixture,url,state}=await layers(page);await openLayers(page,fixture);
  await fixture.getByRole("button",{name:"Cerrar padre",exact:true}).click();
  await expect(page.locator('[data-back-layer="parent"]')).toHaveCount(0);
  await expect(page.locator('[data-back-layer="child"]')).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>_mcBackStack.length)).toBe(1);
  await fixture.getByRole("button",{name:"Cerrar hijo",exact:true}).click();await layersClosed(page,url,state);
  expect(await page.evaluate(()=>window.__layerCalls)).toEqual({parent:0,child:0});
});

test("React real: desmontaje simultáneo consume sus entradas sin callback extra",async({page})=>{
  const {fixture,url,state}=await layers(page);await openLayers(page,fixture);
  await fixture.getByRole("button",{name:"Desmontar capas",exact:true}).click();
  await expect(page.locator("[data-back-layer]")).toHaveCount(0);await layersClosed(page,url,state);
  expect(await page.evaluate(()=>window.__layerCalls)).toEqual({parent:0,child:0});
});

test("React real: browser back cierra únicamente al hijo y luego al padre",async({page})=>{
  const {fixture,url,state}=await layers(page);await openLayers(page,fixture);
  await page.goBack();await expect(page.locator('[data-back-layer="child"]')).toHaveCount(0);
  await expect(page.locator('[data-back-layer="parent"]')).toBeVisible();
  expect(await page.evaluate(()=>window.__layerCalls)).toEqual({parent:0,child:1});
  await page.goBack();await expect(page.locator("[data-back-layer]")).toHaveCount(0);await layersClosed(page,url,state);
  expect(await page.evaluate(()=>window.__layerCalls)).toEqual({parent:1,child:1});
});

test("React real: pushState fallido no convierte Cancelar en salida de la página",async({page})=>{
  const {fixture,url,state}=await layers(page,true);
  await fixture.getByRole("button",{name:"Abrir padre",exact:true}).click();await expect(page.locator('[data-back-layer="parent"]')).toBeVisible();
  await fixture.getByRole("button",{name:"Cerrar padre",exact:true}).click();await layersClosed(page,url,state);
});

test("React real: cierre debajo de ruta externa conserva su URL/estado y el retorno salta la retirada",async({page})=>{
  const {fixture,url,state}=await layers(page);
  await fixture.getByRole("button",{name:"Abrir padre",exact:true}).click();await expect(page.locator('[data-back-layer="parent"]')).toBeVisible();
  await page.evaluate(()=>history.pushState({route:"external",keep:[1,2]},"","/privacy.html#external"));
  await fixture.getByRole("button",{name:"Cerrar padre",exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>_mcBackStack.length)).toBe(0);
  await expect(page).toHaveURL(new URL("/privacy.html#external",url).href);
  expect(await page.evaluate(()=>history.state)).toEqual({route:"external",keep:[1,2]});
  await page.goBack();await layersClosed(page,url,state);
});
