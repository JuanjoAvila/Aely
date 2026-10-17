import {test,expect} from '@playwright/test';
import {seedLoggedInDashboard,dismissNews,FIXTURE_NOW,installFixtureClock} from './fixtures.mjs';

for(const own of [true,false])test('FIN11 Gastos después de poda: intención '+(own?'propia':'de otro titular'),async({page})=>{
 await installFixtureClock(page);
 const day=new Date(FIXTURE_NOW-2*86400000).toISOString().slice(0,10),merchant='Compra pendiente sintetica';
 const id='00000000-0000-4000-8000-000000000002',keepId='00000000-0000-4000-8000-000000000001';
 const row={id,source:'ob',ent:'caixabank',extId:'synthetic-book',obOrd:2,obAcc:'synthetic-account-a',date:day+'T12:00:00.001Z',amount:3.20,category:'otros',merchant,obName:merchant};
 const prefix='ob-absorbed2|caixabank|synthetic-book|';
 const pending={owner:own?'e2e-user':'another-owner',id,keepId,key:prefix+'2|synthetic-account-a|'+day,keepKey:prefix+'1|synthetic-account-a|'+day,amount:3.20,merchant};
 await seedLoggedInDashboard(page,{__seedOnce:true,__cloudErrors:{expenses:'synthetic-offline'},_historyOwner:'e2e-user',accounts:[{id:'cx',ent:'caixabank',role:'diario',spendFrom:true,value:1000}],settings:{autoPrices:false,theme:'green',expenseBanks:['caixabank']},expenses:[row],deleted:Array.from({length:500},(_,i)=>'synthetic-other-'+i),obAbsorbedPending:[pending],budget:1000});
 await page.goto('/');await dismissNews(page);
 await expect(page.locator('.botnav')).toBeVisible();await page.locator('.botnav-tab[data-tour="gastos"]').click();
 const rows=page.locator('.v4-gastos-list-body button.v4-mov');
 await expect(rows.filter({hasText:merchant})).toHaveCount(own?0:1);
 await expect(rows).toHaveCount(own?0:1);
});

for(const reverse of [false,true])test('FIN11/FIN15 pull cruza día: pendiente oculta antes de unir referencia '+reverse,async({page})=>{
 await installFixtureClock(page);
 const day=n=>new Date(FIXTURE_NOW-n*86400000).toISOString().slice(0,10),merchant='Superviviente sintetica FIN11';
 const id='00000000-0000-4000-8000-000000000002',keepId='00000000-0000-4000-8000-000000000001';
 const wire={id,user_id:'e2e-user',fecha:day(2)+'T12:00:00.001Z',importe:3.2,comercio:merchant,cat:'otros',source:'ob:caixabank#refshared-ref#accaccount-a#n2'};
 const survivor={...wire,id:keepId,fecha:day(1)+'T12:00:00.001Z'};
 const prefix='ob-absorbed2|caixabank|shared-ref|2|';
 const intent={owner:'e2e-user',id,keepId,key:prefix+'|'+day(2),keepKey:prefix+'account-a|'+day(1),amount:3.2,merchant};
 await seedLoggedInDashboard(page,{__seedOnce:true,_historyOwner:'e2e-user',accounts:[{id:'cx',ent:'caixabank',role:'diario',spendFrom:true,value:1000}],expenses:[],fixed:[],debts:[],oneoffs:[],goals:[],budget:1000,settings:{autoPrices:false,theme:'green',expenseBanks:['caixabank']},deleted:Array.from({length:500},(_,i)=>'synthetic-other-'+i),obAbsorbedPending:[intent],__cloudRows:{expenses:reverse?[survivor,wire]:[wire,survivor]}});
 await page.goto('/');await dismissNews(page);await expect(page.locator('.botnav')).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('micartera_v3_exp')||'[]').map(x=>x.id))).toEqual([keepId]);
 await page.locator('.botnav-tab[data-tour="gastos"]').click();
 const rows=page.locator('.v4-gastos-list-body button.v4-mov').filter({hasText:merchant});
 await expect(rows).toHaveCount(1);await expect(rows).toContainText('3,20');
 await page.reload();await dismissNews(page);await page.locator('.botnav-tab[data-tour="gastos"]').click();await expect(rows).toHaveCount(1);
});
