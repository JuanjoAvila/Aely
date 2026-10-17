import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";
import fs from "node:fs";

const settingsNames={es:"Ir a Ajustes",en:"Go to Settings",ca:"Ves a Ajustos"};

async function start(page,lang,previous=false){
  await seedLoggedInDashboard(page,{settings:{autoPrices:false,theme:"green",lang}});
  let previousUrl;
  if(previous){
    await page.goto("/privacy.html");
    previousUrl=page.url();
    // serve redirige .html a la ruta limpia: el historial guarda el destino real,
    // no el nombre del fichero pedido (revisión externa 2026-10-09).
    const prior=new URL(previousUrl);
    expect(prior.origin).toBe(new URL(test.info().project.use.baseURL).origin);
    expect(prior.pathname).toMatch(/^\/privacy(?:\.html)?$/);
    expect(prior.search).toBe("");expect(prior.hash).toBe("");
    await expect(page).toHaveTitle("Privacidad — Aely");
    await expect(page.getByRole("heading",{name:"Privacidad y datos",exact:true})).toBeVisible();
  }
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
  return previousUrl;
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
    const previousUrl=await start(page,"es",true);
    const appUrl=page.url();
    await handover(page,"es");
    await closeSettings(page,method);
    await expect(page).toHaveURL(appUrl);
    await expect.poll(()=>page.evaluate(()=>({stack:_mcBackStack.length,pending:_mcIgnorePop})))
      .toEqual({stack:0,pending:false});
    // Navegación real previa: una entrada muerta obligaría a pulsar dos veces.
    await page.goBack();
    await expect(page).toHaveURL(previousUrl);
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

test("Ask de Perfil cancela el diálogo una vez y conserva Perfil",async({page})=>{
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
  await ask.locator("input").fill("Persona sintética");
  await page.goBack();await expect(ask).toHaveCount(0);
  await expect(page.locator(".profile-pull.open")).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>_mcBackStack.length)).toBe(1);
  expect(await page.evaluate(()=>window.__askResolutions.map(r=>r.calls))).toEqual([1]);
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

/* UX13: señal de teclado explícita; Chromium no acredita un IME Android. */
async function ux13Viewport(page){
  await page.setViewportSize({width:393,height:844});
  await page.addInitScript(()=>{
    const vv=new EventTarget();let gap=0;
    Object.defineProperties(vv,{
      height:{get:()=>window.innerHeight-gap},width:{get:()=>window.innerWidth},
      offsetTop:{value:0},offsetLeft:{value:0},scale:{value:1},
    });
    Object.defineProperty(window,"visualViewport",{value:vv,configurable:true});
    window.__ux13Keyboard={gap:0,blurCalls:0};
    window.__ux13SetKeyboard=function(value){
      gap=value;window.__ux13Keyboard.gap=value;vv.dispatchEvent(new Event("resize"));
    };
    // El doble sólo oculta al desenfocar un editor; no simula el callback Atrás de producto.
    document.addEventListener("blur",function(e){
      if(gap&&e.target.matches&&e.target.matches('input,textarea,[contenteditable="true"]')){
        window.__ux13Keyboard.blurCalls++;window.__ux13SetKeyboard(0);
      }
    },true);
  });
}

async function ux13Settled(page){
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
}

async function ux13Start(page,method){
  if(method!=="browser") await nativeButton(page);
  await ux13Viewport(page);
  const previous=await start(page,"es",true),url=page.url();
  return {previous,url,before:await financial(page)};
}

async function ux13Back(page,method){
  if(method==="browser") await page.goBack();
  else await page.evaluate(()=>{
    if(typeof window.__backButton!=="function") throw Error("El listener App no está registrado");
    window.__backButton();
  });
}

async function ux13OpenAsk(page){
  await page.evaluate(()=>{
    const emit=askEmit;window.__ux13Ask=[];
    askEmit=function(o){
      const record={calls:0},resolve=o.resolve;window.__ux13Ask.push(record);
      emit(Object.assign({},o,{resolve:function(value){record.calls++;resolve(value);}}));
    };
  });
  await page.locator(".v4-avatar").click();
  const basic=await page.evaluate(()=>t("pf_basic"));
  await page.locator(".profile-pull .profile-row").filter({hasText:basic}).click();
  const ask=page.locator(".askback [role=dialog]");await expect(ask).toBeVisible();
  await ask.locator("input").fill("Persona sintética UX13");
  return ask;
}

for(const method of ["browser","native"]) for(const keyboard of [true,false]){
  test(`UX13: Ask conserva borrador en primer atrás sólo con teclado visible: ${method}/${keyboard}`,async({page})=>{
    const {previous,url,before}=await ux13Start(page,method);
    const profileBefore=await page.evaluate(()=>JSON.parse(localStorage.getItem("micartera_v3")).settings.profile);
    const ask=await ux13OpenAsk(page);
    if(keyboard) await page.evaluate(()=>window.__ux13SetKeyboard(300));
    await ux13Settled(page);
    // Foco sin reducción de viewport es el control de teclado físico: no debe consumir otro atrás.
    await expect(ask.locator("input")).toBeFocused();
    await ux13Back(page,method);
    if(keyboard){
      await expect(ask).toBeVisible();
      await expect(ask.locator("input")).toHaveValue("Persona sintética UX13");
      await expect.poll(()=>page.evaluate(()=>window.__ux13Keyboard.gap)).toBe(0);
      expect(await page.evaluate(()=>window.__ux13Ask.map(x=>x.calls))).toEqual([0]);
      expect(await financial(page)).toEqual(before);await expect(page).toHaveURL(url);
      await ux13Back(page,method);
    }
    await expect(ask).toHaveCount(0);
    await expect(page.locator(".profile-pull.open")).toBeVisible();
    expect(await page.evaluate(()=>window.__ux13Ask.map(x=>x.calls))).toEqual([1]);
    expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("micartera_v3")).settings.profile)).toEqual(profileBefore);
    await ux13Back(page,method);
    await expect(page.locator(".profile-pull.open")).toHaveCount(0);
    await expect.poll(()=>page.evaluate(()=>({stack:_mcBackStack.length,pending:_mcIgnorePop})))
      .toEqual({stack:0,pending:false});
    await expect(page).toHaveURL(url);expect(await financial(page)).toEqual(before);
    if(method!=="browser") expect(await page.evaluate(()=>window.__backExitCalls)).toBe(0);
    // Una sola travesía final conserva el historial real previo, sin entradas muertas.
    await page.goBack();await expect(page).toHaveURL(previous);
  });
}

