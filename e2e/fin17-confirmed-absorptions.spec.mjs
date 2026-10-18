import {test,expect} from '@playwright/test';
import {seedLoggedInDashboard,dismissNews,FIXTURE_NOW,installFixtureClock} from './fixtures.mjs';
const uuid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const day=new Date(FIXTURE_NOW-2*86400000).toISOString().slice(0,10),merchant='Compra sintetica FIN17';
const b={id:uuid(2),source:'ob',ent:'caixabank',extId:'synthetic-book',obOrd:2,obAcc:'account-a',date:day+'T12:00:00.001Z',amount:3.2,category:'otros',merchant,obName:merchant};
const kept={...b,id:uuid(1),obOrd:1,date:day+'T12:00:00.000Z'};
const key=n=>'ob-absorbed2|caixabank|synthetic-book|'+n+'|account-a|'+day;
const entry={owner:'e2e-user',id:b.id,key:key(2),keepId:kept.id,keepKey:key(1),ackAt:FIXTURE_NOW};
const base={__seedOnce:true,__cloudErrors:{expenses:'synthetic-offline'},_historyOwner:'e2e-user',accounts:[{id:'cx',ent:'caixabank',role:'diario',spendFrom:true,value:1000}],fixed:[],debts:[],oneoffs:[],goals:[],budget:1000,deleted:Array.from({length:500},(_,i)=>'synthetic-pruned-'+i)};
for(const own of [true,false])test('FIN17 registro confirmado tras poda/reapertura: dueño propio='+own,async({page})=>{
 await installFixtureClock(page);await seedLoggedInDashboard(page,{...base,settings:{lang:'es',autoPrices:false,expenseBanks:['caixabank']},expenses:[kept,b],obAbsorbedConfirmed:[{...entry,owner:own?'e2e-user':'another-owner'}]});
 await page.goto('/');await dismissNews(page);await expect(page.locator('.botnav')).toBeVisible();await page.locator('.botnav-tab[data-tour="gastos"]').click();
 const rows=page.locator('.v4-gastos-list-body button.v4-mov').filter({hasText:merchant});await expect(rows).toHaveCount(own?1:2);
 await page.reload();await dismissNews(page);await page.locator('.botnav-tab[data-tour="gastos"]').click();await expect(rows).toHaveCount(own?1:2);
});
for(const [lang,message,kind] of [['es','Hay movimientos pendientes de revisar','owner'],['en','Some transactions need review','owner'],['ca','Hi ha moviments pendents de revisar','owner'],['es','Hay movimientos pendientes de revisar','full']])test('FIN17 H2 '+kind+' conserva640 y avisa en '+lang,async({page})=>{
 await installFixtureClock(page);await seedLoggedInDashboard(page,{...base,settings:{lang,autoPrices:false,expenseBanks:['caixabank']},expenses:[]});
 await page.goto('/');await dismissNews(page);await expect(page.locator('.botnav')).toBeVisible();
 const amount=await page.evaluate(({b,kept,entry,kind})=>{
  const pending={...kept,extId:'synthetic-pending',obPending:true,obPendingRef:undefined};
  const survivor={...kept,obPendingRef:pending.extId};
  const prev={accounts:[{ent:'caixabank',role:'diario',spendFrom:true}],settings:{expenseBanks:['caixabank']},expenses:[pending,b],bankTx:[],deleted:[],fixed:[],debts:[],oneoffs:[],flows:[],budget:1000};
  if(kind==='full'){prev._historyOwner='e2e-user';prev.obAbsorbedPending=Array.from({length:200},(_,i)=>({...entry,amount:3.2,merchant:b.merchant,id:'00000000-0000-4000-8000-'+String(i+100).padStart(12,'0'),key:entry.key.replace('synthetic-book','old-'+i)}));}
  const next=obPendingAbsorbedState({...prev,expenses:[survivor]},prev);return Math.round(dashboardBudgetStats(next).spent*100);
 },{b,kept,entry,kind});
 expect(amount).toBe(640);await expect(page.getByText('⚠ '+message,{exact:true})).toBeVisible();
});

test('FIN17 F2 aviso no reaparece tras reabrir y vuelve en una incidencia nueva',async({page})=>{
 await installFixtureClock(page);await seedLoggedInDashboard(page,{...base,settings:{lang:'es',autoPrices:false,expenseBanks:['caixabank']},expenses:[]});
 await page.goto('/');await dismissNews(page);await expect(page.locator('.botnav')).toBeVisible();
 const notice=page.getByText('⚠ Hay movimientos pendientes de revisar',{exact:true});
 await page.evaluate(()=>obAbsorbedWarn('full','e2e-user'));await expect(notice).toBeVisible();
 await page.reload();await dismissNews(page);await expect(page.locator('.botnav')).toBeVisible();
 await page.evaluate(()=>obAbsorbedWarn('full','e2e-user'));await expect(notice).toHaveCount(0);
 await page.evaluate(()=>{obAbsorbedClearNotice('e2e-user');obAbsorbedWarn('full','e2e-user');});await expect(notice).toBeVisible();
});

test('FIN17 F5 SIGNED_OUT borra particiones incluso tras guardar el estado',async({page})=>{
 await installFixtureClock(page);await seedLoggedInDashboard(page,{...base,__authEvent:'SIGNED_OUT',__authEventDelayMs:3000,settings:{lang:'es',autoPrices:false,expenseBanks:['caixabank']},expenses:[kept,b],obAbsorbedConfirmed:[entry]});
 await page.goto('/');await expect(page.locator('.botnav')).toBeVisible();
 await page.evaluate(({entry,b})=>{
  obAbsorbedPersist('e2e-user',[{...entry,amount:b.amount,merchant:b.merchant}]);
  localStorage.setItem(obConfirmedStorageKey('other-owner'),'other-confirmed');localStorage.setItem(obAbsorbedStorageKey('other-owner'),'other-pending');
 },{entry,b});
 await expect.poll(()=>page.evaluate(()=>localStorage.getItem(obConfirmedStorageKey('e2e-user')))).toBeNull();
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem(mcStateKey())||'{}').obAbsorbedPending?.length)).toBe(0);
 const keys=await page.evaluate(()=>({confirmed:localStorage.getItem(obConfirmedStorageKey('e2e-user')),pending:localStorage.getItem(obAbsorbedStorageKey('e2e-user')),otherConfirmed:localStorage.getItem(obConfirmedStorageKey('other-owner')),otherPending:localStorage.getItem(obAbsorbedStorageKey('other-owner'))}));
 expect(keys).toEqual({confirmed:null,pending:null,otherConfirmed:'other-confirmed',otherPending:'other-pending'});
});
