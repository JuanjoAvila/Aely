import {test,expect} from '@playwright/test';
import {seedLoggedInDashboard,dismissNews} from './fixtures.mjs';

const investments=[
 {id:'tr-eur',ent:'trade_republic',name:'Fondo sintético EUR',value:1200.4,cost:960.32,cur:'EUR',shares:10},
 {id:'rv-usd',ent:'revolut',name:'Acción sintética USD',value:200,cost:160,cur:'USD',shares:2},
 {id:'mi-gbp',ent:'myinvestor',name:'Fondo sintético GBP',value:100.4,cost:80.32,cur:'GBP',shares:4},
 {id:'zero-eur',ent:'sabadell',name:'Posición cero real',value:0,cost:0,cur:'EUR'}
];
const accounts=[{id:'cash',ent:'trade_republic',name:'Efectivo sintético',value:500,cur:'EUR',role:'fijos'},{id:'cash2',ent:'sabadell',name:'Cuenta sintética',value:250,cur:'EUR',role:'fijos'}];
const aportaciones=[{id:'aport-synthetic',amount:150,ent:'trade_republic',day:5}];
const norm=s=>s.replace(/[\u00a0\u202f]/g,' ').trim();
const broker=(p,id)=>p.locator('.page [data-broker-key="'+id+'"]');
const child=p=>p.locator('[data-inv-screen]');
const text=async l=>norm(await l.innerText());
async function money(l,value){await expect.poll(()=>text(l)).toBe(value);}
async function stored(p){return p.evaluate(()=>{const s=JSON.parse(localStorage.getItem('micartera_v3'));return {accounts:s.accounts,investments:s.investments,aportaciones:s.aportaciones,fx:s.fx,fxRates:s.fxRates};});}
async function boot(p,currency='EUR',rates={USD:0.8,GBP:1.25},overrides={}){
 await p.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 await seedLoggedInDashboard(p,{__seedOnce:true,__seenVersion:'4.26.160',accounts,investments,aportaciones,fx:rates.USD??null,fxRates:rates,lastPriceSync:Date.now(),settings:{autoPrices:false,lang:'es',theme:'green',currency},...overrides});
 const response=await p.goto('/');if(process.env.FIN31_HTML_SHA256)expect(response.headers()['x-fin31-html-sha256']).toBe(process.env.FIN31_HTML_SHA256);
 await ready(p);await p.locator('.botnav-tab[data-tour="cartera"]').click();await expect(broker(p,'revolut')).toBeVisible();
 const s=await stored(p);expect(s.investments).toEqual(overrides.investments||investments);expect(s.aportaciones).toEqual(overrides.aportaciones||aportaciones);return s;
}
async function ready(p){await expect(p.locator('.botnav')).toBeVisible();await dismissNews(p);await p.waitForFunction(()=>!document.getElementById('mc-load')&&window.__mcBootReady);}
async function openChild(p){await p.getByRole('button',{name:/Ver todas tus inversiones/}).click();await expect(child(p)).toBeVisible();}
async function local(p,cur){await child(p).locator('.curtoggle').getByRole('button',{name:({EUR:'€',USD:'$',GBP:'£'})[cur],exact:true}).click();}
async function global(p,cur){
 await p.evaluate(()=>window.dispatchEvent(new CustomEvent('mc-open-settings')));const s=p.locator('.settings-push.open').filter({has:p.locator('button.set-row')});
 const card=s.locator('.set-card').filter({hasText:'Moneda de visualización'});if(!await card.locator(':scope > .collapsible.open').count())await card.locator(':scope > button').click();
 const row=s.locator('button.set-row').filter({hasText:'Moneda de visualización'}).first();if(!await row.locator('.sr-chev.open').count())await row.click();
 await s.getByRole('button',{name:({EUR:'€ Euro',USD:'$ Dólar',GBP:'£ Libra'})[cur],exact:true}).click();await s.locator('.settings-push-h button.back').click();await expect(s).toHaveCount(0);
}
async function capture(p,info,name){await info.attach(name+'.json',{body:JSON.stringify({stored:await stored(p),rows:await p.locator('[data-broker-key],.cartera-hero-amt,[data-inv-hero],[data-inv-projection]').allTextContents()},null,2),contentType:'application/json'});
 // El DOM llega antes que la transición de navegación; la captura debe esperar a la pantalla.
 await p.evaluate(async()=>{await Promise.all(document.getAnimations().filter(a=>a.effect?.getComputedTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));});
 await info.attach(name+'.png',{body:await p.screenshot({animations:'disabled'}),contentType:'image/png'});}

