// Matriz de fuentes exactas, con ledger sintético; sin red ni operaciones reales.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=process.argv[2]||process.cwd(),sha='067371705615e9cc58923509e3f60c3d0c9003ff';
const files=['supabase/functions/ingest/index.ts','supabase/functions/_shared/ingest_logic.ts','supabase/functions/_shared/presupuesto.ts','src/modules/08-motor-bank.js','src/modules/11-app-main.js'];
execFileSync('git',['diff','--exit-code',sha,'--',...files],{cwd:root});
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const {loadPureLogic}=await import(path.join(root,'scripts/load-pure-logic.mjs'));
const order=JSON.parse(read('src/build-order.json'));
const js=order.map(f=>read('src/modules/'+f)).join('\n');
const cli=loadPureLogic('<script>'+js+'</script>');
const server=await import(path.join(root,'supabase/functions/_shared/presupuesto.ts'));
const src=read('supabase/functions/ingest/index.ts');
const start=src.indexOf('    month = {'),end=src.indexOf('\n    };',start)+7;
assert.ok(start>0&&end>start);
const payload=src.slice(start,end);
const now=Date.parse('2026-10-07T12:00:00Z'),period=server.inicioDeMesMs(new Date(now));
const rows=[
 {id:'synthetic-a',ingest_event_id:'synthetic-tr-event',fecha:'2026-10-02T10:00:00Z',importe:300,cat:'super',source:'macrodroid',comercio:'Synthetic'},
 {id:'synthetic-pay',fecha:'2026-10-03T10:00:00Z',importe:-1800,cat:'ingreso',source:'ob:trade_republic',comercio:'NOMINA SYNTHETIC'},
 {id:'synthetic-neutral',fecha:'2026-10-04T10:00:00Z',importe:80,cat:'inversion',source:'macrodroid',comercio:'Synthetic'},
 {id:'synthetic-other',fecha:'2026-10-05T10:00:00Z',importe:440,cat:'hogar',source:'ob:sabadell',comercio:'Synthetic'},
 {id:'synthetic-new',ingest_event_id:'synthetic-wallet-event',fecha:'2026-10-06T10:00:00Z',importe:120,cat:'bares',source:'macrodroid',comercio:'Synthetic'},
];
const cases=[],cent=x=>+Number(x).toFixed(2);
function state(extra={}){return {budget:1000,accounts:[{ent:'trade_republic',role:'diario'},{ent:'sabadell',role:'fijos'}],settings:{expenseBanks:['trade_republic'],gTotalMode:'net',...extra},reservaLog:[],expenses:rows.map(r=>cli.expenseFromRow(r)),deleted:[]};}
for(const mode of ['net','split'])for(const selected of [['trade_republic'],['sabadell'],['trade_republic','sabadell']])for(const budget of [0,1000]){
 const s=state({gTotalMode:mode,expenseBanks:selected});s.budget=budget;
 const visible=server.filasComoLaApp(rows,s.deleted),stats=server.statsDelMes(visible,s,period);
 const sinEsta=server.statsDelMes(visible.filter(r=>r.id!=='synthetic-new'),s,period);
 const legacy=cli.monthBudgetStats(s,now),ctx={stats,sinEsta,budget,after:stats.against,desdeMs:period,readAt:now,eventKey:'synthetic-wallet-event',fecha:rows[4].fecha,importe:120,comercio:'Synthetic',mueveElPresupuesto:server.cuentaParaPresupuesto(rows[4],server.bancosDeGastoDiario(s))};
 vm.createContext(ctx);vm.runInContext('let month;'+payload+';globalThis.result=month;',ctx);
 assert.equal(cent(ctx.result.spent),cent(legacy.shown));
 assert.equal(cent(ctx.result.budgetLeft),budget>0?cent(Math.max(0,legacy.remaining)):-1);
 assert.equal(ctx.result.contract,undefined);assert.equal(ctx.result.periodKind,undefined);assert.equal(ctx.result.scope,undefined);
 assert.equal(ctx.result.eventKey,'synthetic-wallet-event');
 cases.push({mode,banks:selected,budget,legacyEquivalent:true,responseContractAbsent:true});
}
const actualDate=cli.Date;cli.Date=class extends actualDate{static now(){return now;}};
const s=state({budgetCycle:true,gTotalMode:'split'}),cycle=cli.dashboardBudgetStats(s),month=server.statsDelMes(rows,s,period);
assert.ok(cycle.cycle);assert.notEqual(cycle.periodStart,period);assert.equal(cent(cycle.against),120);assert.notEqual(cent(month.shown),120);
const anchor=cli.keyOfExpense(cli.budgetPaydayOf(s,now).inc),scope=cli.widgetScopeOf(s,cycle,anchor,'trade_republic');
assert.notEqual(scope,cli.widgetScopeOf(s,cycle,'different-anchor','trade_republic'));
assert.notEqual(scope,cli.widgetScopeOf(s,cycle,anchor,'sabadell'));
assert.notEqual(scope,cli.widgetScopeOf({...s,settings:{...s.settings,expenseBanks:['sabadell']}},cycle,anchor,'trade_republic'));
assert.notEqual(scope,cli.widgetScopeOf(s,{...cycle,budget:900},anchor,'trade_republic'));
const older={id:'synthetic-old',ingest_event_id:'synthetic-old-event',fecha:'2026-09-28T12:00:00Z',source:'macrodroid'},future={id:'synthetic-future',ingest_event_id:'synthetic-future-event',fecha:'2026-10-08T12:00:00Z',source:'macrodroid'};
const coverage=cli.widgetCoveredEvents([...rows,older,future],cycle.periodStart,now,true);
assert.ok(coverage.includes('|synthetic-wallet-event|synthetic-new|'));assert.ok(coverage.includes('|synthetic-old-event|synthetic-old|'));assert.ok(!coverage.includes('synthetic-future'));
assert.ok(cli.widgetCoveredEvents([{id:'synthetic-ack',fecha:rows[4].fecha,source:'macrodroid'}],period,now,true).includes('|synthetic-ack|'));
assert.ok(!coverage.includes('|raw-notification-token|'));
cli.Date=actualDate;
console.log(JSON.stringify({schema:1,sourceSHA:sha,sourceHashes:Object.fromEntries(files.map(f=>[f,createHash('sha256').update(read(f)).digest('hex')])),payloadSHA256:createHash('sha256').update(payload).digest('hex'),legacyMatrix:cases,cycle:{clientPeriod:cycle.periodStart,legacyPeriod:period,clientAgainst:cent(cycle.against),legacyShown:cent(month.shown),differentWindows:true},scopeControls:['anchor','widgetBank','expenseBanks','budget'],coverageControls:['event and row ACK','historical v2 row','future excluded','row fallback','raw token not acknowledged'],exit:0,liveIngest:'unknown',installedAPK:'unknown',limits:'Actual source calculations and month object, synthetic ledger/VM; no Edge handler/database/Android/React execution; no server v2 implementation proved'},null,2));
