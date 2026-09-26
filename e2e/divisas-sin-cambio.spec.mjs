import {test,expect} from "@playwright/test";
import {seedLoggedInDashboard,dismissNews} from "./fixtures.mjs";

const positions=[{id:"eur",ent:"trade_republic",name:"Fondo EUR",value:100,cost:80,cur:"EUR"},
  {id:"foreign",ent:"revolut",name:"Fondo original",value:500,cost:400,cur:"XYZ",ticker:"TEST"}];
async function start(page,overrides={}){
  await page.route("**/api.frankfurter.dev/**",r=>r.abort());
  await seedLoggedInDashboard(page,Object.assign({fx:null,fxRates:{},investments:positions,
    obAccounts:[{key:"unknown",ent:"revolut",name:"Cuenta original",value:700,cur:"XYZ"}],
    settings:{autoPrices:false,lang:"es",theme:"green"}},overrides));
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible();
  await dismissNews(page);
  await page.waitForFunction(()=>!document.getElementById("mc-load"));
}
async function portfolio(page){ await page.locator('.botnav-tab[data-tour="cartera"]').click(); }
async function investments(page){
  await portfolio(page);
  await page.getByRole("button",{name:/Ver todas tus inversiones|See all your investments|Veure totes les inversions/}).click();
  return page.locator("[data-inv-screen]");
}
for(const [lang,notice,unconverted] of [["es","Total incompleto","Sin conversión"],["en","Incomplete total","Not converted"],["ca","Total incomplet","Sense conversió"]]){
  test(`FIN-06 ${lang}: original visible, totales parciales y sin ganancia falsa`,async({page})=>{
    await start(page,{settings:{autoPrices:false,lang,theme:"green",currency:"EUR"}});
    await portfolio(page);
    await expect(page.locator(".cartera-hero-amt")).toContainText(/1[.,]?100/);
    await expect(page.locator('[data-fx-incomplete]').first()).toContainText(notice);
    const account=page.locator('[data-ob-key="unknown"]');
    await expect(account).toContainText(`700,00 XYZ · ${unconverted}`);
    const nameBox=await account.locator(".nm").boundingBox(),amountBox=await account.locator(".am").boundingBox();
    expect(nameBox.x+nameBox.width).toBeLessThanOrEqual(amountBox.x+1);
    await account.click();
    await expect(page.locator(".v4-account-amount")).toContainText(`700,00 XYZ · ${unconverted}`);
    expect(await page.locator(".v4-account-amount").evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
    const roles=page.locator(".v4-ficha-op");
    await expect(roles).toHaveCount(3);
    for(const role of await roles.all()) await expect(role).toBeDisabled();
    await page.locator(".v4-sheet-back").click({position:{x:8,y:8}});
    await expect(page.locator(".v4-account-amount")).toHaveCount(0);
    const screen=await investments(page);
    await expect(screen.locator("[data-inv-hero]")).toContainText(/100[.,]00/);
    await expect(screen.locator("[data-inv-hero] [data-fx-incomplete]")).toContainText(notice);
    await expect(screen.locator("[data-inv-hero]")).not.toContainText(/Han ganado|They gained|Han guanyat/);
    await expect(screen.locator("[data-inv-hero] [data-act=inv-edit]")).toHaveCount(0);
    const broker=screen.locator('[data-inv-broker="revolut"]');await broker.locator("button").first().click();
    const row=screen.locator('[data-inv-position="foreign"]');
    await expect(row).toContainText(`500,00 XYZ · ${unconverted}`);
    await expect(row.locator(".rvsub")).toHaveCount(0);
    await expect.poll(()=>page.evaluate(()=>{
      const s=JSON.parse(localStorage.getItem("micartera_v3"));
      return {raw:s.investments.find(i=>i.id==="foreign").value,hist:s.invHistory||[],obHist:(s.accountBalanceHistory||{})["ob:unknown"]||[]};
    })).toEqual({raw:500,hist:[],obHist:[]});
  });
}
test("FIN-06: tipo TRY conocido funciona offline y redondea en céntimos",async({page})=>{
  await start(page,{fxRates:{TRY:0.018261},investments:[{id:"try",ent:"revolut",name:"Fondo liras",value:1520,cost:1000,cur:"TRY"}],obAccounts:[]});
  const screen=await investments(page);
  await expect(screen.locator("[data-inv-hero]")).toContainText("27,76");
  await expect(screen.locator("[data-fx-incomplete]")).toHaveCount(0);
  await page.context().setOffline(true);
  await screen.locator('[data-inv-broker="revolut"] button').first().click();
  await expect(screen.locator('[data-inv-position="try"]')).toContainText("27,76");
});
test("FIN-06: Apuntar conserva 500 TRY y no inventa 500 euros sin cambio",async({page})=>{
  await start(page,{investments:[],obAccounts:[],settings:{autoPrices:false,lang:"es",apuntarCur:"TRY"}});
  await page.locator(".botnav-fab").click();const sheet=page.locator(".v4-exp-sheet");
  for(const digit of ["5","0","0"]) await sheet.locator(".v4-keys button").filter({hasText:new RegExp("^"+digit+"$")}).click();
  await expect(sheet.locator(".v4-ficha-amount")).toContainText("500");
  await expect(sheet).toContainText("Sin tipo de cambio");
  await expect(sheet).not.toContainText(/= 500.*€/);
  await sheet.locator(".v4-cta").click();await expect(sheet).toBeVisible();
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem("micartera_v3_exp")||"[]"));expect(stored).toEqual([]);
});
test("FIN-06: editar coste sin tipo no ancla euros falsos",async({page})=>{
  await start(page,{obAccounts:[]});const screen=await investments(page);
  const broker=screen.locator('[data-inv-broker="revolut"]');await broker.locator("button").first().click();
  await broker.locator('[data-act="inv-edit"]').click();
  const inputs=broker.locator('[data-inv-position="foreign"] input');await inputs.nth(1).fill("450");
  await broker.getByRole("button",{name:/Guardar|Save|Desar/}).click();
  await expect.poll(()=>page.evaluate(()=>{const i=JSON.parse(localStorage.getItem("micartera_v3")).investments.find(i=>i.id==="foreign");return {cost:i.cost,costEur:i.costEur??null};})).toEqual({cost:450,costEur:null});
});

