import { test, expect, devices } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { seedLoggedInDashboard, dismissNews, estadoHeredado } from "./fixtures.mjs";

test.use({ viewport:{width:412,height:915},timezoneId:"Europe/Madrid",serviceWorkers:"block" });
test.describe.configure({retries:0});
const today="2026-10-14";
const currentAmount=mode=>mode==="con-efectivo"?"18.622,44":mode.startsWith("transfer-")?"18.302,40":"18.502,44";
async function abrir(page,mode,prior=false,lang="es"){
  const state=estadoHeredado(today);
  if(mode!=="con-efectivo"){
    state.accounts=state.accounts.filter(a=>a.ent!=="efectivo");
    delete state.accountBalanceHistory["acc:cash"];
  }
  const transfer=mode.startsWith("transfer-");
  state.expenses.push({id:"own-out",date:"2026-10-01T12:00:00Z",amount:transfer?300.07:100.03,merchant:transfer?"Pago sintético":"RETIRADA CAJERO",category:transfer||mode==="traspaso-cajero"?"traspaso":"otros",ent:"sabadell",source:"manual"});
  if(mode==="transfer-pair")state.expenses.push({id:"own-in",date:"2026-10-04T23:59:00+02:00",amount:-300.07,merchant:"Entrada sintética",category:"otros",ent:"caixabank"});
  if(prior) await page.route(/http:\/\/127\.0\.0\.1:\d+\/$/,async route=>{
    const response=await route.fetch(),html=await response.text();
    const old=transfer?html.replace('if(transit||e.category==="inversion"||(e.category==="traspaso"&&linked)) contribs.push','if(!transit&&!row.ownTransfer&&e.category==="traspaso"&&!linked) return;\n    if(transit||e.category==="inversion"||(e.category==="traspaso"&&linked)) contribs.push'):html.replace('if(!hasCash) daily[day]=(daily[day]||0)-row.cents;', 'if(false) daily[day]=(daily[day]||0)-row.cents;');
    expect(old).not.toBe(html);
    await route.fulfill({response,body:old});
  });
  // Como installFixtureClock: Date parte del día financiero y sigue avanzando. Fijarlo
  // del todo deja el splash y el importe animado a cero; los temporizadores quedan nativos.
  await page.addInitScript(epoch=>{
    const NativeDate=Date,offset=epoch-NativeDate.now();
    function FixtureDate(...args){const values=args.length?args:[NativeDate.now()+offset];return new.target?Reflect.construct(NativeDate,values,new.target):new NativeDate(NativeDate.now()+offset).toString();}
    Object.setPrototypeOf(FixtureDate,NativeDate);FixtureDate.prototype=NativeDate.prototype;
    FixtureDate.now=()=>NativeDate.now()+offset;window.Date=FixtureDate;
  },Date.parse(today+"T12:00:00Z"));
  await seedLoggedInDashboard(page,{__seedOnce:true,...state,settings:{...state.settings,lang}});
  await page.goto("/");await page.waitForFunction(()=>!document.getElementById("mc-load"),null,{timeout:5000});await dismissNews(page);
  const settings=page.locator(".settings-push.open");
  if(await settings.count()) await settings.locator(".settings-push-h .back").click();
  await expect(settings).toHaveCount(0);
  await expect(page.getByTestId("inicio-net-current").locator(".v4-hero-amt")).toContainText(currentAmount(mode));
  await expect(page.getByTestId("inicio-net-current").locator(".v42-net-line")).toHaveCount(1);
}
async function cifras(page){
  const hero=page.getByTestId("inicio-net-current");
  const result={now:await hero.locator(".v4-hero-amt").innerText(),card:await page.locator(".v42-cycle-amount>.serif").innerText(),delta:await hero.getByTestId("inicio-net-delta").innerText(),line:await hero.locator(".v42-net-line").getAttribute("d")};
  // Observar el clic real, sin llamar a handlers ni cambiar estado de la app.
  await page.evaluate(()=>{window.__ownNavEvents=[];[true,false].forEach(capture=>document.addEventListener("click",event=>window.__ownNavEvents.push({capture,target:event.target.tagName,text:event.target.textContent.slice(0,80),trusted:event.isTrusted,prevented:event.defaultPrevented}),{capture}));});
  await page.getByRole("button",{name:"Ver gastos ›",exact:true}).click();
  await expect(page.locator('.botnav-tab[data-tour="gastos"]')).toHaveClass(/active/);
  await expect(page.locator(".v4-gastos-summary")).toBeVisible();
  result.gastos=await page.locator(".v4-gastos-summary").innerText();
  return result;
}
async function estadoNavegacion(page){
  const state=await page.evaluate(()=>{
    const button=[...document.querySelectorAll("button")].find(el=>el.textContent.trim()==="Ver gastos ›"),parents=[];
    let fiber=button&&button[Object.keys(button).find(key=>key.startsWith("__reactFiber$"))];
    while(fiber&&parents.length<12){if(typeof fiber.type==="function")parents.push({component:fiber.type.name,onGoGastos:typeof fiber.memoizedProps?.onGoGastos});fiber=fiber.return;}
    return {tabs:[...document.querySelectorAll(".botnav-tab")].map(el=>({tab:el.dataset.tour,class:el.className})),settings:!!document.querySelector(".settings-push.open"),splash:!!document.getElementById("mc-load"),text:document.querySelector("#root")?.innerText,summary:document.querySelector(".v4-gastos-summary")?.innerText,events:window.__ownNavEvents,parents};
  }).catch(error=>({readError:String(error)}));
  // CDP sólo lee los cierres del handler real tras el fallo. No se pausa la página,
  // no se invoca el handler y no se corrige la navegación desde el banco de pruebas.
  const session=await page.context().newCDPSession(page),group="own-navigation",seen=new Set();
  try{
    const result=await session.send("Runtime.evaluate",{expression:'(()=>{const b=[...document.querySelectorAll("button")].find(e=>e.textContent.trim()==="Ver gastos ›");return b?.[Object.keys(b).find(k=>k.startsWith("__reactProps$"))]?.onClick})()',objectGroup:group});
    const scopes=[];
    const inspect=async(fn,depth)=>{
      if(!fn?.objectId||seen.has(fn.objectId)||depth>2)return;seen.add(fn.objectId);
      const props=await session.send("Runtime.getProperties",{objectId:fn.objectId});
      const list=props.internalProperties?.find(p=>p.name==="[[Scopes]]")?.value?.objectId;if(!list)return;
      const items=await session.send("Runtime.getProperties",{objectId:list,ownProperties:true});
      for(const item of items.result){
        if(!item.value?.objectId||!item.value.description?.startsWith("Closure"))continue;
        const values=await session.send("Runtime.getProperties",{objectId:item.value.objectId,ownProperties:true}),row={scope:item.value.description,values:{}};
        for(const value of values.result.filter(v=>["onGoGastos","tabIds","tabRef","tab","goTab","goTabTop"].includes(v.name))){
          row.values[value.name]=value.value?.value??value.value?.description;
          if(["tabIds","tabRef"].includes(value.name)&&value.value?.objectId){const data=await session.send("Runtime.getProperties",{objectId:value.value.objectId,ownProperties:true});row.values[value.name]=Object.fromEntries(data.result.filter(v=>v.name==="current"||/^\d+$/.test(v.name)).map(v=>[v.name,v.value?.value??v.value?.description]));}
          if(value.name==="onGoGastos")await inspect(value.value,depth+1);
        }
        if(Object.keys(row.values).length)scopes.push(row);
      }
    };
    await inspect(result.result,0);state.handlerScopes=scopes;
  }catch(error){state.scopeReadError=String(error);}
  finally{await session.send("Runtime.releaseObjectGroup",{objectGroup:group}).catch(()=>{});await session.detach();}
  return state;
}
test("base132: abrir Gastos con la misma cartera y contexto",{annotation:{type:"own-clock",description:"14/10/2026"}},async({browser},testInfo)=>{
  // Comparación pedida por Claude: bundle exacto de 132, sin ninguna regla propia.
  // El mismo contexto y la misma acción permiten comprobar el fallo antes de ampliar scope.
  const baseline=execFileSync("git",["show","7865111be8e2e1f8994bccba4b515bf4c6193074:public/index.html"],{encoding:"utf8",maxBuffer:8e6});
  const context=await browser.newContext({...devices["Pixel 5"],baseURL:testInfo.project.use.baseURL,viewport:{width:412,height:915},timezoneId:"Europe/Madrid",serviceWorkers:"block"});
  const page=await context.newPage(),errors=[];let original;
  page.on("pageerror",error=>errors.push(String(error.stack||error)));
  page.on("console",message=>{if(message.type()==="error")errors.push(message.text());});
  await page.route(/http:\/\/127\.0\.0\.1:\d+\/$/,route=>route.fulfill({status:200,contentType:"text/html; charset=utf-8",body:baseline}));
  try{
    await abrir(page,"sin-efectivo");const values=await cifras(page);
    await testInfo.attach("base132-financial-values",{body:Buffer.from(JSON.stringify(values,null,2)),contentType:"application/json"});
  }catch(error){
    original=error;
    const state=await estadoNavegacion(page).catch(error=>({readError:String(error)}));
    await testInfo.attach("base132-navigation",{body:Buffer.from(JSON.stringify({errors,state},null,2)),contentType:"application/json"});
    await page.screenshot({path:testInfo.outputPath("base132-navigation.png"),fullPage:true}).catch(()=>{});
    throw error;
  }finally{try{await context.close();}catch(error){if(!original)throw error;}}
});
for(const mode of ["sin-efectivo","con-efectivo","traspaso-cajero","transfer-alone","transfer-pair"]) test("reservas: gráfica y cifras actuales antes/después "+mode,{annotation:{type:"own-clock",description:"14/10/2026"}},async({browser},testInfo)=>{
  const read=async prior=>{
    const context=await browser.newContext({...devices["Pixel 5"],baseURL:testInfo.project.use.baseURL,viewport:{width:412,height:915},timezoneId:"Europe/Madrid",serviceWorkers:"block"});
    const page=await context.newPage(),errors=[];let original;
    page.on("pageerror",error=>errors.push(String(error.stack||error)));
    page.on("console",message=>{if(message.type()==="error")errors.push(message.text());});
    try{await abrir(page,mode,prior);return await cifras(page);}
    catch(error){
      original=error;
      // Un fallo de navegación debe conservar la excepción de la página y el estado
      // visible; cerrar el contexto no puede tapar el primer error de la comparación.
      const state=await estadoNavegacion(page).catch(error=>({readError:String(error)}));
      await testInfo.attach((prior?"before":"after")+"-navigation",{body:Buffer.from(JSON.stringify({errors,state},null,2)),contentType:"application/json"});
      await page.screenshot({path:testInfo.outputPath((prior?"before":"after")+"-navigation.png"),fullPage:true}).catch(()=>{});
      throw error;
    }finally{try{await context.close();}catch(error){if(!original)throw error;}}
  };
    const old=await read(true),next=await read(false);
    expect({now:next.now,card:next.card,gastos:next.gastos}).toEqual({now:old.now,card:old.card,gastos:old.gastos});
    expect(next.now).toContain(currentAmount(mode));
    await testInfo.attach("financial-before-after",{body:Buffer.from(JSON.stringify({mode,before:old,after:next},null,2)),contentType:"application/json"});
    if(mode==="con-efectivo"||mode==="transfer-pair"){expect(next.delta).toBe(old.delta);expect(next.line).toBe(old.line);}
    else {expect(next.delta).not.toBe(old.delta);expect(next.line).not.toBe(old.line);}
});
for(const lang of ["es","en","ca"]) test("hoja explica cuándo cuenta el cajero "+lang,{annotation:{type:"own-clock",description:"14/10/2026"}},async({page})=>{
  await abrir(page,"sin-efectivo",false,lang);
  await page.getByTestId("inicio-net-current").locator(".v42-net-info").click();
  const sheet=page.locator('[data-sheet="net-info"]');await expect(sheet).toBeVisible();
  await expect(sheet.getByTestId("inicio-net-atm-rule")).toHaveText({es:"Las retiradas en cajero solo son neutras si hay una cuenta o bolsillo de efectivo en la app. Sin él, restan del patrimonio registrado.",en:"Cash withdrawals are neutral only when the app has a cash account or pocket. Without one, they reduce recorded net worth.",ca:"Les retirades al caixer només són neutres si hi ha un compte o una butxaca d'efectiu a l'app. Sense això, resten del patrimoni registrat."}[lang]);
  await expect(sheet.getByTestId("inicio-net-transfer-rule")).toHaveText({es:"Un traspaso solo es neutro si hay una entrada del mismo importe en otra cuenta propia en un máximo de tres días, está enlazado a un bróker o corresponde a una aportación periódica. Sin esa prueba, cuenta como salida.",en:"A transfer is neutral only with an incoming transaction of the same amount in another own account within three days, a linked broker or a matching regular contribution. Without that evidence, it counts as an outflow.",ca:"Un traspàs només és neutre si hi ha una entrada del mateix import en un altre compte propi en un màxim de tres dies, està enllaçat a un bróker o correspon a una aportació periòdica. Sense aquesta prova, compta com a sortida."}[lang]);
  expect(await sheet.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
});
