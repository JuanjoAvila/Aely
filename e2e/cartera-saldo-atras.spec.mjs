/* Atrás debe usar el guardado vigente al terminar la salida, no el onSaldo que capturó
 * al abrir. El gasto recibido cambia la base, pero NO el saldo que acaba de teclear. */
import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

const cases = [
  { name:"nativo con gasto antes de cerrar", method:"native", expense:"before", typed:"12.34", cents:1241 },
  { name:"navegador con gasto antes de cerrar", method:"browser", expense:"before", typed:"12.34", cents:1241 },
  { name:"nativo con gasto durante la salida", method:"native", expense:"during", typed:"12.34", cents:1241 },
  { name:"arrastre real con gasto durante la salida", method:"swipe", expense:"during", typed:"12.34", cents:1241 },
  { name:"saldo negativo de un céntimo", method:"native", typed:"-0.01", cents:-1 },
  { name:"borrador vacío conserva saldo", method:"native", typed:null, cents:5000 },
  { name:"conectada conserva saldo bancario", method:"native", typed:null, connected:true, cents:5000 },
  { name:"movimiento reducido conserva guardado", method:"native", typed:"12.34", reduced:true, cents:1234 },
];

async function incomingExpense(page){
  // El doble simula una actualización externa por el set REAL del padre mientras el portal
  // sigue abierto. No modifica callbacks, fórmulas, refs ni localStorage para fabricar el resultado.
  await page.evaluate(()=>{
    const el=document.querySelector(".v4-sheet");
    let f=el[Object.keys(el).find(k=>k.startsWith("__reactFiber$"))];
    while(f&&f.type?.name!=="AccountSheet") f=f.return;
    if(!f) throw new Error("No se encontró AccountSheet");
    f.memoizedProps.set(s=>Object.assign({},s,{expenses:(s.expenses||[]).concat([{
      id:"saldo-atras-gasto",ent:"efectivo",amount:.07,date:new Date().toISOString(),
      merchant:"Gasto sintético",category:"super"
    }])}));
  });
}

async function close(page, method){
  if(method==="native") await page.evaluate(()=>window.__saldoBack());
  else if(method==="browser") await page.goBack();
  else {
    // NumPad puede haber desplazado la hoja para enseñar la última tecla. El arrastre de
    // cierre parte del asa visible y de su borde superior, no del scroll de contenido.
    await page.locator(".v4-sheet-handle").scrollIntoViewIfNeeded();
    const b=await page.locator(".v4-sheet-handle").boundingBox();
    expect(b).not.toBeNull();
    const cdp=await page.context().newCDPSession(page),x=b.x+b.width/2,y=b.y+b.height/2;
    await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x,y}]});
    for(const d of [20,55,100,130]) await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x,y:y+d}]});
    await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
    await cdp.detach();
  }
}

test.afterEach(async({page},info)=>{
  const observation=await page.evaluate(()=>({motion:window.__saldoMotion,
    connected:window.__saldoClosingElement?.isConnected,scrollTop:window.__saldoClosingElement?.scrollTop,
    transform:window.__saldoClosingElement?.style.transform})).catch(()=>null);
  await info.attach("observacion-cierre",{body:JSON.stringify(observation),contentType:"application/json"});
});

