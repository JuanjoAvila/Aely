import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, estadoHeredado } from "./fixtures.mjs";

test.use({ viewport:{width:412,height:915},timezoneId:"Europe/Madrid",serviceWorkers:"block" });
test.describe.configure({retries:0});
const today="2026-10-14";
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
  await page.clock.install({time:new Date(today+"T12:00:00Z")});
  await seedLoggedInDashboard(page,{__seedOnce:true,...state,settings:{...state.settings,lang}});
  await page.goto("/");await page.waitForFunction(()=>!document.getElementById("mc-load"));await dismissNews(page);
  await expect(page.getByTestId("inicio-net-current").locator(".v42-net-line")).toHaveCount(1);
}
async function cifras(page){
  const hero=page.getByTestId("inicio-net-current");
  const result={now:await hero.locator(".v4-hero-amt").innerText(),card:await page.locator(".v42-cycle-amount>.serif").innerText(),delta:await hero.getByTestId("inicio-net-delta").innerText(),line:await hero.locator(".v42-net-line").getAttribute("d")};
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await expect(page.locator(".v4-gastos-summary")).toBeVisible();
  result.gastos=await page.locator(".v4-gastos-summary").innerText();
  return result;
}
for(const mode of ["sin-efectivo","con-efectivo","traspaso-cajero","transfer-alone","transfer-pair"]) test("reservas: gráfica y cifras actuales antes/después "+mode,{annotation:{type:"own-clock",description:"14/10/2026"}},async({browser},testInfo)=>{
  const read=async prior=>{
    const context=await browser.newContext({baseURL:testInfo.project.use.baseURL,viewport:{width:412,height:915},timezoneId:"Europe/Madrid",serviceWorkers:"block"});
    try{const page=await context.newPage();await abrir(page,mode,prior);return await cifras(page);}finally{await context.close();}
  };
    const old=await read(true),next=await read(false);
    expect({now:next.now,card:next.card,gastos:next.gastos}).toEqual({now:old.now,card:old.card,gastos:old.gastos});
    expect(next.now).toContain(mode==="con-efectivo"?"18.622,44":mode.startsWith("transfer-")?"18.302,40":"18.502,44");
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
