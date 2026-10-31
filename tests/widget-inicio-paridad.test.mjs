#!/usr/bin/env node
// La cifra se compara con los lectores de Inicio, no con otra copia del helper del servidor.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
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
const pauseOnly=process.argv.includes('--widget-pause-only');
if(!pauseOnly){
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
    // Listas en la ventana pero alcance sin ellas (ninguna web lo escribe), o con ellas de noveno
    // elemento (la web 4.26.184/185, que el nativo descartaba): sin foto. El bueno tiene 8.
    const partes=JSON.parse(scope);
    assert.equal(partes.length,8,'el alcance que viaja tiene los 8 elementos que exige el nativo');
    for(const malo of [[...partes.slice(0,4),'',...partes.slice(5)],[...partes.slice(0,4),'',...partes.slice(5),partes[4]]])
      assert.equal(server.widgetSnapshot({...cloud,widgetPeriod:{...cloud.widgetPeriod,scope:JSON.stringify(malo)}},[...oct,cafe],at,{id:'cafe',event:'e5',key:'k5'}),null);
    checked+=6;
  }catch(err){failed++;console.error('FAIL su mes de hoy: '+err.message);}
  finally{cli.Date=RealDate;}
}
}
/* La pausa vive en la liquidez que manda la app, no en widgetSnapshot. Ejecutar los lectores
   y el escritor reales evita inventar una tercera simulación de recibos en ingest (31/10/2026). */
{
  const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
  const order=JSON.parse(read('src/build-order.json'));
  const modules=Object.fromEntries(order.map(file=>[file,read('src/modules/'+file).replaceAll('\r\n','\n')]));
  function route(change){
    const sources={...modules};
    if(change){
      assert.ok(sources[change.file].includes(change.from),'el mutante encuentra su punto real');
      sources[change.file]=sources[change.file].replace(change.from,change.to);
    }
    const c=loadPureLogic(read('src/shell.html').replace('<!--MC_APP_SCRIPT-->',()=>order.map(file=>sources[file]).join('\n')));
    const main=sources['11-app-main.js'],a=main.indexOf('const totals=useMemo(()=>{'),b=main.indexOf('\n\n  const budgetMonth=',a);
    const start=main.indexOf('const budW=wV2?'),end=main.indexOf('  // Tour de bienvenida:',start);
    assert.ok(a>=0&&b>a&&start>=0&&end>start,'bloques reales de totals y envío nativo');
    const totals=vm.runInNewContext('(function(state,calendarDay){'+main.slice(a,b)+';return totals;})',c);
    const send=vm.runInNewContext('(function(state,totals,wV2,useEffect,natPlugin,cloud,uid,wR,wC,wRead,CURLANG,calendarDay,setCalendarDay,set,document){const lecturaNube=0;'+main.slice(start,end)+'})',c);
    return {c,totals,send};
  }
  function exercise(r){
    let n=0;
    for(const date of ['2026-10-31','2026-11-01','2026-12-31','2027-01-01'])
    for(const kind of ['paused','before-start','resumed','paid-paused','budget-cap']){
      const at=Date.parse(date+'T12:00:00Z'),y=Number(date.slice(0,4)),m=Number(date.slice(5,7)),day=Number(date.slice(8)),ym=y*12+m;
      const c=r.c;
      c.Date=class extends Date{constructor(...args){super(...(args.length?args:[at]));}static now(){return at;}};
      const paused=kind==='paused'||kind==='paid-paused'||kind==='budget-cap',paid=kind==='paid-paused';
      const fixed={id:'r1',name:'Recibo sintetico',freq:'mes',amount:25.45,day:28,account:'trade_republic',wait:ym,
        pausedFrom:kind==='before-start'?ym+1:ym-1,pausedUntil:kind==='resumed'?ym:ym+1};
      const rows=[{id:'payment',fecha:date+'T09:00:00Z',importe:5.45,cat:'super',source:'macrodroid',comercio:'Cafe sintetico'}];
      if(paid)rows.push({id:'receipt',fecha:date+'T08:00:00Z',importe:25.45,cat:'recibos',source:'ob:trade_republic~recibo.r1#refsynthetic',comercio:'Cargo bancario sintetico'});
      let state={budget:kind==='budget-cap'?100:2000,settings:{budgetCycle:false,expenseBanks:['trade_republic'],widgetBank:'trade_republic'},
        accounts:[{id:'tr',ent:'trade_republic',role:'fijos',value:500},{id:'other',ent:'sabadell',role:'fijos',value:99}],
        fixed:[fixed],expenses:c.mergeExpenses([],rows.map(c.expenseFromRow)).list,bankTx:[],debts:[],oneoffs:[],flows:[],deleted:[],
        investments:[],assets:[],aportaciones:[],obAccounts:[],reservaLog:[]};
      if(paid){
        state=c.linkFixedPayment(state,'receipt','r1',y,m,day);
        assert.ok(c.fixedPaymentProof(state,state.fixed[0],y,m,day),'pago con prueba bancaria vigente');
      }
      const before=JSON.stringify(state),t=r.totals(state,date),calls=[],cleanups=[];
      let cloudState=state;
      r.send(state,t,62,fn=>{const cleanup=fn();if(typeof cleanup==='function')cleanups.push(cleanup);},
        ()=>({updateWidget:data=>{calls.push(data);return Promise.resolve();}}),{enabled:()=>false},null,
        {current:false},{current:[]},{current:null},'es',date,()=>{},fn=>{cloudState=fn(cloudState);},
        {addEventListener(){},removeEventListener(){}});
      cleanups.forEach(fn=>fn());
      assert.equal(calls.length,1,'el escritor real llama al puente nativo');
      const data=calls[0],label=date+'/'+kind;
      // Saldo de partida sintético 500: el pagado ya resta del saldo; el pendiente del mínimo.
      const safe=paused&&!paid?500:474.55,cash=paid?474.55:500;
      assert.equal(data.cash,cash,label+' saldo real');
      assert.equal(t.fijosEsteMes,paused&&!paid?0:25.45,label+' pausa conserva el pago en totals');
      assert.equal(data.safeLiq,safe,label+' pausa/pago/reanudación llega al nativo');
      assert.equal(data.afford,kind==='budget-cap'?94.55:safe,label+' mínimo de presupuesto y liquidez');
      assert.equal(data.contract,2);assert.equal(data.cashEnt,'trade_republic');
      assert.equal(data.spent,5.45);assert.equal(data.budgetLeft,state.budget-5.45);
      assert.equal(JSON.stringify(state),before,'totals y envío no mutan la cartera');
      const w=server.widgetSnapshot(cloudState,rows,at,{id:'payment',event:'synthetic',key:'synthetic-key'});
      assert.ok(w,label+' ingest reconoce la ventana que dejó el escritor');
      assert.equal(w.spent,data.spent);assert.equal(w.budgetLeft,data.budgetLeft);assert.equal(w.scope,data.scope);
      assert.equal(Object.hasOwn(w,'safeLiq'),false,'ingest no inventa liquidez ni duplica el motor de recibos');
      n++;
    }
    return n;
  }
  const mutants=[
    {name:'recorrido sin pausa',file:'08-motor-bank.js',from:'||fixedPausedIn(e,y,m)) return;',to:') return;'},
    {name:'saldo sin pausa',file:'08-motor-bank.js',from:'return fixedPausedIn(e,y,m)&&!fixedPaymentState(s,e,y,m,today).paid;',to:'return false;'},
    {name:'pausa oculta pago',file:'08-motor-bank.js',from:'return fixedPausedIn(e,y,m)&&!fixedPaymentState(s,e,y,m,today).paid;',to:'return fixedPausedIn(e,y,m);'},
    {name:'reanudación inclusiva',file:'07-tab-patri-fijos.js',from:'&&ym<u;',to:'&&ym<=u;'},
    {name:'envío usa saldo en vez de mínimo',file:'11-app-main.js',from:'data.safeLiq=widgetSafeLiq;',to:'data.safeLiq=widgetCash;'},
    {name:'envío omite liquidez',file:'11-app-main.js',from:'if(widgetSafeLiq!=null) data.safeLiq=widgetSafeLiq;',to:'if(false) data.safeLiq=widgetSafeLiq;'},
    {name:'afford omite mínimo',file:'11-app-main.js',from:'Math.min(widgetBudgetLeft, widgetSafeLiq)',to:'widgetBudgetLeft'},
  ];
  const count=exercise(route());
  for(const mutant of mutants){
    const mutated=route(mutant);
    assert.throws(()=>exercise(mutated),err=>err instanceof assert.AssertionError&&/^(2026|2027)-\d\d-\d\d\//.test(err.message),mutant.name+' debe romper una cifra del recorrido');
    console.log('widget-pausa mutante detectado: '+mutant.name);
  }
  checked+=count;
  console.log('widget-pausa: '+count+' recorridos app→totals→updateWidget/ingest; '+mutants.length+' mutantes detectados');
}
console.log('widget-inicio-paridad: '+checked+' casos correctos; '+failed+' fallos');
if(failed)process.exitCode=1;
