import {test,expect} from '@playwright/test';
import {seedLoggedInDashboard,dismissNews} from './fixtures.mjs';

const debt={id:'undo-debt',name:'Préstamo sintético',value:6000,monthly:210,amort:270,months:30,asOf:2026*12+9,day:20,account:'sabadell'};
const bill={id:'undo-bill',name:'Fibra sintética',amount:40,bankAmount:80,freq:'mes',day:20,account:'sabadell',reparto:[{id:'persona-undo',n:'Persona',via:'debt',debtId:debt.id,amt:40}]};
async function open(page,overrides={},realTimers=false,detail=false){
  test.info().annotations.push({type:'own-clock'});
  // Mismo reloj con offset de fixtures.mjs: Date avanza y el scheduler conserva timers/performance reales.
  if(realTimers) await page.addInitScript(epoch=>{
    const NativeDate=Date,offset=epoch-NativeDate.now();
    function FixtureDate(...args){const values=args.length?args:[NativeDate.now()+offset];return new.target?Reflect.construct(NativeDate,values,new.target):new NativeDate(NativeDate.now()+offset).toString();}
    Object.setPrototypeOf(FixtureDate,NativeDate);FixtureDate.prototype=NativeDate.prototype;FixtureDate.now=()=>NativeDate.now()+offset;window.Date=FixtureDate;
  },Date.parse('2026-10-18T12:00:00+02:00'));
  else await page.clock.install({time:new Date('2026-10-18T12:00:00+02:00')});
  await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  if(detail){
    const f=overrides.fixed?.[0]||bill;
    // «Ya no lo tengo» vive en avisos de recibos que han dejado de llegar (o han subido).
    overrides={expenses:[
      {id:'last-bill',date:'2026-07-20',amount:f.bankAmount||f.amount,merchant:f.name,ent:'sabadell',source:'ob',reciboId:f.id},
      {id:'aug-other',date:'2026-08-02',amount:1,merchant:'Otro sintético',ent:'sabadell',source:'ob'},
      {id:'sep-other',date:'2026-09-02',amount:1,merchant:'Otro sintético',ent:'sabadell',source:'ob'}
    ],...overrides};
  }
  await seedLoggedInDashboard(page,{__seedOnce:true,lastBackup:'2026-10-18',bankTx:[],debts:[debt],fixed:[bill],flows:[],oneoffs:[],expenses:[],accounts:[{id:'bank',ent:'sabadell',role:'fijos',value:3000}],settings:{autoPrices:false,theme:'green',lang:'es',simpleMode:false,expenseBanks:['sabadell']},...overrides});
  await page.goto('/');await expect(page.locator('.botnav')).toBeVisible();
  await page.waitForFunction(()=>!document.getElementById('mc-load'));await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  if(detail){
    await page.locator('.page-live [data-seg="recibos"] [data-recibo="fixed_undo-bill"]').first().click();
    const remove=page.locator('[data-sheet="recibo"] [data-act="quitar"]');
    await remove.click();await remove.click();return;
  }
  await page.locator('.page-live [data-seg="recibos"]').getByTestId('plan-due').getByRole('button',{name:'Gestionar',exact:true}).click();
  await page.locator('[data-bills-manage] [data-group="serv"]').click();
  await page.locator('[data-bill-id="undo-bill"]').click();
  await page.locator('.v4-sheet[data-sheet="recibo-pasos"] [data-act="bill-remove"]').click();
  await page.locator('.v4-sheet[data-sheet="recibo-pasos"] [data-act="bill-remove"]').click();
}
const ask=page=>page.locator('.askback .tabsheet');
const undo=page=>page.locator('.v4-undo-toast').getByRole('button',{name:'Deshacer',exact:true});
const saved=page=>page.evaluate(()=>{const s=mcLoadRaw(mcStateKey());return {fixed:s.fixed,debts:s.debts};});

