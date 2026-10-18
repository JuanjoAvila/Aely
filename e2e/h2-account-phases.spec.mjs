import {test,expect} from '@playwright/test';
import {seedLoggedInDashboard,dismissNews,installFixtureClock} from './fixtures.mjs';
const previous='2026-09-20T01:00:00.000Z',fresh='2026-09-26T11:59:00.000Z';
for(const [lang,warning,stale] of [['es','no se ha podido actualizar algún saldo','sin actualizar'],['en','some balances could not be updated','not updated'],['ca','no s’ha pogut actualitzar algun saldo','sense actualitzar']]){
 test(lang+' H2 retains failed-account amount and shows partial balance warning',async({page})=>{
  await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  await installFixtureClock(page);
  await seedLoggedInDashboard(page,{lang,hasBankLink:true,accounts:[],expenses:[],fixed:[],debts:[],oneoffs:[],flows:[],investments:[],bankTx:[],
   settings:{autoPrices:false,lang,theme:'green',expenseBanks:['caixabank']},
   obAccounts:[{key:'a',ent:'caixabank',aspsp:'CaixaBank',name:'Cuenta A',value:125,cur:'EUR',balanceAt:previous},{key:'b',ent:'caixabank',aspsp:'CaixaBank',name:'Cuenta B',value:80,cur:'EUR',balanceAt:previous}],
   __cloudRows:{bank_links:[{aspsp_name:'CaixaBank',status:'active'}]},
   __cloudFns:{'bank-sync':{error:null,data:{ok:true,links:[{aspsp:'CaixaBank',ok:true,accountPhases:1,accounts:[{uid:'a',ok:true,balanceOk:false,balanceError:'eb_503',balances:[],transactions:[]},{uid:'b',ok:true,balanceOk:true,balanceAt:fresh,balances:[{type:'ITAV',amount:100,currency:'EUR'}],transactions:[]}]}]}}}
  });
  await page.goto('/');await expect(page.locator('.botnav')).toBeVisible();await page.waitForFunction(()=>!document.getElementById('mc-load'));await dismissNews(page);
  await page.evaluate(async lang=>{await ensureLangPack(lang);},lang);
  await page.locator('.botnav-tab[data-tour="cartera"]').click();
  const syncName=await page.evaluate(()=>t('v4_sync_banks'));
  await page.getByRole('button',{name:syncName,exact:true}).click();
  await expect(page.locator('.sync-report')).toContainText(warning);
  await expect.poll(()=>page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('micartera_v3')||'{}');return (s.obAccounts||[]).reduce((n,a)=>n+Math.round(a.value*100),0);})).toBe(22500);
  await expect(page.locator('[data-ob-key="a"]')).toContainText(stale);
  await expect(page.locator('[data-ob-key="a"]')).toContainText('125');
  await expect(page.locator('[data-ob-key="b"]')).toContainText('100');
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('micartera_v3')).obAccounts);
  expect(saved.find(a=>a.key==='a').balanceAt).toBe(previous);expect(saved.find(a=>a.key==='b').balanceAt).toBe(fresh);
  expect(await page.evaluate(()=>(window.__e2eInvokes||[]).find(x=>x.name==='bank-sync').body.accountPhases)).toBe(1);
 });
}
test('UID promoted account sheet uses its own balance date and stale flag',async({page})=>{
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 await installFixtureClock(page);
 await seedLoggedInDashboard(page,{hasBankLink:true,accounts:[
  {id:'a',ent:'caixabank',name:'Principal A',bankUid:'a',role:'fijos',value:125,balanceAt:previous,balanceStale:true,lastSync:fresh},
  {id:'b',ent:'caixabank',name:'Principal B',bankUid:'b',role:'fijos',value:100,balanceAt:fresh,balanceStale:false,lastSync:previous}],
  obAccounts:[],expenses:[],fixed:[],debts:[],oneoffs:[],flows:[],investments:[],settings:{autoPrices:false,lang:'es',theme:'green'}});
 await page.goto('/');await expect(page.locator('.botnav')).toBeVisible();await page.waitForFunction(()=>!document.getElementById('mc-load'));await dismissNews(page);
 await page.locator('.botnav-tab[data-tour="cartera"]').click();
 await page.locator('.v4-card-list button.v4-mov').filter({hasText:'Principal A'}).first().click();
 await expect(page.locator('.v4-account-stale')).toBeVisible();
 const expected=await page.evaluate(d=>new Date(d).toLocaleString(),previous);
 await expect(page.locator('.v4-account-lock')).toContainText(expected);
 await page.locator('.v4-sheet-back').click({position:{x:2,y:2}});
 await page.locator('.v4-card-list button.v4-mov').filter({hasText:'Principal B'}).first().click();
 await expect(page.locator('.v4-account-stale')).toHaveCount(0);
 const freshExpected=await page.evaluate(d=>new Date(d).toLocaleString(),fresh);
 await expect(page.locator('.v4-account-lock')).toContainText(freshExpected);
});