async function ux13Bills(page){
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  const manage=await page.evaluate(()=>t("v4_gestionar"));
  await page.locator('.v4-screen > [data-seg="recibos"]').getByRole("button",{name:manage,exact:true}).click();
  const hub=page.locator("[data-bills-manage]");await expect(hub).toBeVisible();
  await hub.locator('[data-act="bill-add"]').first().click();
  const wizard=page.locator('[data-sheet="bill-add"]');await expect(wizard).toHaveAttribute("data-step","what");
  // El foco inicial del título llega en rAF después de autoFocus. Escribir antes deja que
  // ese callback quite el foco al campo y el doble oculte el teclado antes del gesto.
  await expect(wizard.locator("h1")).toBeFocused();
  const input=wizard.locator("input.v4-bills-search");await input.fill("Recibo sintético UX13");
  await page.evaluate(()=>window.__ux13SetKeyboard(300));
  await expect.poll(()=>input.evaluate(el=>({focused:document.activeElement===el,
    gap:window.__ux13Keyboard.gap,keyboard:_mcBackCloseNative("peek")===el})))
    .toEqual({focused:true,gap:300,keyboard:true});
  expect(await page.evaluate(()=>window.__mcNativeEdgeBackActive)).toBe(true);
  return {hub,wizard,input};
}

async function ux13Edge(page,phase,progress=0){
  await page.evaluate(({phase,progress})=>{
    // El puente entrega phase/progress en el propio evento; detail no ejercitaría esta ruta.
    window.dispatchEvent(Object.assign(new Event("mcNativeEdgeBack"),{phase,progress}));
  },{phase,progress});
}

for(const hideBeforeInvoke of [false,true]){
  test(`UX13: predictivo conserva alta y hub al ocultar teclado: hideAntesInvoke=${hideBeforeInvoke}`,async({page})=>{
    const {previous,url,before}=await ux13Start(page,"native");
    const {hub,wizard,input}=await ux13Bills(page);
    const transform=await wizard.evaluate(el=>el.parentElement.style.transform);
    await ux13Edge(page,"start");await ux13Edge(page,"progress",0.55);
    expect(await wizard.evaluate(el=>el.parentElement.style.transform)).toBe(transform);
    if(hideBeforeInvoke) await page.evaluate(()=>window.__ux13SetKeyboard(0));
    await ux13Edge(page,"invoke",1);
    // Esperar el desenfoque real también descubre un cierre indebido diferido: al desmontar
    // ya no quedaría hoja para las aserciones siguientes. No depender de una pausa fija.
    await expect(input).not.toBeFocused();
    await expect(wizard).toHaveAttribute("data-step","what");await expect(hub).toBeVisible();
    await expect(wizard.locator("input.v4-bills-search")).toHaveValue("Recibo sintético UX13");
    await expect.poll(()=>page.evaluate(()=>window.__ux13Keyboard.gap)).toBe(0);
    await expect(page).toHaveURL(url);expect(await financial(page)).toEqual(before);
    expect(await page.evaluate(()=>window.__backExitCalls)).toBe(0);
    // El siguiente gesto debe seguir funcionando, sin un temporizador que lo absorba.
    await ux13Edge(page,"start");await ux13Edge(page,"progress",0.55);await ux13Edge(page,"invoke",1);
    await expect(wizard).toHaveCount(0);await expect(hub).toBeVisible();
    await page.goBack();await expect(hub).toHaveCount(0);
    await expect.poll(()=>page.evaluate(()=>({stack:_mcBackStack.length,pending:_mcIgnorePop})))
      .toEqual({stack:0,pending:false});
    await expect(page).toHaveURL(url);expect(await financial(page)).toEqual(before);
    await page.goBack();await expect(page).toHaveURL(previous);
  });
}

test("UX13: cancelar predictivo con teclado conserva hoja, valor y geometría",async({page})=>{
  const {url,before}=await ux13Start(page,"native");const {wizard,input}=await ux13Bills(page);
  const x=await wizard.evaluate(el=>el.parentElement.getBoundingClientRect().x);
  await ux13Edge(page,"start");await ux13Edge(page,"progress",0.4);
  expect(await wizard.evaluate(el=>el.parentElement.getBoundingClientRect().x)).toBeCloseTo(x,1);
  await ux13Edge(page,"cancel");
  await expect(input).toBeFocused();
  await expect(wizard).toHaveAttribute("data-step","what");
  await expect(wizard.locator("input.v4-bills-search")).toHaveValue("Recibo sintético UX13");
  expect(await wizard.evaluate(el=>el.parentElement.getBoundingClientRect().x)).toBeCloseTo(x,1);
  expect(await page.evaluate(()=>window.__ux13Keyboard.gap)).toBe(300);
  expect(await financial(page)).toEqual(before);await expect(page).toHaveURL(url);
});