for(const c of cases) test("Saldo al cerrar: "+c.name, async({page},info)=>{
  const errors=[];page.on("pageerror",e=>errors.push(String(e)));
  await page.route("**/*",route=>new URL(route.request().url()).origin===new URL(info.project.use.baseURL).origin?route.continue():route.abort());
  await page.emulateMedia({reducedMotion:c.reduced?"reduce":"no-preference"});
  await page.addInitScript(()=>{
    window.__saldoExits=0;
    window.Capacitor={isNativePlatform:()=>false,Plugins:{App:{
      addListener(name,fn){ if(name==="backButton")window.__saldoBack=fn; return {remove(){}}; },
      exitApp(){ window.__saldoExits++; }
    }}};
  });
  await seedLoggedInDashboard(page,{
    accounts:[{id:"saldo-atras-cash",ent:"efectivo",name:"Caja sintética",value:50,role:"fijos",...(c.connected?{bankIban:"SYNTHETIC"}:{})}],
    expenses:[],investments:[],debts:[],assets:[],fixed:[],flows:[],oneoffs:[],goals:[],
    settings:{autoPrices:false,theme:"green",expenseBanks:["efectivo"],dailyOnlyBanks:["efectivo"]}
  });
  await page.goto("/");await expect(page.locator(".botnav")).toBeVisible();
  await page.locator("#mc-load").waitFor({state:"detached"});await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="cartera"]').click();
  const row=page.locator(".v4-card-list button.v4-mov").filter({hasText:"Efectivo"}).first();
  await row.click();const sheet=page.locator(".v4-sheet");await expect(sheet).toBeVisible();
  const fix=sheet.getByRole("button",{name:/Corregir saldo|Fix balance/i});
  if(c.connected) await expect(fix).toHaveCount(0);
  else {
    await fix.click(); // También el borrador vacío se abre realmente, sin escribir.
    if(c.typed){
      if(c.typed.startsWith("-"))await sheet.getByRole("button",{name:/Cambiar signo|Change sign/i}).click();
      for(const k of c.typed.replace("-",""))await sheet.locator(".v4-keys button").filter({hasText:new RegExp(k==="."?"^[.,]$":"^"+k+"$")}).click();
    }
  }
  if(c.expense==="before"){
    await incomingExpense(page);await expect(sheet.locator(".v4-account-amount")).toHaveText("49,93 €");
  }
  await page.evaluate(()=>{
    const el=document.querySelector(".v4-sheet");
    window.__saldoMotion={styles:[],touches:0};window.__saldoClosingElement=el;
    el.addEventListener("touchstart",()=>window.__saldoMotion.touches++);
    new MutationObserver(()=>window.__saldoMotion.styles.push({transform:el.style.transform,transition:el.style.transition}))
      .observe(el,{attributes:true,attributeFilter:["style"]});
  });
  await close(page,c.method);
  if(c.expense==="during"){
    // Debe existir la MISMA hoja saliendo: si ya desapareció no se ha probado esta carrera.
    expect(await page.evaluate(()=>window.__saldoClosingElement.isConnected)).toBe(true);
    expect(await page.evaluate(()=>window.__saldoClosingElement.style.transform.includes("110%")),"la salida ya ha empezado").toBe(true);
    await incomingExpense(page);
  }
  await expect(sheet).toHaveCount(0);
  await expect.poll(()=>page.evaluate(()=>({stack:_mcBackStack.length,pending:_mcIgnorePop}))).toEqual({stack:0,pending:false});
  const motion=await page.evaluate(()=>window.__saldoMotion);
  if(c.method==="swipe")expect(motion.touches,"el gesto aterriza en la hoja").toBeGreaterThan(0);
  // Beta141 distingue la salida desde parado (420ms) de continuar el arrastre (300ms).
  const closeMs=c.method==="swipe"?300:420;
  expect(motion.styles.some(s=>s.transform.includes("110%")&&s.transition.includes(closeMs+"ms")),"salida por el compositor").toBe(!c.reduced);
  await row.click();await expect(sheet).toBeVisible();
  await expect(sheet.locator(".v4-account-amount")).toHaveText(c.typed===null?"50,00 €":c.typed.replace(".",",")+" €");
  // Persistencia NATURAL: se espera su debounce, sin pagehide ni flush artificial. Comparar
  // céntimos enteros detecta 1234/1227 frente a la base1241 y saldo1234 esperados.
  await expect.poll(()=>page.evaluate(()=>Math.round(JSON.parse(localStorage.getItem("micartera_v3")).accounts.find(a=>a.id==="saldo-atras-cash").value*100))).toBe(c.cents);
  const stored=await page.evaluate(()=>({state:JSON.parse(localStorage.getItem("micartera_v3")),expenses:JSON.parse(localStorage.getItem("micartera_v3_exp")||"[]")}));
  expect(stored.expenses.map(e=>({id:e.id,cents:Math.round(e.amount*100)}))).toEqual(c.expense?[{id:"saldo-atras-gasto",cents:7}]:[]);
  expect(await page.evaluate(()=>window.__saldoExits)).toBe(0);expect(errors).toEqual([]);
  await info.attach("saldo-y-animacion",{body:JSON.stringify({case:c,storedCents:c.cents,motion}),contentType:"application/json"});
});
