import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, installFixtureClock } from "./fixtures.mjs";

const old={ent:"caixabank",id:"old",date:"2026-09-24",amount:7,merchant:"Anterior",status:"BOOK"};
const row=(id)=>({ext_id:id,date:"2026-09-25",amount:12,merchant:"Compra nueva",status:"BOOK",card:true});
const phrases={
  es:{cut:"el banco o la conexión",limit:"la app ha alcanzado el límite",pending:"quedan movimientos antiguos"},
  en:{cut:"the bank or connection",limit:"the app reached the limit",pending:"older transactions still need"},
  ca:{cut:"el banc o la connexió",limit:"l'app ha arribat al límit",pending:"queden moviments antics"},
};
for(const lang of ["es","en","ca"])for(const [reason,type]of [["provider_error","cut"],["repeated_cursor","cut"],["page_limit","limit"],["time_limit","limit"],["pending","pending"],["complete100",null]]){
  test(lang+": aviso real de "+reason+" y extracto anterior",async({page})=>{
    await installFixtureClock(page);
    const partial=reason!=="pending"&&reason!=="complete100";
    const transactions=reason==="complete100"?Array.from({length:100},(_,i)=>row("tx"+i)):[row("new")];
    const link={aspsp:"CaixaBank",ok:true,gapPending:reason==="pending",accounts:[{uid:"cx",ok:true,count:transactions.length,transactions,balances:[{type:"ITAV",amount:100,currency:"EUR"}],...(partial?{truncated:true,readReason:reason}:{})}]};
    await seedLoggedInDashboard(page,{
      hasBankLink:true,bankTx:[old],accounts:[{id:"cx",ent:"caixabank",value:100,role:"diario"}],
      expenses:[],fixed:[],oneoffs:[],flows:[],debts:[],settings:{autoPrices:false,expenseBanks:["caixabank"]},
      __cloudRows:{bank_links:[{aspsp_name:"CaixaBank",status:"active"}]},
      __cloudFns:{"bank-sync":{data:{ok:true,links:[link]},error:null}},
    });
    await page.goto("/");
    await page.waitForFunction(()=>!document.getElementById("mc-load"));
    await dismissNews(page);
    await page.evaluate(async lang=>{await ensureLangPack(lang);CURLANG=lang;},lang);
    await page.locator('.botnav-tab[data-tour="cartera"]').click();
    const name=await page.evaluate(()=>t("v4_sync_banks"));
    await page.getByRole("button",{name,exact:true}).click();
    const report=page.locator(".sync-report");
    await expect(report).toBeVisible();
    if(type){
      await expect(report.locator(".sync-report-row",{hasText:phrases[lang][type]})).toHaveCount(1);
      for(const other of ["cut","limit","pending"])if(other!==type)await expect(report).not.toContainText(phrases[lang][other]);
    }else for(const text of Object.values(phrases[lang]))await expect(report).not.toContainText(text);
    if(partial)await expect.poll(()=>page.evaluate(()=>{
      const state=JSON.parse(localStorage.getItem("micartera_v3")||"{}");
      return (state.bankTx||[]).some(tx=>tx.id==="old"&&tx.amount===7);
    })).toBe(true);
    expect(await page.evaluate(()=>(window.__e2eInvokes||[]).filter(x=>x.name==="bank-sync").length)).toBe(1);
  });
}