test("FIN-06: refresco completo conserva caché y activa TRY sin reescribir el original",async({page})=>{
  let requested="";
  await page.route("**/api.frankfurter.dev/**",async route=>{requested=route.request().url();await route.fulfill({json:{date:"2026-09-25",rates:{USD:1.08,TRY:54.761,IDR:18000,ZAR:20,CZK:25}}});});
  await seedLoggedInDashboard(page,{fx:null,fxRates:{CHF:1.05},investments:[],obAccounts:[{key:"try",ent:"revolut",name:"Liras",value:1520,cur:"TRY"}],settings:{autoPrices:false,lang:"es"}});
  await page.goto("/");await expect(page.locator(".botnav")).toBeVisible();await dismissNews(page);await portfolio(page);
  await expect(page.locator('[data-ob-key="try"]')).toContainText("27,76");
  await expect(page.locator('[data-fx-incomplete]')).toHaveCount(0);
  expect(requested).toContain("/v1/latest?from=EUR");expect(requested).not.toContain("&to=");
  await expect.poll(()=>page.evaluate(()=>{const s=JSON.parse(localStorage.getItem("micartera_v3"));return {original:s.obAccounts[0].value,chf:s.fxRates.CHF,idr:s.fxRates.IDR,czk:s.fxRates.CZK};})).toEqual({original:1520,chf:1.05,idr:0.000055555556,czk:0.04});
});
test("FIN-06: USD de respaldo offline se convierte, sin tipo no lleva símbolo dólar al total",async({page})=>{
  await start(page,{fx:0.92,investments:[{id:"usd",ent:"revolut",name:"Dólares",value:100,cost:80,cur:"USD"}],obAccounts:[]});
  const screen=await investments(page);await expect(screen.locator("[data-inv-hero]")).toContainText("92,00");
  await screen.getByRole("button",{name:"$",exact:true}).click();await expect(screen.locator("[data-inv-hero]")).toContainText("100,00 $");
});


test("FIN-06: conversor de IDR conserva unidades pequeñas sin redondear EUR intermedios",async({page})=>{
  await start(page,{investments:[],obAccounts:[],fxRates:{IDR:0.000055555556,JPY:0.006}});
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent("mc-open-settings")));
  const settings=page.locator(".settings-push.open");
  await settings.locator("button.set-row").filter({hasText:/Dinero/}).first().click();
  await settings.locator("button.set-row").filter({hasText:/Conversor/}).first().click();
  await page.getByRole("button",{name:"IDR IDR",exact:true}).first().click();
  await page.getByRole("button",{name:"IDR IDR",exact:true}).last().click();
  await expect(page.locator("span.num").filter({hasText:/^1,00$/})).toBeVisible();
  await page.getByRole("button",{name:"¥ JPY",exact:true}).last().click();
  await expect(page.locator("span.num").filter({hasText:/^0,01$/})).toBeVisible();
});
