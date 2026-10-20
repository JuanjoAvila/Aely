import {test,expect} from '@playwright/test';
import {seedLoggedInDashboard,dismissNews,installFixtureClock} from './fixtures.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';

test.use({serviceWorkers:'block',timezoneId:'Europe/Madrid'});
test.beforeAll(async({request})=>{
 const response=await request.get('/');expect(response.ok()).toBe(true);
 const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
 expect(hash(await response.body())).toBe(hash(fs.readFileSync(new URL('../public/index.html',import.meta.url))));
});
for(const reverse of [false,true])test('Night D pull conserva una compra contabilizada: orden '+reverse,async({page})=>{
 const p={id:'night-d-p',user_id:'user',fecha:'2026-09-25T10:00:00Z',importe:3.2,comercio:'Compra sintetica Night D',cat:'otros',source:'ob:caixabank#refnight-d#pdng#accA'};
 const b={...p,id:'night-d-b',source:'ob:caixabank#refnight-d#accA'};
 await installFixtureClock(page);
 await seedLoggedInDashboard(page,{__seedOnce:true,accounts:[{id:'cx',ent:'caixabank',role:'diario',spendFrom:true,value:1000}],expenses:[],fixed:[],debts:[],oneoffs:[],goals:[],budget:1000,settings:{autoPrices:false,theme:'green',expenseBanks:['caixabank']},__cloudRows:{expenses:reverse?[b,p]:[p,b]}});
 await page.goto('/');await expect(page.locator('.botnav')).toBeVisible();await dismissNews(page);
 await page.waitForFunction(()=>!document.getElementById('mc-load'));
 await expect.poll(()=>page.evaluate(()=>{
  const e=JSON.parse(localStorage.getItem('micartera_v3_exp')||'[]');return e.length===1&&!e[0].obPending&&Math.round(e[0].amount*100)===320;
 })).toBe(true);
 const id=await page.evaluate(()=>JSON.parse(localStorage.getItem('micartera_v3_exp'))[0].id);
 await page.locator('.botnav-tab[data-tour="gastos"]').click();
 const rows=page.locator('.v4-gastos-list-body button.v4-mov').filter({hasText:'Compra sintetica Night D'});
 await expect(rows).toHaveCount(1);await expect(rows).toContainText('3,20');
 await page.reload();await dismissNews(page);await page.waitForFunction(()=>!document.getElementById('mc-load'));
 await expect.poll(()=>page.evaluate(()=>{
  const e=JSON.parse(localStorage.getItem('micartera_v3_exp')||'[]');return e.length===1&&!e[0].obPending?e[0].id:null;
 })).toBe(id);
});
