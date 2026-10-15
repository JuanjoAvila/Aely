import { test, expect, devices } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, estadoHeredado } from "./fixtures.mjs";

test.use({ viewport:{width:412,height:915},timezoneId:"Europe/Madrid",serviceWorkers:"block" });
test.describe.configure({retries:0});
const today="2026-10-14";
const currentAmount=mode=>mode==="con-efectivo"||mode.startsWith("confirmada-")?"18.622,44":mode.startsWith("transfer-")?"18.302,40":"18.502,44";
async function abrir(page,mode,prior=false,lang="es"){
  const state=estadoHeredado(today),confirmed=mode.startsWith("confirmada-");
  // El lector de cierres usa ob.key, como la API real. Dos ob:undefined alternaban
  // sus saldos sin parar y no dejaban terminar la transición a Gastos.
  state.obAccounts=state.obAccounts.map(o=>({...o,key:o.id}));
  if(mode!=="con-efectivo"&&!confirmed){
    state.accounts=state.accounts.filter(a=>a.ent!=="efectivo");
    delete state.accountBalanceHistory["acc:cash"];
  }
  if(confirmed) delete state.accountBalanceHistory["acc:cash"];
  const transfer=mode.startsWith("transfer-");
  state.expenses.push({id:"own-out",date:"2026-10-01T12:00:00Z",amount:transfer?300.07:100.03,merchant:confirmed?(mode==="confirmada-tarjeta"?"DISPOSICION TARJETA":"RETIRADA EFECTIVO"):transfer?"Pago sintético":"RETIRADA CAJERO",category:transfer||mode==="traspaso-cajero"||confirmed?"traspaso":"otros",ent:"sabadell",source:confirmed?"ob":"manual",withdrawalConfirmedAt:confirmed?Date.parse("2026-10-02T12:00:00Z"):undefined});
  if(mode==="transfer-pair")state.expenses.push({id:"own-in",date:"2026-10-04T23:59:00+02:00",amount:-300.07,merchant:"Entrada sintética",category:"otros",ent:"caixabank"});
  if(prior) await page.route(/http:\/\/127\.0\.0\.1:\d+\/$/,async route=>{
    const response=await route.fetch(),html=await response.text();
    const old=confirmed?html.replace('(e.withdrawalConfirmedAt||isAtmWithdrawal(e.merchant))','isAtmWithdrawal(e.merchant)'):transfer?html.replace('if(transit||e.category==="inversion"||(e.category==="traspaso"&&linked)) contribs.push','if(!transit&&!row.ownTransfer&&e.category==="traspaso"&&!linked) return;\n    if(transit||e.category==="inversion"||(e.category==="traspaso"&&linked)) contribs.push'):html.replace('if(!hasCash) daily[day]=(daily[day]||0)-row.cents;', 'if(false) daily[day]=(daily[day]||0)-row.cents;');
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
  await page.getByRole("button",{name:"Ver gastos ›",exact:true}).tap();
  await expect(page.locator('.botnav-tab[data-tour="gastos"]')).toHaveClass(/active/);
  await expect(page.locator(".v4-gastos-summary")).toBeVisible();
  result.gastos=await page.locator(".v4-gastos-summary").innerText();
  return result;
}
async function estadoNavegacion(page){
  return page.evaluate(()=>{
    return {tabs:[...document.querySelectorAll(".botnav-tab")].map(el=>({tab:el.dataset.tour,class:el.className})),settings:!!document.querySelector(".settings-push.open"),splash:!!document.getElementById("mc-load"),text:document.querySelector("#root")?.innerText,summary:document.querySelector(".v4-gastos-summary")?.innerText};
  }).catch(error=>({readError:String(error)}));
}
for(const mode of ["sin-efectivo","con-efectivo","traspaso-cajero","transfer-alone","transfer-pair","confirmada-tarjeta","confirmada-efectivo"]) test("reservas: gráfica y cifras actuales antes/después "+mode,{annotation:{type:"own-clock",description:"14/10/2026"}},async({browser},testInfo)=>{
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
  await expect(sheet.locator("p.hint")).toHaveText({"es":"Un traspaso resta sin entrada igual a otra cuenta propia en 3 días, enlace a bróker o aporte periódico coincidente. El cajero resta sin cuenta o bolsillo de efectivo.","en":"A transfer is an outflow without an equal inflow in another own account within three days, a broker link or a matching regular contribution. ATM withdrawals reduce net worth without a cash account or pocket.","ca":"Un traspàs resta sense entrada igual en un altre compte propi en tres dies, enllaç a bróker o aportació periòdica coincident. El caixer resta patrimoni sense compte o butxaca d'efectiu."}[lang]);
  expect(await sheet.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
});
