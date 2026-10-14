import { test, expect } from "@playwright/test";
import { scenario } from "../tests/helpers/bank-download-fixture.mjs";
import { seedLoggedInDashboard, dismissNews, installFixtureClock, FIXTURE_NOW } from "./fixtures.mjs";

const old={ent:"caixabank",id:"old",date:"2026-09-24",amount:7,merchant:"Anterior",status:"BOOK"};
const phrases={
  es:{cut:"el banco o la conexión",limit:"Usa Importar histórico",timeout:"el banco ha tardado demasiado",pending:"quedan movimientos antiguos"},
  en:{cut:"the bank or connection",limit:"Use Import history",timeout:"the bank took too long",pending:"older transactions still need"},
  ca:{cut:"el banc o la connexió",limit:"Fes servir Importar històric",timeout:"el banc ha trigat massa",pending:"queden moviments antics"},
};
for(const lang of ["es","en","ca"])for(const [reason,type]of [["provider_error","cut"],["repeated_cursor","cut"],["page_limit","limit"],["row_limit","limit"],["time_limit","timeout"],["sealed_prefix","cut"],["pending","pending"],["complete100",null]]){
  test(lang+": aviso real de "+reason+" y extracto anterior",async({page})=>{
    let externalBlocked=0;
    await page.route("**/*",route=>{const u=new URL(route.request().url());if(u.protocol==="http:"&&(u.hostname==="127.0.0.1"||u.hostname==="localhost"))return route.continue();externalBlocked++;return route.abort();});
    await installFixtureClock(page);
    const result=await scenario(reason,{now:FIXTURE_NOW}),link=result.data.links[0];
    const partial=!!link.readReason||link.accounts.some(a=>a.truncated||a.transactionError);
    // El SDK de la página recibe EXACTAMENTE el JSON que devuelve el handler actual.

    await seedLoggedInDashboard(page,{
      hasBankLink:true,bankTx:[old],accounts:[{id:"cx",ent:"caixabank",value:100,role:"diario"}],
      expenses:[{id:"old-ledger",extId:"old",source:"ob",ent:"caixabank",date:old.date,amount:7,merchant:"Anterior",category:"otros"}],fixed:[],oneoffs:[],flows:[],debts:[],settings:{autoPrices:false,lang,expenseBanks:["caixabank"]},
      __cloudRows:{bank_links:[{aspsp_name:"CaixaBank",status:"active"}]},
      __cloudFns:{"bank-sync":{data:result.data,error:null}},
    });
    await page.goto("/");
    await page.waitForFunction(()=>!document.getElementById("mc-load"));
    await dismissNews(page);
    await page.evaluate(async lang=>{await ensureLangPack(lang);},lang);
    await page.locator('.botnav-tab[data-tour="cartera"]').click();
    const name=await page.evaluate(()=>t("v4_sync_banks"));
    await page.getByRole("button",{name,exact:true}).click();
    const report=page.locator(".sync-report");
    await expect(report).toBeVisible();
    if(type){
      await expect(report.locator(".sync-report-row",{hasText:phrases[lang][type]})).toHaveCount(1);
      for(const other of ["cut","limit","timeout","pending"])if(other!==type)await expect(report).not.toContainText(phrases[lang][other]);
    }else for(const text of Object.values(phrases[lang]))await expect(report).not.toContainText(text);
    if(partial)await expect.poll(()=>page.evaluate(()=>{
      const state=JSON.parse(localStorage.getItem("micartera_v3")||"{}");
      return (state.bankTx||[]).some(tx=>tx.id==="old"&&tx.amount===7);
    })).toBe(true);
    if(reason==="sealed_prefix")await expect.poll(()=>page.evaluate(()=>{
      const rows=JSON.parse(localStorage.getItem("micartera_v3_exp")||"[]");
      return rows.filter(e=>e.source==="ob"&&!e.extId&&e.merchant==="Compra sintética 2").length;
    })).toBe(1);
    if(reason==="page_limit"||reason==="row_limit"){
      const expected=reason==="page_limit"?60:2000;
      await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("micartera_v3_exp")||"[]").filter(e=>e.source==="ob"&&e.extId!=="old").length)).toBe(expected);
      await expect(report.getByRole("button")).toHaveCount(1);
      await report.getByRole("button").click();
      await expect(report).not.toBeVisible();
      await page.getByRole("button",{name,exact:true}).click();
      await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("micartera_v3_exp")||"[]").filter(e=>e.source==="ob"&&e.extId!=="old").length)).toBe(expected);
    }
    if(reason==="pending"){
      const updated=await page.evaluate(()=>tf("bank_upd_one",{bank:"CaixaBank",x:eur(100)}).replace(/^✓\s*/,""));
      const updatedRow=report.locator(".sync-report-row",{hasText:updated});
      await expect(updatedRow).toHaveCount(1);
      await expect(updatedRow).toContainText("✓");
    }
    test.info().annotations.push({type:"external-requests-blocked",description:String(externalBlocked)});
    expect(await page.evaluate(()=>(window.__e2eInvokes||[]).filter(x=>x.name==="bank-sync").length)).toBe(reason==="page_limit"||reason==="row_limit"?2:1);
  });
}