test('FIN31 missing FX: broker and totals unknown, original rows survive toggles and reload',async({page:p},info)=>{
 const before=await boot(p,'EUR',{});await capture(p,info,'missing-fx-base');
 await money(broker(p,'revolut').locator('.am'),'—');await expect(broker(p,'revolut')).toContainText('Sin conversión');
 await money(p.locator('.cartera-hero-amt'),'—');await expect(p.locator('.page [data-fx-incomplete]').first()).toBeVisible();
 await money(broker(p,'trade_republic').locator('.am'),'1200 €');await money(broker(p,'sabadell').locator('.am'),'0 €');
 await p.locator('.botnav-tab[data-tour="inicio"]').click();await money(p.locator('[data-testid="inicio-net-current"] [data-tour="hero-amt"]'),'—');await p.locator('.botnav-tab[data-tour="cartera"]').click();
 await openChild(p);await money(child(p).locator('[data-inv-hero] .serif'),'—');await money(child(p).locator('[data-broker-key="revolut"] .am'),'—');
 await child(p).locator('[data-broker-key="revolut"]').click();await expect(child(p).locator('[data-inv-position="rv-usd"]')).toContainText('200,00 USD · Sin conversión');
 await local(p,'USD');await money(child(p).locator('[data-inv-hero] .serif'),'—');await expect(child(p).locator('[data-fx-incomplete]')).toBeVisible();
 await child(p).locator('[data-inv-projection-card] > button').click();await expect(child(p).locator('[data-inv-projection]')).toContainText('—');await expect(child(p).locator('[data-inv-projection] svg')).toHaveCount(0);
 await local(p,'GBP');await money(child(p).locator('[data-inv-hero] .serif'),'—');await child(p).locator('[data-act="back"]').click();await money(p.locator('.cartera-hero-amt'),'—');
 await p.reload();await ready(p);await p.locator('.botnav-tab[data-tour="cartera"]').click();await money(p.locator('.cartera-hero-amt'),'—');expect(await stored(p)).toEqual(before);await capture(p,info,'missing-fx-final');
});

test('FIN31 GBP: selected local option and independent cents, local-global controls',async({page:p},info)=>{
 const before=await boot(p,'GBP');await openChild(p);await capture(p,info,'gbp-base');
 await money(child(p).locator('[data-inv-hero] .serif'),'1188,72 £');await expect(child(p).getByRole('button',{name:'£',exact:true})).toHaveAttribute('aria-pressed','true');
 await money(child(p).locator('[data-broker-key="revolut"] .am'),'128 £');await child(p).locator('[data-broker-key="myinvestor"]').click();await money(child(p).locator('[data-inv-position="mi-gbp"] .rval'),'100,40 £');
 await local(p,'EUR');await money(child(p).locator('[data-inv-hero] .serif'),'1485,90 €');await local(p,'USD');await money(child(p).locator('[data-inv-hero] .serif'),'1857,38 $');
 await child(p).locator('[data-act="back"]').click();await money(p.locator('.cartera-hero-amt'),'1788,72 £');
 await global(p,'EUR');await money(p.locator('.cartera-hero-amt'),'2235,90 €');await global(p,'GBP');await p.reload();await ready(p);await p.locator('.botnav-tab[data-tour="cartera"]').click();await openChild(p);await money(child(p).locator('[data-inv-hero] .serif'),'1188,72 £');expect(await stored(p)).toEqual(before);await capture(p,info,'gbp-final');
});

test('FIN31 projection: every amount and axis follows local EUR USD GBP with unchanged principal',async({page:p},info)=>{
 const before=await boot(p,'USD');await openChild(p);await child(p).locator('[data-inv-projection-card] > button').click();const proj=child(p).locator('[data-inv-projection]');await capture(p,info,'projection-base');
 // Independent oracle: 148590 EUR cents principal, 15000 cents/month, 2 years at 0%.
 await proj.locator('input[inputmode="decimal"]').fill('0');await proj.locator('input[inputmode="numeric"]').fill('2');
 for(const [cur,k,sym,monthly,future] of [['USD',1.25,'$','187,50 $','6357 $'],['EUR',1,'€','150,00 €','5086 €'],['GBP',0.8,'£','120,00 £','4069 £']]){
  await local(p,cur);await money(proj.locator('.num').nth(2),monthly);await money(proj.locator('.serif').first(),future);
  const r=.02/12,max=1485.9*(1+r)**24+150*((1+r)**24-1)/r;
  const ticks=Array.from({length:5},(_,i)=>{const v=max*(i+1)/5*k;return v>=1000?Math.round(v/1000)+'K '+sym:Math.round(v)+' '+sym;});
  await expect.poll(()=>proj.locator('svg g text').allTextContents()).toEqual(ticks);
 }
 expect(await stored(p)).toEqual(before);await capture(p,info,'projection-final');
});