test('R168 ficha: Deshacer espera las preguntas y restaura el recibo y deuda exactos',async({page})=>{
  await open(page,{},false,true);
  await expect(ask(page).locator('.ask-in')).toBeVisible();await expect(undo(page)).toHaveCount(0);
  await page.clock.runFor(6000);await ask(page).locator('.ask-in').fill('290');
  await ask(page).getByRole('button',{name:'Ajustar la deuda'}).click();
  await page.clock.runFor(500);const removed=await saved(page);expect(removed.fixed).toEqual([]);expect(removed.debts[0].amort).toBe(290);
  await expect(undo(page)).toBeVisible();await undo(page).click();
  await expect(page.locator('[data-seg="recibos"] [data-recibo="fixed_undo-bill"]').first()).toBeVisible();await page.clock.runFor(500);
  expect(await saved(page)).toEqual({fixed:[bill],debts:[debt]});
  await expect(page.locator('[data-sheet="recibo"]')).toHaveCount(0);
  await page.reload();await page.waitForFunction(()=>!document.getElementById('mc-load'));
  expect(await saved(page)).toEqual({fixed:[bill],debts:[debt]});
});

async function changeDebt(page,mode){
  await page.evaluate(mode=>{
    const el=document.querySelector('[data-seg="recibos"]');let f=el[Object.keys(el).find(k=>k.startsWith('__reactFiber$'))];
    while(f&&!(f.memoizedProps?.state&&f.memoizedProps?.set))f=f.return;
    if(!f)throw Error('Falta estado real de Plan');
    ReactDOM.flushSync(()=>f.memoizedProps.set(s=>({...s,debts:mode==='orphan'?[{id:'undo-debt',name:'Posterior',value:99,monthly:1}]:s.debts.map(d=>d.id==='undo-debt'?{...d,note:'Cambio posterior',extra:{nested:[7]}}:d)})));
  },mode);
}
const money=page=>page.evaluate(()=>{
  const s=mcLoadRaw(mcStateKey());return {fixed:s.fixed,debts:s.debts,accounts:s.accounts,expenses:s.expenses,shown:(s.accounts||[]).map(a=>Math.round(saldoCuentaMostrada(a,insumosSaldoGasto(s))*100)),reciboBorrado:s.reciboBorrado,reciboBorradoAt:s.reciboBorradoAt};
});
test('R168 ficha: una deuda cambiada impide toda reposición y conserva dinero y marcas',async({page})=>{
  const other={...debt,id:'other',name:'Otra deuda sintética',monthly:190,amort:210};
  const shared={...bill,amount:20,reparto:[...bill.reparto,{id:'other-person',n:'Otra persona',via:'debt',debtId:'other',amt:20}]};
  await open(page,{debts:[debt,other],fixed:[shared]},false,true);
  await ask(page).getByRole('button',{name:'Ajustar la deuda'}).click();await expect(undo(page)).toBeVisible();
  await changeDebt(page);await page.clock.runFor(500);const before=await money(page);expect(before.fixed).toEqual([]);
  await undo(page).click();await expect(page.getByTestId('bills-saved')).toHaveText('No se ha deshecho nada porque hay cambios posteriores.');
  await expect(page.getByTestId('bills-saved')).toHaveCount(1);await page.clock.runFor(500);expect(await money(page)).toEqual(before);
});
for(const mode of ['cancel','orphan'])test('R168 ficha: protege deuda '+mode+' sin restaurar el recibo',async({page})=>{
  await open(page,mode==='orphan'?{debts:[]}:{},false,true);
  if(mode==='cancel')await ask(page).getByRole('button',{name:'Dejarla como está'}).click();
  await expect(undo(page)).toBeVisible();await changeDebt(page,mode);await page.clock.runFor(500);const before=await money(page);
  await undo(page).click();await expect(page.getByTestId('bills-saved')).toHaveText('No se ha deshecho nada porque hay cambios posteriores.');
  await page.clock.runFor(500);expect(await money(page)).toEqual(before);
});
test('R168 ficha: único recibo sobrevive a Plan vacío, doble toque y caducidad',async({page})=>{
  const only={...bill};delete only.reparto;delete only.bankAmount;
  await open(page,{fixed:[only],debts:[]},false,true);await expect(undo(page)).toBeVisible();await expect(page.getByTestId('plan-onb')).toBeVisible();
  await undo(page).evaluate(el=>{el.click();el.click();});await expect(page.getByTestId('plan-onb')).toHaveCount(0);await page.clock.runFor(500);
  expect(await saved(page)).toEqual({fixed:[only],debts:[]});
  await page.locator('[data-seg="recibos"] [data-recibo="fixed_undo-bill"]').first().click();
  const remove=page.locator('[data-sheet="recibo"] [data-act="quitar"]');await remove.click();await remove.click();
  await expect(undo(page)).toBeVisible();await page.clock.runFor(5001);await expect(undo(page)).toHaveCount(0);expect((await saved(page)).fixed).toEqual([]);
});
for(const queued of [false,true])test('R168 ficha: cierre explícito cancela '+(queued?'intención encolada':'pregunta pendiente'),async({page})=>{
  await open(page,{},true,true);await expect(ask(page).locator('.ask-in')).toBeVisible();
  await page.evaluate(async queued=>{
    const el=document.querySelector('[data-sheet="recibo"]');let f=el[Object.keys(el).find(k=>k.startsWith('__reactFiber$'))];
    while(f&&!(f.memoizedProps?.state&&f.memoizedProps?.onClose))f=f.return;
    if(!f)throw Error('Falta cierre real de ficha');
    if(queued){document.querySelector('.askback .btn-primary').click();for(let i=0;i<10;i++)await Promise.resolve();}
    ReactDOM.flushSync(()=>f.memoizedProps.onClose());
  },queued);
  await expect(page.locator('[data-sheet="recibo"]')).toHaveCount(0);
  if(!queued)await ask(page).getByRole('button',{name:'Ajustar la deuda'}).click();
  await new Promise(r=>setTimeout(r,1000));expect(await saved(page)).toEqual({fixed:[bill],debts:[debt]});await expect(undo(page)).toHaveCount(0);
});
test('R168 ficha: cambio previo al commit rechaza y salida de segmento invalida Deshacer',async({page})=>{
  await open(page,{},false,true);await expect(ask(page).locator('.ask-in')).toBeVisible();await changeDebt(page);
  await ask(page).getByRole('button',{name:'Ajustar la deuda'}).click();await expect(page.getByTestId('bills-saved')).toHaveText('No se ha podido quitar el recibo. Revisa los cambios e inténtalo de nuevo.');
  await page.clock.runFor(500);expect((await saved(page)).fixed).toEqual([bill]);await expect(undo(page)).toHaveCount(0);
  await page.locator('[data-seg="recibos"] [data-recibo="fixed_undo-bill"]').first().click();
  const remove=page.locator('[data-sheet="recibo"] [data-act="quitar"]');await remove.click();await remove.click();
  await ask(page).getByRole('button',{name:'Ajustar la deuda'}).click();await expect(undo(page)).toBeVisible();
  await page.clock.runFor(500);expect((await saved(page)).fixed).toEqual([]);
  await page.getByRole('tab',{name:'Deudas',exact:true}).click();await expect(undo(page)).toHaveCount(0);
  await page.getByRole('tab',{name:'Recibos',exact:true}).click();await expect(undo(page)).toHaveCount(0);expect((await saved(page)).fixed).toEqual([]);
});

