import assert from 'node:assert/strict';
import fs from 'node:fs';
import {transformSync} from 'esbuild';
import {loadPureLogic,loadPureLogicFromFile} from '../scripts/load-pure-logic.mjs';

const only=process.argv.find(x=>x.startsWith('--case='))?.slice(7);
const mutant=process.argv.find(x=>x.startsWith('--mutant='))?.slice(9);
let html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
if(mutant==='client-window'){
 const original='todayEndMs:payday?tomorrow.getTime():inicioDeMesMs(monthStart+35*864e5)';
 assert.ok(html.includes(original),'mutante exige la fuente final exacta');html=html.replace(original,'todayEndMs:payday?tomorrow.getTime():Infinity');
}
const cli=mutant==='client-window'?loadPureLogic(html):loadPureLogicFromFile(),NativeDate=cli.Date;
let now=Date.parse('2026-10-10T12:00:00Z');
cli.Date=class extends NativeDate{constructor(...a){super(...(a.length?a:[now]));}static now(){return now;}};
const cents=n=>Math.round(n*100);
const boundaries=[
  ['otoño','2026-10-10T12:00:00Z','2026-09-30T22:00:00Z','2026-10-31T23:00:00Z'],
  ['año','2026-12-10T12:00:00Z','2026-11-30T23:00:00Z','2026-12-31T23:00:00Z'],
  ['primavera','2027-03-10T12:00:00Z','2027-02-28T23:00:00Z','2027-03-31T22:00:00Z'],
];
function fixture(start,end){
  const row=(id,date,amount)=>({id,date:new Date(date).toISOString(),amount,category:amount<0?'ingreso':'super',ent:'sabadell',merchant:'Sintético '+id,source:'ob:sabadell'});
  return {budget:100,settings:{budgetCycle:false,gTotalMode:'split',expenseBanks:['sabadell'],widgetBank:'sabadell'},accounts:[{id:'daily',ent:'sabadell',role:'diario',spendFrom:true}],deleted:[],
    expenses:[row('previous',start-1,99.91),row('payment',start,17.43),row('same-month',end-1,8.11),row('income',start+1000,-4.29),row('same-month-income',end-2,-1.06),row('next-month',end,27.19),row('next-month-income',end+1000,-13.07)],
    reservaLog:[{id:'current',date:new Date(start+2000).toISOString(),amount:3.17},{id:'next',date:new Date(end).toISOString(),amount:2.11}]};
}
function check(name,fn){if(only&&only!==name)return;fn();console.log('PASS '+name);}
check('client',()=>{
 for(const tz of ['Europe/Madrid','UTC','America/Los_Angeles','Pacific/Auckland'])for(const [label,clock,from,to]of boundaries){
  process.env.TZ=tz;now=Date.parse(clock);const start=Date.parse(from),end=Date.parse(to),s=fixture(start,end),before=JSON.stringify(s);
  const dash=cli.dashboardBudgetStats(s),gastos=cli.monthBudgetStats(s,null,null,null,cli.gastosPeriodOf('month',cli.presetBoundsMs('month',{}),null));
  console.log(JSON.stringify({case:label,tz,spentCents:cents(dash.spent),expectedSpentCents:2554,incomeCents:cents(dash.income),reservedCents:cents(dash.reserved),remainingCents:cents(dash.remaining)}));
  assert.equal(cents(dash.spent),2554,'Inicio excluye 2719c del mes siguiente y conserva 811c futuros del mismo mes');
  assert.equal(cents(dash.income),535);assert.equal(cents(dash.reserved),317);assert.equal(cents(dash.budget),9683);
  // Oráculo cambiado el 26/10/2026: Inicio compara gasto menos ingresos sin nómina (2554−535=2019c),
  // así que quedan 9683−2019=7664c; antes, con el bruto, 7129c. `monthBudgetStats` en «split» no cambia.
  assert.equal(cents(dash.against),2019);assert.equal(cents(dash.remaining),7664);
  assert.equal(cents(gastos.shown),2554);assert.equal(cents(gastos.remaining),7129);assert.equal(cli.budgetPeriodOf(s).startMs,start);assert.equal(cli.budgetPeriodOf(s).todayEndMs,end);
  assert.equal(cents(cli.categorySpentByMonth(s).reduce((a,x)=>a+x.spent,0)),2554);
  const net=cli.monthBudgetStats({...s,settings:{...s.settings,gTotalMode:'net'}});assert.equal(cents(net.against),2019);assert.equal(cents(net.remaining),7664);
  now=end+12*3600000;const next=cli.dashboardBudgetStats(s);assert.equal(cents(next.spent),2719);assert.equal(cents(next.income),1307);assert.equal(cents(next.reserved),211);assert.equal(cents(next.remaining),9789-(2719-1307));
  assert.equal(JSON.stringify(s),before,'la selección de periodo no muta filas ni metadatos');
 }
});
check('fallback',()=>{
 process.env.TZ='Europe/Madrid';now=Date.parse(boundaries[0][1]);const s=fixture(Date.parse(boundaries[0][2]),Date.parse(boundaries[0][3]));s.settings.budgetCycle=true;
 const actual=cli.dashboardBudgetStats(s);assert.equal(actual.cycle,false,'sin nómina acreditada se conserva mes natural');assert.equal(cents(actual.spent),2554,'fallback mensual comparte exactamente la frontera');
});
check('cycle',()=>{
 process.env.TZ='Europe/Madrid';now=Date.parse('2026-10-10T12:00:00Z');const s=fixture(Date.parse(boundaries[0][2]),Date.parse(boundaries[0][3]));s.settings.budgetCycle=true;
 s.expenses.push({id:'salary',date:'2026-10-05T10:00:00Z',amount:-1500,merchant:'Nómina sintética',category:'ingreso',ent:'sabadell'},{id:'cycle-buy',date:'2026-10-06T12:00:00Z',amount:12.34,category:'super',ent:'sabadell'});
 const actual=cli.dashboardBudgetStats(s);assert.equal(actual.cycle,true);assert.equal(cents(actual.spent),1234);assert.equal(cli.budgetPeriodOf(s).todayEndMs,Date.parse('2026-10-10T22:00:00Z'),'ciclo acreditado conserva mañana');
});
function load(file,imports={}){const mod={exports:{}};let raw=fs.readFileSync(new URL('../'+file,import.meta.url),'utf8').replace(/^import\s[\s\S]*?from\s+"[^"]+";\r?\n/gm,'');
 if(mutant==='server-window'&&file==='supabase/functions/ingest/widget.ts'){
  const original='end = cycle ? tomorrow(now) : inicioDeMesMs(start + 35 * 864e5)';assert.ok(raw.includes(original),'mutante exige frontera V2 final');raw=raw.replace(original,'end = cycle ? tomorrow(now) : Infinity');
 }
 new Function('module','exports',...Object.keys(imports),transformSync(raw,{loader:'ts',format:'cjs'}).code)(mod,mod.exports,...Object.values(imports));return mod.exports;}
