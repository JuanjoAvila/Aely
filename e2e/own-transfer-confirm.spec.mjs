import {test,expect} from '@playwright/test';
import {seedLoggedInDashboard,dismissNews,FIXTURE_NOW,installFixtureClock} from './fixtures.mjs';

const owner='e2e-user';
const out={id:'550e8400-e29b-41d4-a716-446655440001',date:new Date(FIXTURE_NOW).toISOString(),merchant:'Envío sintético a otra cuenta',amount:80,category:'otros',source:'ob',ent:'caixabank',obAcc:'fixture-a',extId:'fixture-out'};
const incoming={...out,id:'550e8400-e29b-41d4-a716-446655440002',merchant:'Entrada sintética en cuenta propia',amount:-80,category:'traspaso',ent:'revolut',obAcc:'fixture-b',extId:'fixture-in'};
const accounts=[{id:'caixa',ent:'caixabank',name:'Cuenta A',value:920,bankUid:'fixture-a',role:'diario'},{id:'rev',ent:'revolut',name:'Cuenta B',value:1080,bankUid:'fixture-b',role:'diario'}];
const toRow=e=>({id:e.id,user_id:owner,fecha:e.date,comercio:e.merchant,importe:e.amount,cat:e.category,source:`ob:${e.ent}#ref${encodeURIComponent(e.extId)}#acc${encodeURIComponent(e.obAcc)}`});
const saved=page=>page.evaluate(()=>({expenses:JSON.parse(localStorage.getItem('micartera_v3_exp')||'[]'),state:JSON.parse(localStorage.getItem('micartera_v3')||'{}'),remote:window.__own.rows,writes:window.__own.writes}));
async function open(page,{lang='es',mode='ok',expenses=[out,incoming],remote=expenses.map(toRow)}={}){
  await installFixtureClock(page);
  await seedLoggedInDashboard(page,{__seedOnce:true,_historyOwner:owner,expenses,__cloudRows:{expenses:remote},accounts,bankTx:[],fixed:[],debts:[],oneoffs:[],flows:[],
    settings:{lang,autoPrices:false,expenseBanks:['caixabank','revolut'],budgetCycle:false}});
  await page.addInitScript(({remote,mode})=>{
    const desc=Object.getOwnPropertyDescriptor(window,'supabase');
    window.__own={rows:JSON.parse(localStorage.getItem('_ownFixtureRemote')||'null')||remote,writes:[],mode};
    Object.defineProperty(window,'supabase',{configurable:true,get(){const lib=desc.get();if(!lib)return lib;
      return {createClient(){const base=lib.createClient();return {...base,from(table){
        if(table!=='expenses')return base.from(table);
        const f=window.__own,filters=[];let patch=null,beforeId=null,ordering=null;
        const matches=r=>filters.every(([k,v])=>r[k]===v);
        const execute=async(single=false)=>{
          let rows=f.rows.filter(matches);if(beforeId)rows=rows.filter(r=>r.id<beforeId);
          if(ordering)rows.sort((a,b)=>(a[ordering.k]<b[ordering.k]?-1:a[ordering.k]>b[ordering.k]?1:0)*(ordering.ascending?1:-1));
          if(patch){
            f.writes.push({patch:structuredClone(patch),filters:structuredClone(filters)});
            if(f.mode==='zero')return {data:[],error:null};
            if(f.mode==='error')return {data:null,error:new Error('fixture denied')};
            rows.forEach(r=>Object.assign(r,patch));
            if(f.mode==='partnerAfter')f.rows[1].cat='otros';
            localStorage.setItem('_ownFixtureRemote',JSON.stringify(f.rows));
          }
          const data=structuredClone(rows);return {data:single?(data[0]||null):data,error:null};
        };
        const q={select(){return q;},eq(k,v){filters.push([k,v]);return q;},order(k,opts){ordering={k,ascending:opts&&opts.ascending};return q;},limit(){return q;},lt(k,v){if(k==='id')beforeId=v;return q;},
          update(p){patch=p;return q;},upsert(...args){return base.from(table).upsert(...args);},maybeSingle(){return execute(true);},then(resolve,reject){return execute().then(resolve,reject);}};return q;
      }};}};
    },set(v){desc.set(v);}});
  },{remote,mode});
  await page.goto('/');await dismissNews(page);await page.waitForFunction(()=>!document.getElementById('mc-load'));
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await page.locator('.v4-gastos-list-body button.v4-mov').filter({hasText:out.merchant}).click();
  return page.getByTestId('exp',{exact:true});
}
const translations={es:['¿Lo enviaste a otra cuenta tuya?','Sí, es mi dinero','No, es un pago'],en:['Did you send this to another account of yours?','Yes, it is my money','No, it is a payment'],ca:['Ho vas enviar a un altre compte teu?','Sí, són els meus diners','No, és un pagament']};
for(const lang of ['es','en','ca'])test(`cancelar no decide; sí solo cambia categoría saliente (${lang})`,async({page})=>{
  const sheet=await open(page,{lang}),action=sheet.getByTestId('exp-own-transfer'),txt=translations[lang];
  await expect(action).toHaveText(txt[0]);const before=await saved(page);
  await action.click();
  await expect(page.locator('.askback').getByRole('button',{name:txt[1],exact:true})).toBeInViewport();
  await expect(page.locator('.askback .btn-ghost')).toBeInViewport({ratio:1});
  if(lang==='es')await page.screenshot({path:test.info().outputPath('own-transfer-question.png'),animations:'disabled'});
  await page.locator('.askback .btn-ghost').click();await expect(action).toBeVisible();
  expect((await saved(page)).writes).toEqual([]);
  await action.click();await page.locator('.askback').getByRole('button',{name:txt[1],exact:true}).click();
  await expect.poll(async()=>((await saved(page)).expenses.find(e=>e.id===out.id)||{}).category).toBe('traspaso');
  const after=await saved(page);expect(after.writes).toHaveLength(1);expect(after.writes[0].patch).toEqual({cat:'traspaso'});
  expect(after.remote[1]).toEqual(before.remote[1]);expect(after.state.accounts).toEqual(before.state.accounts);
  const prior=before.expenses.find(e=>e.id===out.id),changed=after.expenses.find(e=>e.id===out.id);
  expect(changed).toEqual({...prior,category:'traspaso'});
  expect(after.expenses.find(e=>e.id===incoming.id)).toEqual(before.expenses.find(e=>e.id===incoming.id));
  for(const key of ['fixed','debts','positions','oneoffs','flows'])expect(after.state[key]).toEqual(before.state[key]);
});
test('no explícito persiste en fila, recarga y dispositivo que recibe nube',async({page,browser})=>{
  const sheet=await open(page);await sheet.getByTestId('exp-own-transfer').click();
  await page.locator('.askback').getByRole('button',{name:translations.es[2],exact:true}).click();
  await expect(sheet.getByTestId('exp-own-transfer')).toHaveCount(0);
  await expect.poll(async()=>((await saved(page)).expenses.find(e=>e.id===out.id)||{}).ownTransferRejected).toBe(true);
  const result=await saved(page);expect(result.writes).toHaveLength(1);expect(Object.keys(result.writes[0].patch)).toEqual(['source']);
  expect(result.remote[0].cat).toBe('otros');expect(result.remote[0].source).toContain('#ownno');
  await page.reload();await dismissNews(page);await page.waitForFunction(()=>!document.getElementById('mc-load'));
  await page.locator('.botnav-tab[data-tour="gastos"]').click();await page.locator('button.v4-mov').filter({hasText:out.merchant}).click();
  await expect(page.getByTestId('exp-own-transfer')).toHaveCount(0);
  const context=await browser.newContext({baseURL:test.info().project.use.baseURL,viewport:{width:393,height:851},isMobile:true,hasTouch:true});
  try{const b=await context.newPage();await open(b,{remote:result.remote});
    await b.evaluate(()=>{let visibility='hidden';Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>visibility});document.dispatchEvent(new Event('visibilitychange'));visibility='visible';document.dispatchEvent(new Event('visibilitychange'));});
    await expect.poll(async()=>((await saved(b)).expenses.find(e=>e.id===out.id)||{}).ownTransferRejected).toBe(true);
    await expect(b.getByTestId('exp-own-transfer')).toHaveCount(0);expect((await saved(b)).writes).toEqual([]);
  }finally{await context.close();}
});
for(const mode of ['zero','error'])test(`respuesta sin confirmación no se aplica localmente (${mode})`,async({page})=>{
  const sheet=await open(page,{mode});await sheet.getByTestId('exp-own-transfer').click();
  await page.locator('.askback').getByRole('button',{name:translations.es[1],exact:true}).click();
  await expect(sheet.getByTestId('exp-own-transfer-status')).toContainText('No se ha podido confirmar');
  const result=await saved(page);expect(result.expenses.find(e=>e.id===out.id).category).toBe('otros');
  expect(result.remote[0].cat).toBe('otros');
});
test('contraparte cambia tras UPDATE: ACK de salida sigue confirmado y no se vuelve a ofrecer',async({page})=>{
  const sheet=await open(page,{mode:'partnerAfter'});await sheet.getByTestId('exp-own-transfer').click();
  await page.locator('.askback').getByRole('button',{name:translations.es[1],exact:true}).click();
  await expect.poll(async()=>((await saved(page)).expenses.find(e=>e.id===out.id)||{}).category).toBe('traspaso');
  const result=await saved(page);expect(result.remote[0].cat).toBe('traspaso');expect(result.remote[1].cat).toBe('otros');
  expect(result.writes).toHaveLength(1);expect(result.writes[0].patch).toEqual({cat:'traspaso'});
  await expect(sheet.getByTestId('exp-own-transfer')).toHaveCount(0);await expect(sheet.getByTestId('exp-own-transfer-status')).toHaveCount(0);
});
for(const condition of ['amount','account','ambiguous'])test(`sin oferta cuando falla ${condition}`,async({page})=>{
  const rows=structuredClone([out,incoming]);
  if(condition==='amount')rows[1].amount=-80.01;
  if(condition==='account')rows[1].obAcc='unknown';
  if(condition==='ambiguous')rows.push({...rows[1],id:'550e8400-e29b-41d4-a716-446655440003',extId:'third'});
  const sheet=await open(page,{expenses:rows});await expect(sheet.getByTestId('exp-own-transfer')).toHaveCount(0);expect((await saved(page)).writes).toEqual([]);
});