test('Deshacer espera las preguntas y restaura el delta completo tras el commit',async({page})=>{
  await open(page);
  await expect(ask(page).locator('.ask-in')).toBeVisible();
  await expect(undo(page)).toHaveCount(0);
  await page.clock.runFor(6000);
  await ask(page).locator('.ask-in').fill('290');
  await ask(page).getByRole('button',{name:'Ajustar la deuda'}).click();
  await expect(undo(page)).toBeVisible();
  await page.clock.runFor(1000);
  const removed=await saved(page);expect(removed.fixed).toEqual([]);expect(removed.debts[0].amort).toBe(290);
  await undo(page).click();await expect(page.locator('[data-bills-manage] [data-bill-id="undo-bill"]')).toBeVisible();await page.clock.runFor(500);
  expect(await saved(page)).toEqual({fixed:[bill],debts:[debt]});
  await page.reload();await page.waitForFunction(()=>!document.getElementById('mc-load'));
  expect(await saved(page)).toEqual({fixed:[bill],debts:[debt]});
});

test('R167 Deshacer todo o nada mantiene recibo quitado y ambas deudas si una cambia',async({page})=>{
  const other={...debt,id:'other',name:'Otra deuda sintética',monthly:190,amort:210};
  const shared={...bill,amount:20,reparto:[...bill.reparto,{id:'other-person',n:'Otra persona',via:'debt',debtId:'other',amt:20}]};
  await open(page,{debts:[debt,other],fixed:[shared]});
  await ask(page).getByRole('button',{name:'Ajustar la deuda'}).click();await expect(undo(page)).toBeVisible();
  const changed=await page.evaluate(()=>{
    const el=document.querySelector('[data-bills-manage]');let f=el[Object.keys(el).find(k=>k.startsWith('__reactFiber$'))];
    while(f&&!(f.memoizedProps?.state&&f.memoizedProps?.set))f=f.return;
    if(!f)throw Error('Falta set real');let copy;
    ReactDOM.flushSync(()=>f.memoizedProps.set(s=>({...s,debts:s.debts.map(d=>d.id==='undo-debt'?(copy={...d,monthly:271,note:'Edición posterior'}):d)})));
    return copy;
  });
  await page.clock.runFor(500);const before=await saved(page);expect(before.fixed).toEqual([]);expect(before.debts[0]).toEqual(changed);
  await undo(page).click();await page.clock.runFor(500);
  expect(await saved(page)).toEqual(before);
  await expect(page.locator('[data-bills-manage] [data-bill-id="undo-bill"]')).toHaveCount(0);
  await expect(page.getByTestId('bills-saved')).toHaveText('No se ha deshecho nada porque hay cambios posteriores.');
  await expect(page.getByTestId('bills-saved')).toHaveCount(1);
});

