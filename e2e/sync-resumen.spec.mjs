import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

test("la sincronización mixta se explica por filas y nunca vuelve al toast gigante", async ({page}) => {
  const links=[{aspsp_name:"CaixaBank",status:"active",accounts:[{uid:"cx"}]}];
  await seedLoggedInDashboard(page,{
    hasBankLink:true,
    bankTx:[],
    settings:{autoPrices:false,theme:"green",expenseBanks:["caixabank"]},
    __cloudRows:{bank_links:links},
    __cloudFns:{"bank-sync":{data:{ok:true,links:[{
      aspsp:"CaixaBank",ok:false,expired:false,
      accounts:[{uid:"cx",ok:false,error:"eb_429",transactions:[]}]
    }]},error:null}}
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({timeout:15_000});
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="cartera"]').click();
  await page.getByRole("button",{name:/Sincronizar bancos/i}).click();

  const report=page.locator(".sync-report");
  await expect(report).toBeVisible({timeout:15_000});
  await expect(report).toContainText("CaixaBank");
  await expect(report).toContainText(/límite temporal|limit/i);
  await expect(report.locator(".sync-report-row")).toHaveCount(1);
  await expect(page.locator(".toast").filter({hasText:"CaixaBank"})).toHaveCount(0);
});

const brokerCases=[
  {id:"solo TR",tr:"ok",mi:"none",ok:["Trade Republic"]},
  {id:"solo MyInvestor",tr:"none",mi:"ok",ok:["MyInvestor"]},
  {id:"ambos",tr:"ok",mi:"ok",ok:["Trade Republic","MyInvestor"]},
  {id:"TR temporal y MyInvestor actualizado",tr:"soft",mi:"ok",ok:["MyInvestor"],soft:"Trade Republic"},
  {id:"TR caducado y MyInvestor actualizado",tr:"expired",mi:"ok",ok:["MyInvestor"],expired:"Trade Republic"},
  {id:"estado TR falla",tr:"status-error",mi:"ok",ok:["MyInvestor"],soft:"Trade Republic"},
  {id:"estado MyInvestor falla",tr:"ok",mi:"status-error",ok:["Trade Republic"],soft:"MyInvestor"},
];
const brokerWords={es:{button:/Sincronizar bancos/i,ok:"al día",soft:"no respondió",expired:"sesión caducada"},en:{button:/Sync banks/i,ok:"up to date",soft:"didn't answer",expired:"session expired"},ca:{button:/Sincronitza els bancs/i,ok:"al dia",soft:"no ha respost",expired:"sessió caducada"}};
for(const lang of ["es","en","ca"])for(const c of brokerCases){
  test("Actualizar brókers: "+c.id+" ("+lang+")",async({page})=>{
    const w=brokerWords[lang];
    await seedLoggedInDashboard(page,{hasBankLink:true,lastMiSync:Date.now(),settings:{autoPrices:false,theme:"green",lang},
      __cloudRows:{myinvestor_links:c.mi==="none"?[]:[{status:"active"}]},
      __cloudErrors:c.mi==="status-error"?{myinvestor_links:"fixture"}:{},
      __cloudFns:{"myinvestor-sync":{data:{ok:true,positions:[]},error:null}}});
    await page.addInitScript(function(tr){
      window.__brokerSyncCalls=0;
      if(tr==="none")return;
      window.MiCarteraTR={status:async function(){if(tr==="status-error")throw new Error("fixture");return {connected:true};},sync:async function(){window.__brokerSyncCalls++;return tr==="expired"?{authExpired:true}:tr==="soft"?{softFail:true}:{ok:true,positions:[]};}};
    },c.tr);
    await page.goto("/"); await dismissNews(page);
    await page.locator('.botnav-tab[data-tour="cartera"]').click();
    // El arranque consulta estado, pero el puente TR solo trae posiciones tras este botón.
    expect(await page.evaluate(()=>window.__brokerSyncCalls)).toBe(0);
    await page.getByRole("button",{name:w.button}).click();
    const report=page.locator(".sync-report"),rows=report.locator(".sync-report-row").filter({hasText:/Trade Republic|MyInvestor/});
    await expect(report).toBeVisible();
    await expect(rows).toHaveCount(c.ok.length+(c.soft||c.expired?1:0));
    for(const bank of c.ok)await expect(rows.filter({hasText:bank})).toContainText(w.ok);
    if(c.soft)await expect(rows.filter({hasText:c.soft})).toContainText(w.soft);
    if(c.expired)await expect(rows.filter({hasText:c.expired})).toContainText(w.expired);
    await expect(report).not.toContainText("TR/MyInvestor");
    await expect(page.locator(".toast").filter({hasText:/Trade Republic|MyInvestor/})).toHaveCount(0);
  });
}
