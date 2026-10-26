#!/usr/bin/env node
// La cifra se compara con los lectores de Inicio, no con otra copia del helper del servidor.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {transformSync} from 'esbuild';
import {loadPureLogic,loadPureLogicFromFile} from '../scripts/load-pure-logic.mjs';

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
  // Mes natural (26/10/2026): un ingreso grande sin nombre de nómina SÍ devuelve margen, y una
  // devolución de compra resta una sola vez.
  ['ingreso-grande',-300,'ingreso','macrodroid'],
  ['devolucion',-5.45,'super','macrodroid'],
  ['inversion',5.45,'inversion','macrodroid'],
  ['traspaso',-300,'traspaso','macrodroid'],
  ['deudas',5.45,'deudas','ob:trade_republic~deuda.synthetic'],
  ['cuota-con-otra-cat',5.45,'super','ob:trade_republic~deuda.synthetic'],
  ['abono-cuota',-5.45,'ingreso','ob:trade_republic~deuda.synthetic'],
  ['posible-duplicado',5.45,'super','ob:trade_republic#dup'],
  ['lapida',5.45,'super','macrodroid'],
  ['duplicado-fusionado',5.45,'super','macrodroid'],
  // Recibo del Plan y aportación a meta (R6 de la revisión, 26/10/2026): fuera en los dos lados.
  ['meta',5.45,'super','ob:trade_republic~meta.g1'],
  ['meta-ingreso',-5.45,'ingreso','ob:trade_republic~meta.g1'],
  ['recibo',5.45,'recibos','ob:trade_republic~recibo.r1'],
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
      fixed:[{id:'r1',name:'Recibo sintetico',amount:5.45,day:10,account:'trade_republic'}],
      reservaLog:budgetCase==='todo-reservado'?[{id:'synthetic-reserve',date:'2026-10-10T09:00:00Z',amount:100}]:[]};
    if(budgetCase!=='ausente')state.budget=budgetCase==='cero'?0:100;
    if(name==='lapida')state.deleted=[cli.keyOfExpense(cli.expenseFromRow(payment))];
    const stats=cli.dashboardBudgetStats(state),period=cli.budgetPeriodOf(state);
    const anchor=stats.cycle?cli.keyOfExpense(period.cycle.inc):'';
    const scope=cli.widgetScopeOf(state,stats,anchor,bank);
    state.widgetPeriod=cli.widgetPeriodOf(stats,anchor,scope);
    const w=server.widgetSnapshot(state,rows,now,{id:'payment',event:'synthetic',key:'synthetic-key'});
    const e=state.expenses.find(e=>e.id==='payment'),ms=Date.parse(fecha);
    const visible=e&&!cli.expenseIsTombstoned(e,cli.expenseDeletedSet(state))&&ms>=period.startMs&&ms<period.todayEndMs;
    if(!visible){assert.equal(w,null,'pago fuera de ventana o retirado no acredita absoluto');checked++;continue;}
    // En el ciclo un cobro grande posterior al ancla puede ser la nómina nueva: ingest no lo adivina.
    if(stats.cycle&&name==='ingreso-grande'){assert.equal(w,null,'ciclo: posible ancla nueva sin foto');checked++;continue;}
    assert.ok(w,'un pago conocido de la misma ventana conserva cifra');
    const before=cli.monthBudgetStats({...state,expenses:state.expenses.filter(e=>e.id!=='payment')},null,null,'mes',period);
    assert.equal(w.scope,scope);assert.equal(w.periodKind,state.widgetPeriod.kind);
    // El widget pinta lo que Inicio compara con el límite: neto en el ciclo, sin nómina en el mes.
    assert.equal(w.spent,cents(stats.against));
    assert.equal(w.against,cents(stats.against));assert.equal(w.budget,stats.budget==null?0:stats.budget);
    assert.equal(w.budgetLeft,stats.remaining==null?-1:cents(Math.max(0,stats.remaining)));
    assert.equal(w.shownDelta,cents(stats.against-before.against));
    assert.equal(w.againstDelta,cents(stats.against-before.against));checked++;
  }catch(err){failed++;console.error('FAIL '+label+': '+err.message);}
}
}finally{cli.Date=RealDate;}
/* SU MES DE HOY POR EL SERVIDOR (decisión del dueño, 26/10/2026). Mes natural: 1.922,19 € de gasto,
   485,72 € recibidos, límite 1.500 € → el widget dice lo que Inicio, 63,53 € por debajo. El 30/10
   entra la nómina con la app cerrada: si el comercio dice «nómina», ingest la aparta y la cifra no
   se mueve; si no lo dice (empresa en el comercio), no se adivina y no hay foto. Importes sintéticos. */
{
  const at=Date.parse('2026-10-30T12:00:00Z');
  cli.Date=class extends RealDate{static now(){return at;}};
  try{
    const oct=[
      {id:'g1',fecha:'2026-10-03T10:00:00Z',importe:1200,cat:'super',source:'macrodroid',comercio:'Compra sintetica'},
      {id:'g2',fecha:'2026-10-10T10:00:00Z',importe:722.19,cat:'ocio',source:'macrodroid',comercio:'Ocio sintetico'},
      {id:'i1',fecha:'2026-10-12T10:00:00Z',importe:-400,cat:'bizum',source:'macrodroid',comercio:'Bizum cena'},
      {id:'i2',fecha:'2026-10-15T10:00:00Z',importe:-85.72,cat:'ingreso',source:'macrodroid',comercio:'Devolucion tienda'},
      {id:'t1',fecha:'2026-10-14T10:00:00Z',importe:300,cat:'traspaso',source:'macrodroid',comercio:'Traspaso sintetico'},
    ];
    const base={budget:1500,settings:{budgetCycle:false,expenseBanks:['trade_republic'],widgetBank:'trade_republic',gTotalMode:'net'},
      accounts:[{ent:'trade_republic',role:'diario',spendFrom:true}],deleted:[],reservaLog:[]};
    // La app abierta antes de la nómina deja su ventana en la nube.
    const app={...base,expenses:cli.mergeExpenses([],oct.map(cli.expenseFromRow)).list};
    const stats=cli.dashboardBudgetStats(app), scope=cli.widgetScopeOf(app,stats,'','trade_republic');
    assert.equal(Math.round(stats.remaining*100),6353);
    const cloud={...base,widgetPeriod:cli.widgetPeriodOf(stats,'',scope)};
    // Un café con la app cerrada: el servidor llega a la misma cifra por su cuenta.
    const cafe={id:'cafe',fecha:'2026-10-30T09:00:00Z',importe:2,cat:'super',source:'macrodroid',comercio:'Cafe sintetico'};
    const w1=server.widgetSnapshot(cloud,[...oct,cafe],at,{id:'cafe',event:'e1',key:'k1'});
    assert.ok(w1,'mes natural con ventana de la app: hay foto');
    assert.equal(w1.spent,1438.47); assert.equal(w1.against,1438.47); assert.equal(w1.budgetLeft,61.53);
    const conCafe=cli.dashboardBudgetStats({...base,expenses:cli.mergeExpenses([],[...oct,cafe].map(cli.expenseFromRow)).list});
    assert.equal(w1.against,cents(conCafe.against),'misma cifra que Inicio');
    // Nómina con la palabra en el comercio y la app cerrada: fuera, no mueve nada.
    const nomina={id:'nom',fecha:'2026-10-30T08:00:00Z',importe:-3333,cat:'ingreso',source:'macrodroid',comercio:'NÓMINA EMPRESA SINTETICA'};
    const w2=server.widgetSnapshot(cloud,[...oct,nomina],at,{id:'nom',event:'e2',key:'k2'});
    assert.ok(w2); assert.equal(w2.spent,1436.47); assert.equal(w2.budgetLeft,63.53); assert.equal(w2.shownDelta,0);
    const conNomina=cli.dashboardBudgetStats({...base,expenses:cli.mergeExpenses([],[...oct,nomina].map(cli.expenseFromRow)).list});
    assert.equal(w2.against,cents(conNomina.against),'la app aparta la misma nómina');
    // Solo la empresa en el comercio: ingest no sabe si es nómina; no hay foto (la app decide al abrir).
    assert.equal(server.widgetSnapshot(cloud,[...oct,{...nomina,comercio:'EMPRESA SINTETICA SL'}],at,{id:'nom',event:'e3',key:'k3'}),null);
    // La web anterior (beta 4.26.183, la de la familia mientras no se promocione): su ventana sin
    // listas recibe SU cifra, el bruto que pinta su Inicio (R1 de la revisión, 26/10/2026).
    const vieja=loadPureLogic(execFileSync('git',['show','9627c867b:public/index.html'],{encoding:'utf8',maxBuffer:64<<20}));
    vieja.Date=class extends RealDate{static now(){return at;}};
    const appVieja={...base,expenses:vieja.mergeExpenses([],oct.map(vieja.expenseFromRow)).list};
    const sv=vieja.dashboardBudgetStats(appVieja), scopeViejo=vieja.widgetScopeOf(appVieja,sv,'','trade_republic');
    assert.equal(JSON.parse(scopeViejo).length,8,'la web anterior escribe el alcance de 8');
    const w4=server.widgetSnapshot({...base,widgetPeriod:{v:2,kind:'mes',start:sv.periodStart,anchor:'',scope:scopeViejo}},[...oct,cafe],at,{id:'cafe',event:'e4',key:'k4'});
    assert.ok(w4,'la web anterior conserva su foto con ingest nuevo');
    const svCafe=vieja.dashboardBudgetStats({...base,expenses:vieja.mergeExpenses([],[...oct,cafe].map(vieja.expenseFromRow)).list});
    assert.equal(w4.spent,cents(svCafe.shown)); assert.equal(w4.spent,1924.19);
    assert.equal(w4.budgetLeft,cents(Math.max(0,svCafe.remaining)));
    // Listas en la ventana pero alcance de 8 (ninguna web lo escribe): sin foto.
    assert.equal(server.widgetSnapshot({...cloud,widgetPeriod:{...cloud.widgetPeriod,scope:JSON.stringify(JSON.parse(scope).slice(0,8))}},[...oct,cafe],at,{id:'cafe',event:'e5',key:'k5'}),null);
    checked+=6;
  }catch(err){failed++;console.error('FAIL su mes de hoy: '+err.message);}
  finally{cli.Date=RealDate;}
}
console.log('widget-inicio-paridad: '+checked+' casos correctos; '+failed+' fallos');
if(failed)process.exitCode=1;