test('Deshacer caduca a los cinco segundos y un doble toque no duplica el recibo',async({page})=>{
  await open(page);await ask(page).getByRole('button',{name:'Ajustar la deuda'}).click();await expect(undo(page)).toBeVisible();
  await undo(page).evaluate(el=>{el.click();el.click();});await expect(page.locator('[data-bills-manage] [data-bill-id="undo-bill"]')).toBeVisible();await page.clock.runFor(500);
  expect(await saved(page)).toEqual({fixed:[bill],debts:[debt]});
  await page.locator('[data-bill-id="undo-bill"]').click();
  const remove=page.locator('.v4-sheet[data-sheet="recibo-pasos"] [data-act="bill-remove"]');await remove.click();await remove.click();
  await ask(page).getByRole('button',{name:'Ajustar la deuda'}).click();await expect(undo(page)).toBeVisible();
  await page.clock.runFor(5001);await expect(undo(page)).toHaveCount(0);expect((await saved(page)).fixed).toEqual([]);
});

test('Deshacer del único recibo conserva el controlador al pasar por Plan vacío',async({page})=>{
  const only={...bill};delete only.reparto;delete only.bankAmount;
  await open(page,{fixed:[only],debts:[]});await expect(undo(page)).toBeVisible();
  await expect(page.getByTestId('plan-onb')).toHaveCount(1);
  await undo(page).click();await expect(page.locator('[data-bills-manage] [data-bill-id="undo-bill"]')).toBeVisible();await page.clock.runFor(500);expect(await saved(page)).toEqual({fixed:[only],debts:[]});
  await expect(page.getByTestId('plan-onb')).toHaveCount(0);
});

