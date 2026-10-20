import {test,expect} from '@playwright/test';
import {seedLoggedInDashboard,dismissNews} from './fixtures.mjs';

const accounts=[
 {id:'tr-cash',ent:'trade_republic',name:'Efectivo TR sintético',value:500,cur:'EUR',role:'fijos'},
 {id:'sab-cash',ent:'sabadell',name:'Cuenta sintética',value:250,cur:'EUR',role:'fijos'}
];
const investments=[
 {id:'tr-eur',ent:'trade_republic',name:'Fondo TR sintético',value:1200.4,cost:960.32,cur:'EUR',shares:10},
 {id:'rv-usd',ent:'revolut',name:'Acción USD sintética',value:200,cost:160,cur:'USD',shares:2},
 {id:'mi-eur',ent:'myinvestor',name:'Fondo MyInvestor sintético',value:800,cost:640,cur:'EUR',shares:4}
];
const norm=s=>s.replace(/[\u00a0\u202f]/g,' ').trim();
// Oráculo independiente: 1 USD = 0,8 EUR; no llama al formateador ni al conversor del producto.
const expected={EUR:{tr:'1200 €',rv:'160 €',mi:'800 €',cash:'500,00 €',hero:'2910,40 €',position:'1200,40 €'},USD:{tr:'1501 $',rv:'200 $',mi:'1000 $',cash:'625,00 $',hero:'3638,00 $',position:'1500,50 $'}};
const broker=(page,id)=>page.locator('.page [data-broker-key="'+id+'"]');
async function stored(page){return page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('micartera_v3'));return {accounts:s.accounts,investments:s.investments,currency:s.settings.currency,fx:s.fx,fxRates:s.fxRates};});}
async function open(page,currency='EUR',fx=0.8){
 await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
 await seedLoggedInDashboard(page,{__seedOnce:true,__seenVersion:'4.26.158',accounts,investments,fx,fxRates:fx?{USD:fx}:{},lastPriceSync:Date.now(),settings:{autoPrices:false,lang:'es',theme:'green',currency}});
 const response=await page.goto('/');
 if(process.env.FIN22_HTML_SHA256)expect(response.headers()['x-fin22-html-sha256']).toBe(process.env.FIN22_HTML_SHA256);
 await expect(page.locator('.botnav')).toBeVisible();await dismissNews(page);
 await page.waitForFunction(()=>!document.getElementById('mc-load')&&window.__mcBootReady);
 await page.locator('.botnav-tab[data-tour="cartera"]').click();
 await expect(broker(page,'trade_republic')).toBeVisible();
}
async function setCurrency(page,currency){
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('mc-open-settings')));
 const settings=page.locator('.settings-push.open').filter({has:page.locator('button.set-row')});
 const currencyRow=settings.locator('button.set-row').filter({hasText:/Moneda de visualización/}).first();
 const money=settings.locator('.set-card').filter({hasText:'Moneda de visualización'});
 await expect(money).toHaveCount(1);
 // El acordeón conserva nodos montados dentro de una rejilla cerrada: isVisible no basta.
 if(!await money.locator(':scope > .collapsible.open').count())await money.locator(':scope > button').click();
 await expect(money.locator(':scope > .collapsible')).toHaveClass(/open/);
 const option=settings.getByRole('button',{name:currency==='USD'?'$ Dólar':'€ Euro',exact:true});
 if(!await currencyRow.locator('.sr-chev.open').count())await currencyRow.click();
 await option.click();
 await expect.poll(async()=>(await stored(page)).currency).toBe(currency);
 await settings.locator('.settings-push-h button.back').click();
 await expect(settings).toHaveCount(0);
}
async function snapshot(page,testInfo,label){
 const value={label,stored:await stored(page),rows:await page.locator('.page [data-broker-key],.page [data-account-id],.cartera-hero-amt').evaluateAll(xs=>xs.map(e=>({broker:e.dataset.brokerKey,account:e.dataset.accountId,text:e.innerText})))};
 await testInfo.attach(label+'.json',{body:JSON.stringify(value,null,2),contentType:'application/json'});
 // La captura de la fila espera geometría estable; la salida animada de Ajustes
 // podía taparla aunque el DOM ya tuviera el importe correcto.
 await broker(page,'trade_republic').evaluate(el=>el.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'}));
 await expect.poll(()=>broker(page,'trade_republic').evaluate(el=>{const r=el.getBoundingClientRect();return r.top>80&&r.bottom<innerHeight-100;})).toBe(true);
 await testInfo.attach(label+'-tr.png',{body:await broker(page,'trade_republic').screenshot({animations:'disabled'}),contentType:'image/png'});
 await testInfo.attach(label+'.png',{body:await page.screenshot({animations:'disabled'}),contentType:'image/png'});
 return value;
}
async function assertAmounts(page,currency){
 const e=expected[currency];
 for(const [id,key] of [['trade_republic','tr'],['revolut','rv'],['myinvestor','mi']])await expect.poll(async()=>norm(await broker(page,id).locator('.am').innerText())).toBe(e[key]);
 await expect.poll(async()=>norm(await page.locator('[data-account-id="tr-cash"] .am').innerText())).toBe(e.cash);
 await expect.poll(async()=>norm(await page.locator('.cartera-hero-amt').innerText())).toBe(e.hero);
}
function protectedRows(s){return {accounts:s.accounts.map(a=>Object.fromEntries(Object.keys(accounts.find(x=>x.id===a.id)).map(k=>[k,a[k]]))),investments:s.investments};}

test('FIN22 Cartera cambia EUR/USD/EUR/USD sin alterar dinero y persiste al recargar',async({page},testInfo)=>{
 await open(page);await assertAmounts(page,'EUR');
 const before=await stored(page);expect(protectedRows(before)).toEqual({accounts,investments});
 await setCurrency(page,'USD');await snapshot(page,testInfo,'usd-after-setting');
 await assertAmounts(page,'USD');
 await broker(page,'trade_republic').click();
 await expect.poll(async()=>norm(await page.locator('.page [data-inv-position="tr-eur"] .rval').innerText())).toContain(expected.USD.position);
 await setCurrency(page,'EUR');await assertAmounts(page,'EUR');
 await setCurrency(page,'USD');await assertAmounts(page,'USD');
 await page.reload();await expect(page.locator('.botnav')).toBeVisible();await dismissNews(page);
 await expect(page.locator('.wn-panel')).toHaveCount(0);
 await page.waitForFunction(()=>!document.getElementById('mc-load')&&window.__mcBootReady);
 await page.locator('.botnav-tab[data-tour="cartera"]').click();await assertAmounts(page,'USD');
 const after=await stored(page);expect(after.currency).toBe('USD');expect(protectedRows(after)).toEqual(protectedRows(before));expect(after.fxRates).toEqual(before.fxRates);
 await snapshot(page,testInfo,'usd-after-reload');
});

test('FIN22 USD inicial y selector local de Inversiones no cambian la moneda de Cartera',async({page},testInfo)=>{
 await open(page,'USD');await assertAmounts(page,'USD');
 await page.getByRole('button',{name:/Ver todas tus inversiones/}).click();
 const screen=page.locator('[data-inv-screen]');
 await expect(screen.locator('[data-inv-hero]')).toContainText('2700,50 $');
 await screen.getByRole('button',{name:'€',exact:true}).click();
 await expect(screen.locator('[data-inv-hero]')).toContainText('2160,40 €');
 await screen.locator('[data-act="back"]').click();await expect(screen).toHaveCount(0);await assertAmounts(page,'USD');
 expect((await stored(page)).currency).toBe('USD');await snapshot(page,testInfo,'local-selector-independent');
});

test('FIN22 sin FX conserva el fallback EUR y los originales desconocidos',async({page},testInfo)=>{
 await open(page,'USD',null);
 await expect(broker(page,'trade_republic').locator('.am')).toHaveText('1200 €');
 await expect(page.locator('[data-account-id="tr-cash"] .am')).toHaveText('500,00 €');
 await broker(page,'revolut').click();
 await expect(page.locator('.page [data-inv-position="rv-usd"]')).toContainText('200,00 USD · Sin conversión');
 const s=await stored(page);expect(protectedRows(s)).toEqual({accounts,investments});expect(s.currency).toBe('USD');
 await snapshot(page,testInfo,'missing-fx-fallback');
});
