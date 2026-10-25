import {test,expect} from '@playwright/test';
import {seedLoggedInDashboard,dismissNews} from './fixtures.mjs';
const copy={es:{tab:'Deudas',advisor:'¿Cuándo amortizar?',end:'acabas en ',cut:(d,d0)=>'Te quitas 5 cuotas: acabarías en '+d+' en vez de '+d0+'.',months:['octubre','noviembre','mayo','junio']},en:{tab:'Debts',advisor:'When to pay down',end:'done by ',cut:(d,d0)=>"You'd drop 5 payments: done by "+d+' instead of '+d0+'.',months:['October','November','May','June']},ca:{tab:'Deutes',advisor:'Quan amortitzar',end:'acabes el ',cut:(d,d0)=>'Et treus 5 quotes: acabaries el '+d+' en comptes del '+d0+'.',months:['octubre','novembre','maig','juny']}};
const cases=[{zone:'America/Los_Angeles',at:'2026-10-31T23:30:00Z',localMonth:9,madridMonth:10},{zone:'Asia/Tokyo',at:'2026-10-31T16:30:00Z',localMonth:10,madridMonth:9}];
for(const row of cases)test.describe(row.zone,()=>{
 test.use({timezoneId:row.zone});
 for(const lang of ['es','en','ca'])for(const route of ['lista','asesor'])test(route+' '+lang,async({page},info)=>{
  await page.clock.install({time:new Date(row.at)});
  // El ancla sintética conserva 12 cuotas en ambas zonas sin cambiar el calendario financiero local.
  const debt={id:'madrid',name:'Deuda sintética Madrid',value:1300,original:1300,monthly:100,amort:100,months:13,asOf:2026*12+row.localMonth,day:1,apr:0,account:'sabadell'};
  await seedLoggedInDashboard(page,{__seedOnce:true,debts:[debt],expenses:[],fixed:[],flows:[],goals:[],settings:{lang,autoPrices:false,theme:'green',reservaRules:[]}});
  await page.goto('/');await page.waitForFunction(()=>!document.getElementById('mc-load'));await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();await page.getByRole('tab',{name:copy[lang].tab,exact:true}).click();
  expect(await page.evaluate(()=>new Date().getMonth())).toBe(row.localMonth);
  const before=await page.evaluate(()=>({debts:JSON.parse(localStorage.getItem('micartera_v3')).debts,expenses:localStorage.getItem('micartera_v3_exp')}));
  expect(await page.evaluate(d=>({left:debtLeft(d),balance:Math.round(debtBalance(d)*100)}),debt)).toEqual({left:12,balance:120000});
  // Esperado independiente y explícito: Madrid noviembre/octubre +12 y +7 meses, ambos en 2027.
  const end=copy[lang].months[row.madridMonth===10?1:0]+' 2027',short=copy[lang].months[row.madridMonth===10?3:2]+' 2027';
  if(route==='lista')await expect(page.locator('[data-debt-id="madrid"] .v4-debt-foot')).toContainText(copy[lang].end+end);
  else{
   await page.getByText(copy[lang].advisor,{exact:false}).first().click();
   await expect(page.getByText(copy[lang].cut(short,end),{exact:false})).toBeVisible();
  }
  expect(await page.evaluate(()=>({debts:JSON.parse(localStorage.getItem('micartera_v3')).debts,expenses:localStorage.getItem('micartera_v3_exp')}))).toEqual(before);
  await page.screenshot({path:info.outputPath('mes-madrid.png')});
 });
});