test('Deshacer no revive al cerrar Gestionar con una pregunta pendiente',async({page})=>{
  await open(page);await expect(ask(page).locator('.ask-in')).toBeVisible();
  await page.evaluate(()=>{
    const el=document.querySelector('[data-bills-manage]');let f=el[Object.keys(el).find(k=>k.startsWith('__reactFiber$'))];
    while(f&&!(f.memoizedProps?.state&&f.memoizedProps?.onClose))f=f.return;
    if(!f)throw Error('Falta cierre real');f.memoizedProps.onClose();
  });
  await expect(page.locator('[data-bills-manage]')).toHaveCount(0);
  await ask(page).getByRole('button',{name:'Ajustar la deuda'}).click();await page.clock.runFor(6000);
  expect(await saved(page)).toEqual({fixed:[bill],debts:[debt]});await expect(undo(page)).toHaveCount(0);
});

test('R167 Quitar rechaza respuestas obsoletas con aviso propio',async({page})=>{
  await open(page);await expect(ask(page).locator('.ask-in')).toBeVisible();
  await page.evaluate(()=>{
    const el=document.querySelector('[data-bills-manage]');let f=el[Object.keys(el).find(k=>k.startsWith('__reactFiber$'))];
    while(f&&!(f.memoizedProps?.state&&f.memoizedProps?.set))f=f.return;
    if(!f)throw Error('Falta set real');f.memoizedProps.set(s=>({...s,debts:s.debts.map(d=>({...d,note:'Llegó otro cambio'}))}));
  });
  await ask(page).getByRole('button',{name:'Ajustar la deuda'}).click();await page.clock.runFor(500);
  expect(await saved(page)).toEqual({fixed:[bill],debts:[{...debt,note:'Llegó otro cambio'}]});await expect(undo(page)).toHaveCount(0);
  await expect(page.getByTestId('bills-saved')).toHaveText('No se ha podido quitar el recibo. Revisa los cambios e inténtalo de nuevo.');
  await expect(page.getByTestId('bills-saved')).toHaveCount(1);
});

test('R167 Deshacer vigila la deuda aunque se cancele su ajuste',async({page})=>{
  await open(page);await ask(page).getByRole('button',{name:'Dejarla como está'}).click();await expect(undo(page)).toBeVisible();
  await page.evaluate(()=>{
    const el=document.querySelector('[data-bills-manage]');let f=el[Object.keys(el).find(k=>k.startsWith('__reactFiber$'))];
    while(f&&!(f.memoizedProps?.state&&f.memoizedProps?.set))f=f.return;
    if(!f)throw Error('Falta set real');ReactDOM.flushSync(()=>f.memoizedProps.set(s=>({...s,debts:s.debts.map(d=>({...d,extra:{nested:['Cambio posterior']}}))})));
  });
  await page.clock.runFor(500);const before=await saved(page);expect(before.fixed).toEqual([]);expect(before.debts[0].monthly).toBe(debt.monthly);
  await undo(page).click();await page.clock.runFor(500);expect(await saved(page)).toEqual(before);
  await expect(page.getByTestId('bills-saved')).toHaveText('No se ha deshecho nada porque hay cambios posteriores.');await expect(page.getByTestId('bills-saved')).toHaveCount(1);
  await page.reload();await page.waitForFunction(()=>!document.getElementById('mc-load'));expect(await saved(page)).toEqual(before);
});

test('R167 Deshacer rechaza la deuda que aparece tras quitar un vínculo huérfano',async({page})=>{
  await open(page,{debts:[]});await expect(undo(page)).toBeVisible();
  await page.evaluate(newDebt=>{
    const el=document.querySelector('[data-bills-manage]');let f=el[Object.keys(el).find(k=>k.startsWith('__reactFiber$'))];
    while(f&&!(f.memoizedProps?.state&&f.memoizedProps?.set))f=f.return;
    if(!f)throw Error('Falta set real');ReactDOM.flushSync(()=>f.memoizedProps.set(s=>({...s,debts:[newDebt]})));
  },debt);
  await page.clock.runFor(500);const before=await saved(page);expect(before).toEqual({fixed:[],debts:[debt]});
  await undo(page).click();await page.clock.runFor(500);expect(await saved(page)).toEqual(before);
  await expect(page.getByTestId('bills-saved')).toHaveText('No se ha deshecho nada porque hay cambios posteriores.');await expect(page.getByTestId('bills-saved')).toHaveCount(1);
});

