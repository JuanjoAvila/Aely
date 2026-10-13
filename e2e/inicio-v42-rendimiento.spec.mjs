/* ENTRAR EN INICIO Y ARRASTRAR LA GRÁFICA CON HISTORIAL GRANDE, A CPU x6.
 *
 * Qué mide: con 20.000 movimientos y 400 cierres de cuenta, (1) la entrada de Inicio —los 1,4 s
 * desde que se levanta el splash, con el contador del patrimonio repintando la tarjeta en cada
 * frame y la gráfica dibujándose— y (2) arrastrar el dedo por la gráfica van a 50 fps o más, y
 * abrir el presupuesto responde en menos de 100 ms.
 *
 * Qué NO mide, a propósito (13/10/2026): el ARRANQUE ni la llegada de la nube. Con CPU x6 desde
 * la carga, el pull de este historial terminaba alrededor de los 1800 ms que el splash espera a
 * la nube (`ESPERA_NUBE`, src/shell.html): unas veces el splash se levantaba con la nube ya
 * aplicada (60 fps) y otras vencía la espera y todo el trabajo del pull caía dentro de la
 * ventana (33-44 fps), sin que cambiara el código. Además las divisas se pedían a
 * api.frankfurter.dev DE VERDAD. Ese tirón de arranque existe y es trabajo aparte; aquí no se
 * esconde subiendo el umbral ni con reintentos: se deja fuera de una medida que no era la suya.
 *
 * Cómo se hace determinista:
 *  - Sin red: divisas simuladas, comprobación de actualizaciones cortada y copia diaria ya hecha
 *    (su escritura llega 4 s después del arranque, a mitad de cualquier medida).
 *  - El arranque corre a CPU normal y DETRÁS del splash, que se retiene parando `Date.now` (lo
 *    único que mira su vigilante). Solo cuando la nube está aplicada, guardada y pintada, y no
 *    queda ninguna petición en vuelo, se pone el freno x6 y se suelta el reloj: el splash se
 *    levanta por su camino normal y la entrada que se mide es la de verdad, entera a x6.
 *  - La ventana la abre y la cierra la página con `mc-splash-gone`; fuera se espera a ciegas
 *    (AGENTS §7 bis: ni `locator.click()` ni esperas que sondean dentro de la ventana).
 * Comprobado que distingue bueno de malo (13/10): ordenando 20.000 textos en cada render de la
 * tarjeta del patrimonio, la entrada baja de 60 a 43-46 fps y el spec cae las tres veces. Lo que
 * NO caza: el mismo peso en el render de Inicio entero, que no se repinta en cada frame (sube el
 * toque de 13 a ~50 ms, bajo su tope de 100), ni perder el memo de los periodos con 400 puntos. */
import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, installFixtureClock, FIXTURE_NOW } from "./fixtures.mjs";

