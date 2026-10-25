import {test,expect} from '@playwright/test';
import {seedLoggedInDashboard,dismissNews,gastosRoot,gastosCifra} from './fixtures.mjs';

const cases=[
 ['otoño','2026-10-10T12:00:00Z','2026-09-30T22:00:00Z','2026-10-31T23:00:00Z'],
 ['año','2026-12-10T12:00:00Z','2026-11-30T23:00:00Z','2026-12-31T23:00:00Z'],
 ['primavera','2027-03-10T12:00:00Z','2027-02-28T23:00:00Z','2027-03-31T22:00:00Z'],
];
for(const v2 of [true,false])for(const tz of ['Europe/Madrid','America/Los_Angeles'])test.describe((v2?'v2 ':'legacy ')+tz,()=>{
 test.use({timezoneId:tz});
 for(const [label,now,from,to]of cases)test('Inicio Gastos y widget en SU mes '+label,async({page})=>{
  const start=Date.parse(from),end=Date.parse(to);
  await page.clock.install({time:new Date(now)});
  const expense=(id,ms,amount)=>({id,date:new Date(ms).toISOString(),amount,category:amount<0?'ingreso':'super',merchant:id,ent:'sabadell',source:'ob:sabadell'});
  await seedLoggedInDashboard(page,{__seedOnce:true,budget:100,flows:[],
   settings:{lang:'es',autoPrices:false,budgetCycle:false,gTotalMode:'split',expenseBanks:['sabadell'],widgetBank:'sabadell'},
   accounts:[{id:'daily',ent:'sabadell',name:'Diaria sintética',role:'diario',spendFrom:true,value:1000}],
   expenses:[expense('Inicio mensual',start,17.43),expense('Futuro mismo mes',end-1,8.11),expense('Ingreso mensual',start+1000,-4.29),expense('Ingreso futuro mismo mes',end-2,-1.06),expense('Siguiente mes',end,27.19),expense('Ingreso siguiente mes',end+1000,-13.07)],
   reservaLog:[{id:'current',date:new Date(start+2000).toISOString(),amount:3.17},{id:'next',date:new Date(end).toISOString(),amount:2.11}],
  });
  await page.addInitScript(v2=>{
   window.Capacitor={isNativePlatform:()=>false,Plugins:{MiCartera:new Proxy({
    widgetContract:async()=>v2?({v:2}):({}),updateWidget:async data=>{window.__monthlyWidget=data;},addListener:async()=>({remove(){}}),
   },{get:(t,k)=>t[k]||(()=>Promise.resolve({}))})}};
  },v2);
  await page.goto('/');await expect(page.locator('.botnav')).toBeVisible();
  await page.waitForFunction(()=>!document.getElementById('mc-load'));await dismissNews(page);
  // Comprobar el importe realmente pintado en Inicio antes de consultar el puente nativo.
  await expect.poll(async()=>(await page.locator('.v4-budget .v42-cycle-amount>.serif').innerText()).replace(/\D/g,'')).toBe('7129');
  await expect.poll(()=>page.evaluate(()=>Math.round(window.__monthlyWidget?.spent*100))).toBe(2554);
  const snapshot=await page.evaluate(()=>window.__monthlyWidget);
  expect(snapshot.contract).toBe(v2?2:undefined);if(v2)expect(snapshot.periodKind).toBe('mes');expect(snapshot.periodStart).toBe(start);
  expect(Math.round(snapshot.budget*100)).toBe(9683);expect(Math.round(snapshot.budgetLeft*100)).toBe(7129);
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await expect(gastosRoot(page)).toHaveAttribute('data-periodo','months');
  await expect.poll(async()=>(await gastosCifra(page).innerText()).replace(/\D/g,'')).toBe('2554');
  const ym=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit'}).format(end);
  await expect(gastosRoot(page).locator('.gx-dia[data-gx-ym="'+ym+'"] button.v4-mov').filter({hasText:/Siguiente mes/})).toHaveCount(1);
  await page.locator('.botnav-tab[data-tour="inicio"]').click();
  await expect.poll(async()=>(await page.locator('.v4-budget .v42-cycle-amount>.serif').innerText()).replace(/\D/g,'')).toBe('7129');
 });
});
