import {test,expect} from '@playwright/test';
import {seedLoggedInDashboard,dismissNews,FIXTURE_NOW,installFixtureClock} from './fixtures.mjs';

const owner='e2e-user';
const out={id:'550e8400-e29b-41d4-a716-446655440001',date:new Date(FIXTURE_NOW).toISOString(),merchant:'Envío sintético a otra cuenta',amount:80,category:'otros',source:'ob',ent:'caixabank',obAcc:'fixture-a',extId:'fixture-out'};
const incoming={...out,id:'550e8400-e29b-41d4-a716-446655440002',merchant:'Entrada sintética en cuenta propia',amount:-80,category:'traspaso',ent:'revolut',obAcc:'fixture-b',extId:'fixture-in'};
const accounts=[{id:'caixa',ent:'caixabank',name:'Cuenta A',value:920,bankUid:'fixture-a',role:'diario'},{id:'rev',ent:'revolut',name:'Cuenta B',value:1080,bankUid:'fixture-b',role:'diario'}];
const toRow=e=>({id:e.id,user_id:owner,fecha:e.date,comercio:e.merchant,importe:e.amount,cat:e.category,source:e.source==='manual'?`manual:${e.ent}`:`ob:${e.ent}#ref${encodeURIComponent(e.extId)}#acc${encodeURIComponent(e.obAcc)}`});
const saved=page=>page.evaluate(()=>({expenses:JSON.parse(localStorage.getItem('micartera_v3_exp')||'[]'),state:JSON.parse(localStorage.getItem('micartera_v3')||'{}'),remote:window.__own.rows,writes:window.__own.writes}));
async function open(page,{lang='es',mode='ok',expenses=[out,incoming],remote=expenses.map(toRow),debts=[]}={}){
  await installFixtureClock(page);
  await seedLoggedInDashboard(page,{__seedOnce:true,_historyOwner:owner,expenses,__cloudRows:{expenses:remote},accounts,bankTx:[],fixed:[],debts,oneoffs:[],flows:[],
    settings:{lang,autoPrices:false,expenseBanks:['caixabank','revolut'],budgetCycle:false}});
  await page.addInitScript(({remote,mode})=>{
    const desc=Object.getOwnPropertyDescriptor(window,'supabase');
    window.__own={rows:JSON.parse(localStorage.getItem('_ownFixtureRemote')||'null')||remote,writes:[],mode,gates:{},settled:{}};
    Object.defineProperty(window,'supabase',{configurable:true,get(){const lib=desc.get();if(!lib)return lib;
      return {createClient(){const base=lib.createClient();return {...base,from(table){
        if(table!=='expenses')return base.from(table);
        const f=window.__own,filters=[];let patch=null,beforeId=null,ordering=null,columns='*';
        const matches=r=>filters.every(([k,v])=>r[k]===v);
        const execute=async(single=false)=>{
          let rows=f.rows.filter(matches);if(beforeId)rows=rows.filter(r=>r.id<beforeId);
          if(ordering)rows.sort((a,b)=>(a[ordering.k]<b[ordering.k]?-1:a[ordering.k]>b[ordering.k]?1:0)*(ordering.ascending?1:-1));
          if(patch){
            f.writes.push({patch:structuredClone(patch),filters:structuredClone(filters)});
            const gate=rows[0]&&f.gates[rows[0].id];
            if(gate){const answer=await new Promise(resolve=>{gate.release=resolve;});if(answer==='error')return {data:null,error:new Error('fixture per-row denied')};}
            if(f.mode==='hold')await new Promise(resolve=>{f.release=resolve;});
            rows=f.rows.filter(matches);
            if(['casNo','casSemantic','casZero2','rereadError'].includes(f.mode)&&!f.raced){
              f.raced=true;f.rows[0].source+='#ownno';if(f.mode==='casSemantic')f.rows[0].cat='salud';return {data:[],error:null};
            }
            if(f.mode==='casZero2'&&f.raced)return {data:[],error:null};
            if(f.mode==='zero')return {data:[],error:null};
            if(f.mode==='error')return {data:null,error:new Error('fixture denied')};
            rows.forEach(r=>Object.assign(r,patch));
            if(f.mode==='partnerAfter')f.rows[1].cat='otros';
            localStorage.setItem('_ownFixtureRemote',JSON.stringify(f.rows));
            if(f.mode==='holdAck')await new Promise(resolve=>{f.release=resolve;});
            if(f.mode==='lostAck')return {data:[],error:null};
          }
          if(!patch&&single&&f.mode==='rereadError'&&f.raced)return {data:null,error:new Error('fixture reread denied')};
          if(!patch&&f.mode==='empty'&&columns!=='*')rows=[];
          const data=structuredClone(rows.map(r=>columns==='*'?r:Object.fromEntries(columns.split(',').map(k=>[k,r[k]]))));return {data:single?(data[0]||null):data,error:null};
        };
        const q={select(value='*'){columns=value;return q;},eq(k,v){filters.push([k,v]);return q;},is(k,v){filters.push([k,v]);return q;},order(k,opts){ordering={k,ascending:opts&&opts.ascending};return q;},limit(){return q;},lt(k,v){if(k==='id')beforeId=v;return q;},
          update(p){patch=p;return q;},upsert(...args){return base.from(table).upsert(...args);},maybeSingle(){return execute(true);},then(resolve,reject){return execute().then(resolve,reject);}};return q;
      }};}};
    },set(v){desc.set(v);}});
  },{remote,mode});
  await page.goto('/');await dismissNews(page);await page.waitForFunction(()=>!document.getElementById('mc-load'));
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await page.locator('.v4-gastos-list-body button.v4-mov').filter({hasText:expenses[0].merchant}).click();
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
  await expect(page.locator('.v4-exp-sheet .v4-ficha-saved')).toHaveText('Cambio sin confirmar');
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

const quotaDebt={id:'fixture-loan',name:'Préstamo sintético',value:1200,original:1200,monthly:75,account:'caixabank',day:26,asOf:2026*12+8};
async function chooseQuota(sheet){
  await sheet.getByRole('button',{name:/Es la cuota de una deuda/}).click();
  await sheet.getByTestId('exp-cuota-de').getByRole('button',{name:/Préstamo sintético/}).click();
}
async function changeLiveState(page,kind){
  await page.evaluate(({kind,id})=>{
    const el=document.querySelector('[data-testid="exp"]');
    let fiber=el[Object.keys(el).find(k=>k.startsWith('__reactFiber'))];
    while(fiber&&!(fiber.memoizedProps&&fiber.memoizedProps.onRefreshExpenses))fiber=fiber.return;
    if(!fiber)throw new Error('Expenses controller missing');
    fiber.memoizedProps.set(s=>kind==='debt'?{...s,debts:[]}:kind==='owner'?{...s,_historyOwner:'different-fixture-owner'}:
      {...s,expenses:s.expenses.map(e=>e.id===id?{...e,category:'salud'}:e)});
  },{kind,id:out.id});
}
for(const mode of ['casZero2','casSemantic','rereadError','empty'])test(`cuota sin acuse: conserva estado y recupera desde Actualizar (${mode})`,async({page})=>{
  const sheet=await open(page,{mode,debts:[quotaDebt]});await chooseQuota(sheet);
  await expect(sheet.getByTestId('exp-source-save-status')).toContainText('No se ha podido confirmar este cambio');
  const failed=await saved(page);expect(failed.expenses.find(e=>e.id===out.id).debtId).toBeUndefined();
  expect(failed.expenses.find(e=>e.id===out.id).category).toBe('otros');
  expect(failed.state.cuotaAlias||{}).toEqual({});
  await page.evaluate(()=>{window.__own.mode='ok';});
  await sheet.getByTestId('exp-source-refresh').click();
  await expect(sheet.getByTestId('exp-source-save-status')).toHaveCount(0);
  if(mode==='casSemantic')await expect.poll(async()=>(await saved(page)).expenses.find(e=>e.id===out.id).category).toBe('salud');
  await sheet.getByTestId('exp-cuota-de').getByRole('button',{name:/Préstamo sintético/}).click();
  await expect.poll(async()=>(await saved(page)).expenses.find(e=>e.id===out.id).debtId).toBe(quotaDebt.id);
  expect((await saved(page)).remote[0].source).toContain('~deuda.');
});
test('cuota reintenta sólo el NO concurrente y muestra éxito tras el acuse real',async({page})=>{
  const sheet=await open(page,{mode:'casNo',debts:[quotaDebt]});await chooseQuota(sheet);
  await expect.poll(async()=>(await saved(page)).expenses.find(e=>e.id===out.id).debtManual).toBe(true);
  const result=await saved(page);expect(result.writes).toHaveLength(2);expect(result.remote[0].source).toContain('#ownno');
  expect(result.remote[0].source).toContain('~deuda.');await expect(sheet.getByTestId('exp-source-save-status')).toHaveCount(0);
});
for(const kind of ['category','debt','owner'])test(`acuse tardío de cuota no aplica otra intención (${kind})`,async({page})=>{
  const sheet=await open(page,{mode:'hold',debts:[quotaDebt]});await startSourceCaller(page,'setCuota',out.id,quotaDebt.id);
  await expect(page.locator('.v4-exp-sheet .v4-ficha-saved')).toHaveText('Guardando cambio…');
  await expect.poll(()=>page.evaluate(()=>typeof window.__own.release)).toBe('function');
  await changeLiveState(page,kind);
  await expect.poll(async()=>{const result=await saved(page);return kind==='debt'?result.state.debts.length:kind==='owner'?result.state._historyOwner:result.expenses.find(e=>e.id===out.id).category;}).toBe(kind==='debt'?0:kind==='owner'?'different-fixture-owner':'salud');
  await page.evaluate(()=>{window.__own.mode='ok';window.__own.release();});
  await waitSourceCaller(page,out.id);
  if(kind!=='owner')await expect(sheet.getByTestId('exp-source-save-status')).toContainText('No se ha podido confirmar este cambio');
  else await expect.poll(async()=>(await saved(page)).state._historyOwner).toBe('different-fixture-owner');
  const result=await saved(page);expect(result.expenses.find(e=>e.id===out.id)?.debtManual).not.toBe(true);
  if(kind==='category')expect(result.expenses.find(e=>e.id===out.id).category).toBe('salud');
  if(kind==='debt')expect(result.state.debts).toEqual([]);
  expect(result.state.cuotaAlias||{}).toEqual({});
});
test('cuota automática fallida sigue recuperable sin marca optimista',async({page})=>{
  const sheet=await open(page,{mode:'zero',debts:[{...quotaDebt,monthly:80}]});
  await expect(sheet.getByTestId('exp-source-save-status')).toContainText('No se ha podido confirmar este cambio');
  const failed=await saved(page);expect(failed.expenses.find(e=>e.id===out.id).debtId).toBeUndefined();
  await page.evaluate(()=>{window.__own.mode='ok';});await sheet.getByTestId('exp-source-refresh').click();
  await expect.poll(async()=>(await saved(page)).expenses.find(e=>e.id===out.id).debtId).toBe(quotaDebt.id);
  await expect(sheet.getByTestId('exp-source-save-status')).toHaveCount(0);
  expect((await saved(page)).remote[0].source).toContain('~deuda.');
});
test('cuota automática con ACK perdido retira error al recibir la marca remota',async({page})=>{
  const sheet=await open(page,{mode:'hold',debts:[{...quotaDebt,monthly:80}]});
  await expect.poll(()=>page.evaluate(()=>typeof window.__own.release)).toBe('function');
  await page.evaluate(()=>{window.__own.mode='lostAck';window.__own.release();});
  await expect(sheet.getByTestId('exp-source-save-status')).toContainText('No se ha podido confirmar este cambio');
  const failed=await saved(page);expect(failed.remote[0].source).toContain('~deuda.');
  expect(failed.expenses.find(e=>e.id===out.id).debtId).toBeUndefined();
  await page.evaluate(()=>{window.__own.mode='ok';});await sheet.getByTestId('exp-source-refresh').click();
  await expect.poll(async()=>(await saved(page)).expenses.find(e=>e.id===out.id).debtId).toBe(quotaDebt.id);
  await expect(sheet.getByTestId('exp-source-save-status')).toHaveCount(0);
});
test('pull confirmado antes del ACK automático limpia el error tardío',async({page})=>{
  const sheet=await open(page,{mode:'zero',debts:[{...quotaDebt,monthly:80}]});
  await expect(sheet.getByTestId('exp-source-save-status')).toContainText('No se ha podido confirmar este cambio');
  await expect(page.locator('.v4-exp-sheet .v4-ficha-saved')).toHaveText('Cambio sin confirmar');
  await page.screenshot({path:test.info().outputPath('source-save-recovery.png'),animations:'disabled'});
  await page.evaluate(()=>{window.__own.mode='holdAck';});await sheet.getByTestId('exp-source-refresh').click();
  await expect.poll(()=>page.evaluate(()=>typeof window.__own.release)).toBe('function');
  expect((await saved(page)).expenses.find(e=>e.id===out.id).debtId).toBeUndefined();
  await sheet.getByTestId('exp-source-refresh').click();
  await expect.poll(async()=>(await saved(page)).expenses.find(e=>e.id===out.id).debtId).toBe(quotaDebt.id);
  await page.evaluate(()=>{window.__own.mode='ok';window.__own.release();});
  // Deja terminar el catch y la conciliación antes de afirmar que no reaparece el aviso.
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await expect(sheet.getByTestId('exp-source-save-status')).toHaveCount(0);
});


// Se invoca el callback REAL de la ficha para controlar el orden de dos escrituras;
// no se sustituye el reducer ni el writer. Su promesa acredita que el caller acabó.
async function startSourceCaller(page,name,id,value){
  await page.evaluate(({name,id,value})=>{
    const el=document.querySelector('[data-testid="exp"]');let f=el[Object.keys(el).find(k=>k.startsWith('__reactFiber'))];
    while(f&&!(f.memoizedProps&&typeof f.memoizedProps[name]==='function'))f=f.return;
    if(!f)throw new Error('Detail caller missing: '+name);
    const props=f.memoizedProps,e=props.state.expenses.find(x=>x.id===id);
    window.__own.settled[id]=false;
    Promise.resolve(props[name](e,value)).finally(()=>{window.__own.settled[id]=true;});
  },{name,id,value});
}
async function waitSourceCaller(page,id){
  await expect.poll(()=>page.evaluate(id=>window.__own.settled[id],id)).toBe(true);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
}
async function showRow(page,merchant){
  await page.locator('.v4-exp-sheet .v4-ficha-done').click();
  await page.getByTestId('exp',{exact:true}).waitFor({state:'hidden'});
  const row=page.getByRole('button').filter({hasText:merchant});
  if(!await row.count()&&await page.getByRole('button',{name:/^Traspasos · no cuentan/}).count())await page.getByRole('button',{name:/^Traspasos · no cuentan/}).click();
  await row.click();
  return page.getByTestId('exp',{exact:true});
}
async function realPull(page){
  await page.evaluate(async()=>{
    const el=document.querySelector('[data-testid="exp"]');let f=el[Object.keys(el).find(k=>k.startsWith('__reactFiber'))];
    while(f&&!(f.memoizedProps&&f.memoizedProps.onRefreshExpenses))f=f.return;
    await f.memoizedProps.onRefreshExpenses();
  });
}
const manualA={...out,merchant:'Manual sintético A',source:'manual',extId:undefined,obAcc:undefined};
const manualB={...manualA,id:incoming.id,merchant:'Manual sintético B',amount:37};
for(const order of ['Aok-Bpending','Berror-Aok'])test(`R4 estados por fila: ${order}`,async({page})=>{
  await open(page,{expenses:[manualA,manualB]});
  await page.evaluate(ids=>ids.forEach(id=>{window.__own.gates[id]={};}),[manualA.id,manualB.id]);
  await startSourceCaller(page,'setBank',manualA.id,'revolut');
  await expect.poll(()=>page.evaluate(id=>typeof window.__own.gates[id].release,manualA.id)).toBe('function');
  const sheet=await showRow(page,manualB.merchant);
  await startSourceCaller(page,'setBank',manualB.id,'revolut');
  await expect.poll(()=>page.evaluate(id=>typeof window.__own.gates[id].release,manualB.id)).toBe('function');
  if(order==='Berror-Aok'){
    await page.evaluate(id=>window.__own.gates[id].release('error'),manualB.id);await waitSourceCaller(page,manualB.id);
    await expect(sheet.getByTestId('exp-source-refresh')).toBeVisible();
  }
  await page.evaluate(id=>window.__own.gates[id].release('ok'),manualA.id);await waitSourceCaller(page,manualA.id);
  await expect(page.locator('.v4-exp-sheet .v4-ficha-saved')).toHaveText(order==='Aok-Bpending'?'Guardando cambio…':'Cambio sin confirmar');
  if(order==='Berror-Aok')await expect(sheet.getByTestId('exp-source-refresh')).toBeVisible();
});
test('R4 error manual A no tapa error automático B',async({page})=>{
  const autoB={...out,id:incoming.id,merchant:'Cuota automática sintética B'};
  await open(page,{mode:'zero',expenses:[manualA,autoB],debts:[{...quotaDebt,monthly:80}]});
  await startSourceCaller(page,'setBank',manualA.id,'revolut');await waitSourceCaller(page,manualA.id);
  const sheet=await showRow(page,autoB.merchant);
  await expect(sheet.getByTestId('exp-source-refresh')).toBeVisible();
  await expect(page.locator('.v4-exp-sheet .v4-ficha-saved')).toHaveText('Cambio sin confirmar');
});
for(const decision of ['yes','no'])test(`R4 traspaso ${decision} ACK perdido recupera con pull y reapertura`,async({page})=>{
  const sheet=await open(page,{mode:'lostAck'});await sheet.getByTestId('exp-own-transfer').click();
  await page.locator('.askback').getByRole('button',{name:translations.es[decision==='yes'?1:2],exact:true}).click();
  await expect(sheet.getByTestId('exp-own-transfer-status')).toContainText('No se ha podido confirmar');
  const before=await saved(page);expect(decision==='yes'?before.remote[0].cat:before.remote[0].source.includes('#ownno')).toBe(decision==='yes'?'traspaso':true);
  await page.evaluate(()=>{window.__own.mode='ok';});
  await sheet.getByTestId('exp-own-transfer-refresh').click();
  await expect(sheet.getByTestId('exp-own-transfer-status')).toHaveCount(0);
  await expect(sheet.getByTestId('exp-own-transfer')).toHaveCount(0);
  await showRow(page,out.merchant);
  await expect(page.getByTestId('exp-own-transfer-status')).toHaveCount(0);
  await expect(page.getByTestId('exp-own-transfer')).toHaveCount(0);
});
for(const decision of ['yes','no'])test(`R4 traspaso ${decision} pull antes del rechazo tardío`,async({page})=>{
  const sheet=await open(page,{mode:'holdAck'});await sheet.getByTestId('exp-own-transfer').click();
  await page.locator('.askback').getByRole('button',{name:translations.es[decision==='yes'?1:2],exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>typeof window.__own.release)).toBe('function');
  await realPull(page);
  await expect.poll(async()=>{const e=(await saved(page)).expenses.find(e=>e.id===out.id);return decision==='yes'?e.category:e.ownTransferRejected;}).toBe(decision==='yes'?'traspaso':true);
  await page.evaluate(()=>{window.__own.mode='lostAck';window.__own.release();});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await expect(sheet.getByTestId('exp-own-transfer-status')).toHaveCount(0);
  await expect(page.locator('.v4-exp-sheet .v4-ficha-saved')).toHaveText('Se guarda al momento ✓');
  await expect(page.getByText('No se ha podido confirmar tu respuesta. Actualiza los movimientos antes de intentarlo otra vez.',{exact:true})).toHaveCount(0);
});
test('R4 traspaso no limpia un conflicto semántico al actualizar',async({page})=>{
  const sheet=await open(page,{mode:'lostAck'});await sheet.getByTestId('exp-own-transfer').click();
  await page.locator('.askback').getByRole('button',{name:translations.es[1],exact:true}).click();
  await expect(sheet.getByTestId('exp-own-transfer-status')).toContainText('No se ha podido confirmar');
  await page.evaluate(()=>{window.__own.mode='ok';window.__own.rows[0].cat='salud';});
  await sheet.getByTestId('exp-own-transfer-refresh').click();
  await expect.poll(async()=>(await saved(page)).expenses.find(e=>e.id===out.id).category).toBe('salud');
  await expect(sheet.getByTestId('exp-own-transfer-status')).toContainText('No se ha podido confirmar');
  await expect(page.locator('.v4-exp-sheet .v4-ficha-saved')).toHaveText('Cambio sin confirmar');
});
