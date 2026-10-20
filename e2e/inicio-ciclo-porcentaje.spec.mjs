import {test,expect} from '@playwright/test';
import {seedLoggedInDashboard,dismissNews} from './fixtures.mjs';
import crypto from 'node:crypto';
test.use({timezoneId:'Europe/Madrid'});
const profiles=[{id:'one-cent',remaining:1},{id:'below-half-percent',remaining:49},{id:'half-percent',remaining:50},{id:'above-half-percent',remaining:51},{id:'exhausted',remaining:0},{id:'over-one-cent',remaining:-1}];
function profile(c,lang='es'){
 return {__seedOnce:true,budget:100,settings:{autoPrices:false,theme:'green',lang,gTotalMode:'net',budgetCycle:true,expenseBanks:['sabadell']},accounts:[{id:'g-daily',ent:'sabadell',name:'Cuenta sintetica',value:100,role:'diario',spendFrom:true}],fixed:[],flows:[],debts:[],oneoffs:[],reservaLog:[],expenses:[
 {id:'g-before',date:'2026-10-20T12:00:00Z',amount:(9999-c.remaining)/100,merchant:'Compra anterior sintetica',category:'super',ent:'sabadell'},
 {id:'g-payroll',date:'2026-10-26T12:00:00Z',amount:-2000,merchant:'Nomina sintetica',category:'ingreso',ent:'sabadell'},
 {id:'g-after',date:'2026-10-27T12:00:00Z',amount:0.01,merchant:'Compra reciente sintetica',category:'super',ent:'sabadell'}]};
}
function closingProfile(){const s=profile(profiles[0]);s.expenses=[{id:'g-old-payroll',date:'2026-09-30T12:00:00Z',amount:-2000,merchant:'Nomina sintetica',category:'ingreso',ent:'sabadell'},{id:'g-last-spend',date:'2026-10-30T12:00:00Z',amount:99.99,merchant:'Compra cierre sintetica',category:'super',ent:'sabadell'}];return s;}

const cents=x=>Math.round(x*100);
async function boot(page,s,time='2026-10-28T12:00:00Z'){
 const host=new URL(test.info().project.use.baseURL).hostname;
 await page.route('**/*',route=>new URL(route.request().url()).hostname===host?route.continue():route.abort());
 await page.clock.install({time:new Date(time)});await seedLoggedInDashboard(page,s);const response=await page.goto('/');await ready(page);
 await test.info().attach('html-sha256',{body:crypto.createHash('sha256').update(await response.body()).digest('hex'),contentType:'text/plain'});
}
async function ready(page){await expect(page.locator('.botnav')).toBeVisible();await page.waitForFunction(()=>!document.getElementById('mc-load'));await dismissNews(page);}
async function toggle(page){
 const prior=await page.evaluate(()=>mcLoadRaw('micartera_v3').settings.budgetCycle);
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('mc-open-settings')));
 const settings=page.locator('.settings-push.open');await expect(settings).toBeVisible();
 // Cambiar la preferencia por su botón real también comprueba su persistencia.
 await settings.locator('button.set-row').filter({hasText:/Dinero|Money|Diners/}).first().click();
 await settings.locator('button.set-row').filter({hasText:/Presupuesto por ciclo de cobro|Budget by pay cycle|Pressupost per cicle de cobrament/}).click();
 await settings.locator('.settings-push-h .back').click();
 await expect.poll(async()=>page.evaluate(()=>mcLoadRaw('micartera_v3').settings.budgetCycle)).toBe(!prior);
}
async function snap(page,label){const d=page.locator('.v4-budget');const data=await page.evaluate(()=>{const s=mcLoadRaw('micartera_v3');return {stats:dashboardBudgetStats(s),cycleSetting:s.settings.budgetCycle,expenses:s.expenses,card:closedMonthCardOf(s)};});data.ring=(await d.locator('.v4-ring .num').textContent()).trim();data.amount=await d.locator('.v42-cycle-amount>.serif').innerText();data.aria=await d.getAttribute('aria-label');data.stroke=await d.locator('circle[pathLength="100"]').last().getAttribute('stroke-dasharray');await test.info().attach(label,{body:JSON.stringify(data,null,2),contentType:'application/json'});return data;}
for(const c of profiles)test('G control toggle '+c.id,async({page})=>{
 await boot(page,profile(c));const a=await snap(page,'cycle');expect(cents(a.stats.remaining)).toBe(9999);expect(a.ring).toBe('100%');
 await toggle(page);const b=await snap(page,'month');expect(cents(b.stats.remaining)).toBe(c.remaining);expect(cents(b.stats.against)).toBe(10000-c.remaining);expect(b.ring).toBe(c.remaining>=50?'1%':c.remaining>0?'<1\u00a0%':'0%');
 const exact=c.remaining===0?'0 €':(c.remaining/100).toFixed(2).replace('.',',')+' €';expect(b.amount).toBe(exact);expect(b.expenses).toEqual(a.expenses);
 await page.locator('.botnav-tab[data-tour="gastos"]').click();await page.locator('.botnav-tab[data-tour="inicio"]').click();expect((await snap(page,'return-inicio')).amount).toBe(exact);
 await page.reload();await ready(page);const reload=await snap(page,'reload');expect(reload.amount).toBe(exact);expect(reload.ring).toBe(b.ring);expect(reload.cycleSetting).toBe(false);
 await toggle(page);const restored=await snap(page,'restored-cycle');expect(cents(restored.stats.remaining)).toBe(9999);expect(restored.expenses).toEqual(a.expenses);
});
test('G control civil month closure',async({page})=>{
 await boot(page,closingProfile(),'2026-10-31T22:59:50Z');const a=await snap(page,'before-midnight');expect(cents(a.stats.remaining)).toBe(1);expect(a.amount).toBe('0,01 €');
 await page.clock.setSystemTime(new Date('2026-10-31T23:00:10Z'));await page.reload();await ready(page);const b=await snap(page,'after-midnight-cycle');expect(cents(b.stats.remaining)).toBe(1);expect(b.card.ym).toBe('2026-10');expect(cents(b.card.stats.spent)).toBe(9999);
 await toggle(page);const m=await snap(page,'after-midnight-month');expect(cents(m.stats.remaining)).toBe(10000);expect(m.ring).toBe('100%');expect(m.expenses).toEqual(a.expenses);
 await toggle(page);const back=await snap(page,'cycle-restored-after-closure');expect(back.amount).toBe('0,01 €');expect(back.ring).toBe('<1\u00a0%');
});
for(const lang of ['es','en','ca'])test('G positive cent display '+lang,async({page})=>{
 await boot(page,profile(profiles[0],lang));await toggle(page);const b=await snap(page,'causal-rounded-zero');expect(cents(b.stats.remaining)).toBe(1);expect(b.amount).toBe('0,01 €');expect(parseFloat(b.stroke)).toBeGreaterThan(0);
 // Contrato aprobado: queda un céntimo, aunque el porcentaje redondeado sea cero.
 expect(b.ring).toBe(lang==='en'?'<1%':'<1\u00a0%');
});