test('FIN31 missing display GBP rate: no relabelled EUR, meaningful selected option',async({page:p})=>{
 // Missing GBP affects both an original position and the local display conversion.
 const before=await boot(p,'GBP',{USD:0.8});await openChild(p);await expect(child(p).getByRole('button',{name:'£',exact:true})).toHaveAttribute('aria-pressed','true');
 await money(child(p).locator('[data-broker-key="trade_republic"] .am'),'—');await expect(child(p).locator('[data-fx-incomplete]')).toBeVisible();await local(p,'EUR');await money(child(p).locator('[data-broker-key="trade_republic"] .am'),'1200 €');expect(await stored(p)).toEqual(before);
});

test('FIN31 boundary partial selection excludes unknown investment, mixed broker stays unknown',async({page:p},info)=>{
 const mixed=[...investments,{id:'rv-eur',ent:'revolut',name:'Control EUR mismo bróker',cur:'EUR',value:50.25,cost:40.2}];
 const before=await boot(p,'EUR',{}, {investments:mixed});await money(broker(p,'revolut').locator('.am'),'—');
 const inv=p.locator('.page .v4-legend-btn').filter({hasText:'Inversiones'});await inv.click();await money(p.locator('.cartera-hero-amt'),'750,00 €');await inv.click();await money(p.locator('.cartera-hero-amt'),'—');
 await openChild(p);await money(child(p).locator('[data-broker-key="revolut"] .am'),'—');await child(p).locator('[data-inv-hero]').screenshot({path:info.outputPath('unknown-hero.png'),animations:'disabled'});expect(await stored(p)).toEqual(before);
});

test('FIN31 boundary missing display rate alone preserves known EUR assets and suppresses projection',async({page:p},info)=>{
 const onlyKnown=investments.filter(i=>i.cur!=='GBP');const before=await boot(p,'GBP',{USD:0.8},{investments:onlyKnown});await openChild(p);
 await money(child(p).locator('[data-inv-hero] .serif'),'—');await expect(child(p).locator('[data-fx-incomplete]')).toBeVisible();await child(p).locator('[data-inv-projection-card] > button').click();
 const proj=child(p).locator('[data-inv-projection]');await expect(proj).toContainText('Sin tipo de cambio');await expect(proj.locator('svg')).toHaveCount(0);
 await local(p,'EUR');await money(child(p).locator('[data-inv-hero] .serif'),'1360,40 €');await expect(proj.locator('svg')).toHaveCount(1);await local(p,'GBP');await expect(proj.locator('svg')).toHaveCount(0);expect(await stored(p)).toEqual(before);await proj.screenshot({path:info.outputPath('display-rate-unknown.png'),animations:'disabled'});
});

test('FIN31 boundary zero contribution is zero, slider converts amounts without storing them',async({page:p},info)=>{
 const before=await boot(p,'GBP',undefined,{aportaciones:[]});await openChild(p);await child(p).locator('[data-inv-projection-card] > button').click();const proj=child(p).locator('[data-inv-projection]');
 await money(proj.locator('.num').nth(2),'0,00 £');const slider=proj.locator('input[type="range"]');await expect(slider).toHaveValue('0');await slider.fill('200');await money(proj.locator('.num').nth(2),'160,00 £');
 await local(p,'USD');await money(proj.locator('.num').nth(2),'250,00 $');await local(p,'EUR');await money(proj.locator('.num').nth(2),'200,00 €');await local(p,'GBP');
 expect(await stored(p)).toEqual(before);await proj.screenshot({path:info.outputPath('projection-gbp.png'),animations:'disabled'});await child(p).locator('[data-inv-hero]').screenshot({path:info.outputPath('gbp-selected-hero.png'),animations:'disabled'});
});