test("Inicio y arrastre con historial grande a CPU x6",async({page},testInfo)=>{
  await installFixtureClock(page);
  const now=FIXTURE_NOW;
  const history=Array.from({length:400},(_,i)=>({day:new Date(now-(399-i)*864e5).toISOString().slice(0,10),value:50000+i}));
  const expenses=Array.from({length:20000},(_,i)=>({id:"s"+i,date:new Date(now-i*864e5/100).toISOString(),amount:1,category:"super",ent:"sabadell",merchant:"Comercio sintético"}));
  await seedLoggedInDashboard(page,{expenses,accounts:[{id:"a",ent:"sabadell",name:"Cuenta sintética",value:60000,role:"diario",spendFrom:true}],accountBalanceHistory:{"acc:a":history},budget:10000,
    lastBackup:new Date(now).toISOString().slice(0,10)});
  const fuera=[];let enVuelo=0;
  await page.route(/api\.frankfurter\.(dev|app)/,route=>route.fulfill({json:{amount:1,base:"EUR",date:"2026-09-25",rates:{USD:1.08,GBP:0.86,TRY:54.761}}}));
  await page.route("https://juanjoavila.github.io/Aely/**",route=>route.abort());
  page.on("request",r=>{enVuelo++;const u=r.url();if(!/^(https?:\/\/(127\.0\.0\.1|localhost)[:/]|data:|blob:)/.test(u)&&!/api\.frankfurter\.|juanjoavila\.github\.io\/Aely\//.test(u))fuera.push(u);});
  page.on("requestfinished",()=>{enVuelo--;});page.on("requestfailed",()=>{enVuelo--;});
  await page.addInitScript(()=>{
    // El splash se retiene con el reloj parado; al soltarlo vuelve a la hora de verdad.
    const real=Date.now.bind(Date),parado=real();let suelto=false;
    Date.now=()=>suelto?real():parado;
    window.__v42Soltar=()=>{suelto=true;};
    window.__v42Frames=[];window.__v42Recording=false;let prev=0;
    function tick(now){if(window.__v42Recording&&prev)window.__v42Frames.push(now-prev);prev=now;requestAnimationFrame(tick);}requestAnimationFrame(tick);
    window.addEventListener("mc-splash-gone",()=>{
      window.__v42ConNube=window.__mcBootReady===true&&window.__mcSplashTimedOut!==true;
      prev=0;window.__v42Frames=[];window.__v42Recording=true;
      setTimeout(()=>{window.__v42Recording=false;window.__v42Entry=window.__v42Frames.slice();},1400);
    });
  });
  const client=await page.context().newCDPSession(page);
  await page.goto("/",{waitUntil:"domcontentloaded"});
  // Nube aplicada y guardada (`lastSync` es la última escritura del pull) con Inicio ya montado.
  await page.waitForFunction(()=>{
    const root=document.getElementById("root");
    if(window.__mcBootReady!==true||!root||!root.childElementCount)return false;
    try{return JSON.parse(localStorage.getItem("micartera_v3")||"{}").lastSync>0;}catch(e){return false;}
  },null,{timeout:45_000});
  await expect.poll(()=>enVuelo,{timeout:20_000}).toBe(0);
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  expect(await page.evaluate(()=>!!document.getElementById("mc-load")&&!window.__mcSplashGone),"el splash se levantó antes de tiempo: la muestra no vale").toBe(true);
  await client.send("Emulation.setCPUThrottlingRate",{rate:6});
  await page.evaluate(()=>window.__v42Soltar());
  await page.waitForTimeout(4000);   // a ciegas: retirada del splash (~0,2 s) más la ventana de 1,4 s
  const entrada=await page.evaluate(()=>({frames:window.__v42Entry,conNube:window.__v42ConNube}));
  expect(entrada.conNube,"el splash no se levantó con la nube aplicada: la muestra no vale").toBe(true);
  const entry=entrada.frames;
  expect(Array.isArray(entry)).toBe(true);expect(entry.length).toBeGreaterThan(10);
  await expect(page.locator(".v42-net-chart")).toBeVisible();
  await dismissNews(page);
  // Click crudo y espera ciega: el sondeo de Playwright no forma parte de la medida.
  const interaction=await page.evaluate(()=>{const started=performance.now();document.querySelector(".v42-cycle").click();return new Promise(resolve=>requestAnimationFrame(()=>resolve({ms:performance.now()-started,opened:!!document.querySelector(".v4-budget-sheet")})));});
  expect(interaction.opened).toBe(true);
  await page.evaluate(()=>history.back());await page.waitForTimeout(1400);
  await expect(page.locator(".v4-budget-sheet")).toHaveCount(0);
  const box=await page.locator(".v42-net-chart").boundingBox();
  await page.evaluate(()=>{window.__v42Frames=[];window.__v42Recording=true;});
  await client.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x:box.x+10,y:box.y+40}]});
  for(let i=0;i<60;i++){
    await client.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x:box.x+10+(box.width-20)*i/59,y:box.y+40}]});
    await page.waitForTimeout(16);
  }
  // El arrastre aterrizó: con el dedo aún puesto, la gráfica enseña la fecha del punto tocado.
  const consultando=await page.evaluate(()=>!!document.querySelector('[data-testid="inicio-net-date"]'));
  await client.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
  const drag=await page.evaluate(()=>{window.__v42Recording=false;return window.__v42Frames;});
  expect(consultando,"el arrastre no consultó la gráfica: la muestra no vale").toBe(true);
  expect(drag.length).toBeGreaterThan(10);
  const stats=values=>({frames:values.length,fps:1000/(values.reduce((a,b)=>a+b,0)/values.length),over32:values.filter(n=>n>32).length,max:Math.max(...values)});
  const evidence={cpuRate:6,expenses:20000,accountPoints:400,entry:stats(entry),drag:stats(drag),interaction};
  await testInfo.attach("inicio-v42-cpu6",{body:JSON.stringify(evidence,null,2),contentType:"application/json"});
  expect(evidence.entry.fps).toBeGreaterThanOrEqual(50);expect(evidence.drag.fps).toBeGreaterThanOrEqual(50);expect(interaction.ms).toBeLessThan(100);
  await expect(page.locator('.botnav-tab[data-tour="inicio"].active')).toBeVisible();await expect(page.getByTestId("inicio-net-date")).toHaveCount(0);
  expect(fuera,"el spec no puede depender de la red").toEqual([]);
  await client.send("Emulation.setCPUThrottlingRate",{rate:1});await client.detach();
});