for(const reserve of [false,true])check(reserve?'server-reserve':'server-money',()=>{
 now=Date.parse(boundaries[0][1]);const start=Date.parse(boundaries[0][2]),end=Date.parse(boundaries[0][3]),s=fixture(start,end);if(!reserve)s.reservaLog=[];
 s.widgetPeriod={v:2,kind:'mes',start,anchor:'',scope:JSON.stringify([2,start,'mes','gasto','',reserve?96.83:100,['sabadell'],'sabadell',[[],[]]])};
 const rows=s.expenses.map(e=>({id:e.id,fecha:e.date,importe:e.amount,cat:e.category,comercio:e.merchant,source:e.source}));
 const server=load('supabase/functions/ingest/widget.ts',load('supabase/functions/_shared/presupuesto.ts'));
 const actual=server.widgetSnapshot(s,rows,now,{id:'payment',event:'synthetic',key:'synthetic'});
 console.log(JSON.stringify({case:reserve?'server-reserve':'server-money',actual,expectedSpentCents:2554,expectedBudgetCents:reserve?9683:10000}));
 // Desde el 26/10/2026 el widget lleva lo que Inicio compara: 2554c de gasto − 535c de ingresos.
 assert.ok(actual,'reservas del mes siguiente no invalidan el scope mensual actual');assert.equal(cents(actual.spent),2019,'consumidor real recibe todas las filas, sin prefiltrar el mes siguiente');assert.equal(cents(actual.budget),reserve?9683:10000);
});
if(!only||only==='legacy'||only==='legacy-null'){
 const {fakeDb,post,logic,handlerJs}=await import('./helpers/ingest-handler-fixture.mjs');
 let legacyCode=handlerJs;
 if(mutant==='legacy-window'){
  const original='.lt("fecha", new Date(hastaMs).toISOString())';assert.ok(legacyCode.includes(original),'mutante exige query legacy final');legacyCode=legacyCode.replace(original,'');
 }
 const GlobalDate=globalThis.Date;
 try{
  globalThis.Date=class extends GlobalDate{constructor(...a){super(...(a.length?a:[now]));}static now(){return now;}};
  for(const invalid of (only==='legacy-null'?[true]:only==='legacy'?[false]:[false,true]))for(const [label,clock,from,to]of boundaries)for(const mode of ['split','net']){
   now=GlobalDate.parse(clock);const start=GlobalDate.parse(from),end=GlobalDate.parse(to),s=fixture(start,end);
   s.settings={...s.settings,gTotalMode:mode,expenseBanks:['trade_republic'],widgetBank:'trade_republic'};
   s.accounts=[{ent:'trade_republic',role:'diario',spendFrom:true}];
   if(invalid)s.reservaLog.unshift(null);
   s.widgetPeriod={v:2,kind:'mes',start,anchor:'',scope:JSON.stringify([2,start,'mes','gasto','',96.83,['trade_republic'],'trade_republic'])};
   const rows=s.expenses.filter(e=>e.id!=='payment').map(e=>({id:e.id,user_id:'user',fecha:e.date,importe:e.amount,cat:e.category,comercio:e.merchant,source:'macrodroid'}));
   const env=fakeDb({state:s,rows}),before=JSON.stringify(s);
   const r=await post(env,{fuente:'tr',titulo:'Trade Republic',texto:'Has gastado 17,43 € en Supermercado sintético',fecha:String(start),evento:'monthly-'+label+'-'+mode},logic,legacyCode);
   console.log(JSON.stringify({case:'legacy',label,mode,invalidReserve:invalid,status:r.status,month:r.data.month,expectedShownCents:mode==='net'?2019:2554}));
   assert.equal(r.status,200);assert.ok(r.data.month,'handler real conserva month legacy');
   assert.equal(cents(r.data.month.spent),mode==='net'?2019:2554,'legacy recibe todas las filas del doble de BD, sin prefiltrado del test');
   assert.equal(cents(r.data.month.budget),9683);assert.equal(cents(r.data.month.budgetLeft),mode==='net'?7664:7129);
   assert.equal(r.data.month.periodStart,start);assert.equal(JSON.stringify(s),before,'acotar reservas no modifica app_state');
  }
 }finally{globalThis.Date=GlobalDate;}
 console.log('PASS legacy');
}