test('Deshacer no escribe al desmontar Plan durante una pregunta',async({page})=>{
  await open(page);await expect(ask(page).locator('.ask-in')).toBeVisible();
  await page.evaluate(()=>{
    const el=document.querySelector('[data-bills-manage]');window.__undoOldManage=el;let f=el[Object.keys(el).find(k=>k.startsWith('__reactFiber$'))];
    while(f&&!(f.memoizedProps?.state&&f.memoizedProps?.set))f=f.return;
    if(!f)throw Error('Falta set real');f.memoizedProps.set(s=>({...s,settings:{...s.settings,simpleMode:true}}));
  });
  await page.waitForFunction(()=>!window.__undoOldManage.isConnected);
  await ask(page).getByRole('button',{name:'Ajustar la deuda'}).click();await page.clock.runFor(6000);
  expect(await saved(page)).toEqual({fixed:[bill],debts:[debt]});await expect(undo(page)).toHaveCount(0);
});

test('Deshacer no confirma una retirada que React rebasa sobre una transición anterior',async({page})=>{
  await open(page,{},true);await expect(ask(page).locator('.ask-in')).toBeVisible();
  await page.evaluate(()=>{
    window.__undoCommits=[];const persist=mcPersistCommit;
    mcPersistCommit=function(p,prev,next,schedule){window.__undoCommits.push({fixed:next.fixed.map(x=>x.id),debts:next.debts});return persist(p,prev,next,schedule);};
    const el=document.querySelector('[data-bills-manage]');let f=el[Object.keys(el).find(k=>k.startsWith('__reactFiber$'))];
    while(f&&!(f.memoizedProps?.state&&f.memoizedProps?.set))f=f.return;
    if(!f)throw Error('Falta set real');React.startTransition(()=>f.memoizedProps.set(s=>({...s,debts:s.debts.map(d=>({...d,note:'Transición anterior'}))})));
    document.querySelector('.askback .btn-primary').click();
  });
  // La transición necesita turnos reales del scheduler; avanzar timers no acredita su commit.
  await new Promise(resolve=>setTimeout(resolve,1000));
  expect(await saved(page)).toEqual({fixed:[bill],debts:[{...debt,note:'Transición anterior'}]});await expect(undo(page)).toHaveCount(0);
  const commits=await page.evaluate(()=>window.__undoCommits);expect(commits.length).toBeGreaterThan(0);
  expect(commits.every(x=>x.fixed.length===1&&x.fixed[0]==='undo-bill')).toBe(true);
});


test('Deshacer cancela la escritura encolada cuando Gestionar cierra antes del commit',async({page})=>{
  await open(page,{},true);await expect(ask(page).locator('.ask-in')).toBeVisible();
  await page.evaluate(async()=>{
    const el=document.querySelector('[data-bills-manage]');let f=el[Object.keys(el).find(k=>k.startsWith('__reactFiber$'))];
    while(f&&!(f.memoizedProps?.state&&f.memoizedProps?.onClose))f=f.return;
    if(!f)throw Error('Falta cierre real');
    document.querySelector('.askback .btn-primary').click();
    // Se resuelven las promesas de preguntas sin ceder al scheduler: ya hay transición encolada.
    for(let i=0;i<10;i++)await Promise.resolve();
    ReactDOM.flushSync(()=>f.memoizedProps.onClose());
  });
  await expect(page.locator('[data-bills-manage]')).toHaveCount(0);
  await new Promise(resolve=>setTimeout(resolve,1000));
  expect(await saved(page)).toEqual({fixed:[bill],debts:[debt]});await expect(undo(page)).toHaveCount(0);
});
