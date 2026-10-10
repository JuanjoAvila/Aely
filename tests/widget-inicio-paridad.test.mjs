#!/usr/bin/env node
// La cifra se compara con los lectores de Inicio, no con otra copia del helper del servidor.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {transformSync} from 'esbuild';
import {loadPureLogicFromFile} from '../scripts/load-pure-logic.mjs';

process.env.TZ='Europe/Madrid';
const sourceArg=process.argv.find(x=>x.startsWith('--server-sha=')),serverSHA=sourceArg&&sourceArg.slice(13);
if(serverSHA)assert.match(serverSHA,/^[a-f0-9]{7,40}$/);
function load(file,imports={}){
  const mod={exports:{}};
  const raw=serverSHA&&file==='supabase/functions/ingest/widget.ts'
    ?execFileSync('git',['show',serverSHA+':'+file],{encoding:'utf8'}):fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
  const src=raw.replace(/^import\s[\s\S]*?from\s+"[^"]+";\r?\n/gm,'');
  new Function('module','exports',...Object.keys(imports),transformSync(src,{loader:'ts',format:'cjs'}).code)(mod,mod.exports,...Object.values(imports));
  return mod.exports;
}
const serverBudget=load('supabase/functions/_shared/presupuesto.ts');
const server=load('supabase/functions/ingest/widget.ts',serverBudget);
const cli=loadPureLogicFromFile(),now=Date.parse('2026-10-10T12:00:00Z'),RealDate=cli.Date;
cli.Date=class extends RealDate{static now(){return now;}};
const cents=n=>Math.round(n*100)/100;
const cases=[
  ['compra',5.45,'super','macrodroid'],
  ['bizum-grande',-300,'bizum','ob:sabadell'],
  ['nomina',-1200,'ingreso','macrodroid'],
  ['inversion',5.45,'inversion','macrodroid'],
  ['traspaso',-300,'traspaso','macrodroid'],
  ['deudas',5.45,'deudas','ob:trade_republic~deuda.synthetic'],
  ['cuota-con-otra-cat',5.45,'super','ob:trade_republic~deuda.synthetic'],
  ['abono-cuota',-5.45,'ingreso','ob:trade_republic~deuda.synthetic'],
  ['posible-duplicado',5.45,'super','ob:trade_republic#dup'],
  ['lapida',5.45,'super','macrodroid'],
  ['duplicado-fusionado',5.45,'super','macrodroid'],
];
let checked=0,failed=0;
try{
for(const cycle of [false,true])for(const budgetCase of ['ausente','cero','positivo','todo-reservado'])
for(const bank of ['trade_republic','sabadell'])for(const anchorCase of ['actual','mes-anterior','sin-cobro'])for(const [name,amount,cat,source] of cases)
for(const window of ['actual','futuro','anterior']){
  const label=[cycle?'ciclo':'mes',budgetCase,bank,anchorCase,name,window].join('/');
  try{
    const fecha=window==='actual'?'2026-10-10T10:00:00Z':window==='futuro'?'2026-10-11T10:00:00Z':'2026-09-20T10:00:00Z';
    const payment={id:'payment',fecha,importe:amount,cat,source,comercio:name==='nomina'?'NOMINA SINTETICA':'Compra sintetica '+name};
    const rows=[{id:'salary',fecha:anchorCase==='mes-anterior'?'2026-09-27T10:00:00Z':'2026-10-05T10:00:00Z',importe:-1000,cat:'ingreso',source:'ob:sabadell',comercio:'NOMINA SINTETICA ANTERIOR'},
      {id:'buy',fecha:'2026-10-06T10:00:00Z',importe:30,cat:'super',source:'macrodroid',comercio:'Compra anterior'},
      {id:'return',fecha:'2026-10-09T10:00:00Z',importe:-20,cat:'bizum',source:'ob:sabadell',comercio:'Abono sintetico'},payment];
    if(anchorCase==='sin-cobro')rows.shift();
    if(name==='duplicado-fusionado')rows.push({...payment,id:'duplicate'});
    const state={settings:{budgetCycle:cycle,expenseBanks:['trade_republic'],widgetBank:bank,gTotalMode:'net'},
      accounts:[{ent:'trade_republic',role:'diario',spendFrom:true},{ent:'sabadell',role:'fijos'}],
      expenses:cli.mergeExpenses([],rows.map(cli.expenseFromRow)).list,deleted:[],
      reservaLog:budgetCase==='todo-reservado'?[{id:'synthetic-reserve',date:'2026-10-10T09:00:00Z',amount:100}]:[]};
    if(budgetCase!=='ausente')state.budget=budgetCase==='cero'?0:100;
    if(name==='lapida')state.deleted=[cli.keyOfExpense(cli.expenseFromRow(payment))];
    const stats=cli.dashboardBudgetStats(state),period=cli.budgetPeriodOf(state);
    const anchor=stats.cycle?cli.keyOfExpense(period.cycle.inc):'';
    const scope=cli.widgetScopeOf(state,stats,anchor,bank);
    state.widgetPeriod={v:2,kind:stats.cycle?'ciclo':'mes',start:stats.periodStart,anchor,scope};
    const w=server.widgetSnapshot(state,rows,now,{id:'payment',event:'synthetic',key:'synthetic-key'});
    const e=state.expenses.find(e=>e.id==='payment'),ms=Date.parse(fecha);
    const visible=e&&!cli.expenseIsTombstoned(e,cli.expenseDeletedSet(state))&&ms>=period.startMs&&ms<period.todayEndMs;
    if(!visible){assert.equal(w,null,'pago fuera de ventana o retirado no acredita absoluto');checked++;continue;}
    assert.ok(w,'un pago conocido de la misma ventana conserva cifra');
    const before=cli.monthBudgetStats({...state,expenses:state.expenses.filter(e=>e.id!=='payment')},null,null,'split',period);
    assert.equal(w.scope,scope);assert.equal(w.periodKind,state.widgetPeriod.kind);
    assert.equal(w.spent,cents(stats.cycle?stats.against:stats.shown));
    assert.equal(w.against,cents(stats.against));assert.equal(w.budget,stats.budget==null?0:stats.budget);
    assert.equal(w.budgetLeft,stats.remaining==null?-1:cents(Math.max(0,stats.remaining)));
    assert.equal(w.shownDelta,cents((stats.cycle?stats.against:stats.shown)-(stats.cycle?before.against:before.shown)));
    assert.equal(w.againstDelta,cents(stats.against-before.against));checked++;
  }catch(err){failed++;console.error('FAIL '+label+': '+err.message);}
}
}finally{cli.Date=RealDate;}
console.log('widget-inicio-paridad: '+checked+' casos correctos; '+failed+' fallos');
if(failed)process.exitCode=1;
