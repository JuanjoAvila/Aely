/** Reproducción de investigación: EXIT1 esperado, no fix. No pertenece al runner verde. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {here,base,files,logic,identity,budget,client,clone,state,notify,bank,sync,wire,fromCloud,counted,cents,fakeDb,post} from './runtime.mjs';
const evidence={schema:1,baseSHA:base,syntheticOnly:true,runtime:process.version,adapter:'Node native TypeScript stripping; real source functions, in-memory Data API mock; not Deno/HTTP/PostgreSQL',sourceHashes:null,cases:[],observations:[]};
let failed=0;
// Tras corregir el formato del POST se repiten SOLO los casos afectados; los controles puros
// ya terminados se conservan en la ejecución inicial, sin volver a ejecutarlos.
const postOnly=process.argv.includes('--post-only');
const postedBoundaryOnly=process.argv.includes('--posted-boundary-only');
const boundariesOnly=process.argv.includes('--boundaries-only')||postedBoundaryOnly;
const sameDayIdentityOnly=process.argv.includes('--same-day-identity-only');
const cashRiskOnly=process.argv.includes('--cash-risk-only');
async function t(kind,name,fn){
 if(postedBoundaryOnly&&!(kind==='boundary-red'&&name.endsWith('2026-10-19')))return;
 if(cashRiskOnly&&kind!=='cash-risk')return;
 if(!cashRiskOnly&&kind==='cash-risk')return;
 if(!cashRiskOnly){
 if(sameDayIdentityOnly&&kind!=='same-day-identity')return;
 if(!sameDayIdentityOnly&&kind==='same-day-identity')return;
 if(!sameDayIdentityOnly&&boundariesOnly&&!kind.startsWith('boundary'))return;
 if(!sameDayIdentityOnly&&!boundariesOnly&&kind.startsWith('boundary'))return;
 }
 if(postOnly&&kind==='control'&&!['el descarte actual es explícito y no escribe gastos','dos compras reales distintas iguales y sus reintentos siguen 2:1'].includes(name))return;
 try{const detail=await fn();evidence.cases.push({kind,name,pass:true,...(detail?{detail}:{} )});console.log('PASS '+kind+': '+name);}catch(e){failed++;evidence.cases.push({kind,name,pass:false,error:String(e.message),stack:e.stack});console.error('FAIL '+kind+': '+name+'\n'+e.stack);}}
const observe=(name,value)=>{evidence.observations.push({name,value});console.log('OBS '+name+' '+JSON.stringify(value));};

await t('control','el descarte actual es explícito y no escribe gastos',async()=>{
 const env=fakeDb();const response=await post(env,notify());
 assert.equal(response.status,200);assert.equal(response.data.skipped,true);assert.equal(response.data.tipo,'ignorado');assert.equal(env.rows.length,0);
 assert.ok(env.events.some(e=>e.message.includes('ruido:round up')));
 assert.equal(JSON.stringify(env.events).includes('Fondo Sintetico'),false);
 observe('roundup-base-response',response.data);
});
await t('control','compras, bizums y ruido ajeno conservan clasificación',()=>{
 assert.equal(logic.clasificar('Has gastado 0,42 € en Round Up Cafe','Trade Republic'),'gasto');
 assert.equal(logic.clasificar('Has enviado 0,42 € a Persona Sintetica por Bizum','Trade Republic'),'gasto_nocard');
 for(const text of ['Saveback: 0,42 € invertidos en tu plan','Tu plan de inversión ha ejecutado 40,00 € en Fondo Sintetico','Confirma el pago de 0,42 € en Tienda Sintetica']) assert.equal(logic.clasificar(text,''),'ignorado');
});
await t('control','dos compras reales distintas iguales y sus reintentos siguen 2:1',async()=>{
 const env=fakeDb(); const a={fuente:'tr',titulo:'Trade Republic',texto:'Has gastado 0,42 € en Tienda Sintetica',fecha:String(Date.parse('2026-10-16T09:00:00.000Z')),evento:'v1_purchase_a'};
 const b={...a,fecha:String(Date.parse('2026-10-16T09:01:00.000Z')),evento:'v1_purchase_b'};
 await post(env,a);await post(env,b);await post(env,a);assert.equal(env.rows.length,2);assert.equal(cents(env.rows),84);
});
await t('control','referencias OB distintas con igual banco/día/nombre/céntimo conservan multiplicidad',()=>{
 const s=sync(state(),[bank(),bank({id:'synthetic-real-other'})]);assert.equal(s.expenses.length,2);assert.equal(cents(counted(s)),84);
 assert.equal(sync(s,[bank(),bank({id:'synthetic-real-other'})]).expenses.length,2);
});
await t('control','la red automática existente no absorbe fila con nombre por mero parecido',()=>{
 const n={id:'signal',date:'2026-10-16T10:00:00Z',amount:0.42,merchant:'Fondo Sintetico',category:'inversion',noCard:true,source:'macrodroid',ent:'trade_republic'};
 const s=sync(state([n]),[bank()]);assert.equal(counted(s).length,2);assert.equal(s.expenses.some(e=>e.possibleDup||e.autoGemelo),false);
 observe('named-OB-existing-network',clone(s.expenses));
});
await t('control','banco y categoría inversión sobreviven transporte cloud',()=>{
 const e={id:'investment',date:'2026-10-16T10:00:00Z',amount:0.42,merchant:'Round up Invertido',category:'inversion',source:'macrodroid',ent:'trade_republic',noCard:true};
 const cloud=wire(e), back=client.expenseFromRow(cloud);assert.equal(back.category,'inversion');assert.equal(back.noCard,true);assert.equal(back.ent,'trade_republic');
 assert.equal(budget.cuentaParaPresupuesto(cloud,['trade_republic']),false);assert.equal(client.roundupOf([back],1),0);
});
await t('control','identidad actual TR/Wallet es tolerante y no vale para céntimo exacto',()=>{
 const a={fecha:'2026-10-16T10:00:00Z',importe:0.42,ingest_event_id:'tr:trade_republic:v1_roundup'};
 const b={fecha:'2026-10-16T10:01:00Z',importe:0.43,ingest_event_id:'wallet:trade_republic:v1_real_purchase'};
 assert.equal(identity.esGemeloIngest(a,b),true);
 observe('current-cross-door-tolerance',{cents:[42,43],matches:true});
});

// ROJO de aceptación contra base REAL, no tests de una función de matching que aún no existe.
await t('red','una señal explícita sin OB debe conservar un asiento neutral de inversión',async()=>{
 const env=fakeDb();await post(env,notify());
 assert.equal(env.rows.filter(r=>r.ingest_event_id==='tr:trade_republic:v1_synthetic_roundup').length,1,'base descarta la señal: esperado un asiento de inversión, actual cero');
 const r=env.rows[0];assert.equal(r.cat,'inversion');assert.equal(r.no_card,true);
});
await t('red','orden notificación→OB conserva el primer asiento sin desaparecer hasta sync',async()=>{
 const env=fakeDb();await post(env,notify());assert.equal(cents(env.rows),42,'antes de OB la inversión notificada debe existir una vez');
 const s=sync(state(fromCloud(env.rows)),[bank()]);assert.equal(cents(counted(s)),42,'una señal y su BOOK con nombre no son dos cargos');
});
await t('red','orden OB→notificación clasifica como inversión el cargo único emparejado',async()=>{
 const s=sync(state(),[bank()]);const env=fakeDb({rows:s.expenses.map(wire)});await post(env,notify());
 assert.equal(env.rows.length,1);assert.equal(cents(env.rows),42);assert.equal(env.rows[0].cat,'inversion','OB con nombre queda otros porque la señal se ignora');
});

// SONDA CONTRAFACTUAL: solo en memoria se fuerza la clasificación a gasto. No es un fix.
// Aísla por qué quitar IGNORAR no cumple el contrato ni autoriza una implementación.
const forcePurchase=()=>({tipo:'gasto',motivo:null});
await t('probe','abrir únicamente el clasificador duplica cuando OB con nombre llega después',async()=>{
 const env=fakeDb();await post(env,notify(),forcePurchase);
 const s=sync(state(fromCloud(env.rows)),[bank()]);
 observe('classifier-only-notify-before-OB',{rows:clone(s.expenses),cents:cents(counted(s))});
 assert.equal(cents(counted(s)),42,'sonda sin matching: observado84c, esperado42c');
});
await t('probe','abrir únicamente el clasificador duplica cuando OB con nombre ya existe',async()=>{
 const s=sync(state(),[bank()]);const env=fakeDb({rows:s.expenses.map(wire)});await post(env,notify(),forcePurchase);
 observe('classifier-only-OB-before-notify',{rows:clone(env.rows),cents:cents(env.rows)});
 assert.equal(cents(env.rows),42,'sonda sin matching inverso: observado84c, esperado42c');
});
await t('probe','abrir como compra suma al presupuesto y genera nuevo redondeo',async()=>{
 const env=fakeDb();const response=await post(env,notify(),forcePurchase);const cloud=env.rows[0],e=client.expenseFromRow(cloud);
 observe('classifier-only-accounting',{category:cloud.cat,no_card:cloud.no_card,counts:response.data.month?.counts,roundupCents:Math.round(client.roundupOf([e],1)*100)});
 assert.equal(response.data.month.counts,0,'invertido no es compra: hoy cuenta contra presupuesto');
 assert.equal(client.roundupOf([e],1),0);assert.equal(cloud.no_card,true);
});
await t('red-risk','no absorber un pago Wallet de otro céntimo al abrir la señal TR',async()=>{
 const s=state();const env=fakeDb({rows:[{id:'wallet-real',user_id:'user',fecha:'2026-10-16T10:01:00.000Z',importe:0.43,comercio:'Compra distinta',cat:'otros',source:'macrodroid',ingest_event_id:'wallet:trade_republic:v1_real'}]});
 const response=await post(env,notify(),forcePurchase);
 observe('classifier-only-wallet-collision',response.data);
 assert.equal(env.rows.length,2,'el matching actual ±0.02 devuelve ACK de otra compra y pierde el redondeo de42c');
});

// Nuevas fronteras del diseño: fixture de señal futura, frente al motor de OB REAL de la base.
// No se ejecuta un algoritmo de matching inventado. Estas pruebas no modifican clasificador/OB.
const signal=(extra={})=>({id:'synthetic-signal',date:'2026-10-16T10:00:00Z',amount:0.42,merchant:'Round up Invertido',category:'inversion',noCard:true,source:'macrodroid',ent:'trade_republic',...extra});
for(const day of ['2026-10-13','2026-10-16','2026-10-19']){
 await t('boundary-red','pareja con nombre dentro de ventana inclusiva '+day,()=>{
  const result=sync(state([signal()]),[bank({date:day})]);
  observe('named-pair-'+day,{visible:counted(result).length,cents:cents(counted(result))});
  assert.equal(counted(result).length,1,'el motor actual no une la señal futura y la fila con nombre ni en límite ±3días');
 });
}
for(const [name,patch] of [
 ['otro banco',{ent:'revolut'}],['otro céntimo',{amount:0.43}],['fuera de ventana por delante',{date:'2026-10-20'}],['fuera de ventana por detrás',{date:'2026-10-12'}],['compra real de otro nombre',{merchant:'Tienda Sintetica'}],['devolución de signo contrario',{amount:-0.42}],
]){
 await t('boundary-control','conservar '+name,()=>{
  const result=sync(state([signal()]),[bank(patch)]);assert.equal(result.expenses.length,2);assert.equal(counted(result).length,2);assert.equal(result.expenses.some(e=>e.autoGemelo||e.possibleDup),false);
 });
}
await t('boundary-control','dos referencias reales iguales no pueden ser consumidas por una señal',()=>{
 const result=sync(state([signal()]),[bank(),bank({id:'synthetic-second-reference'})]);
 assert.equal(result.expenses.filter(e=>e.extId).length,2);assert.equal(new Set(result.expenses.filter(e=>e.extId).map(e=>e.extId)).size,2);
 assert.equal(result.expenses.some(e=>e.autoGemelo),false);observe('ambiguous-two-book-one-signal',{rawRows:result.expenses.length,bankRefs:result.expenses.filter(e=>e.extId).map(e=>e.extId)});
});
await t('boundary-control','la inversión real NO origina otro redondeo si se conserva noCard',()=>{
 assert.equal(client.roundupOf([signal()],1),0);
 assert.equal(client.roundupOf([signal({noCard:undefined})],1),0.58,'categoría inversión sola no protege isCardSpend');
});
await t('boundary-control','una etiqueta source ad hoc se pierde en el transporte actual',()=>{
 const raw={id:'marker',fecha:'2026-10-16T10:00:00Z',importe:0.42,cat:'inversion',comercio:'Round up Invertido',source:'ob:trade_republic#roundupsynthetic'};
 const back=client.expenseSourceForCloud(client.expenseFromRow(raw));assert.equal(back,'ob:trade_republic');
 observe('source-marker-roundtrip',{input:raw.source,output:back});
});
await t('same-day-identity','clave coincidente del mismo día no sustituye asociación duradera de banco/ref',()=>{
 const result=sync(state([signal()]),[bank({date:'2026-10-16'})]);
 assert.equal(counted(result).length,1,'control: solo un cargo en ese día');
 observe('same-day-identity',{rows:clone(result.expenses)});
 assert.ok(result.expenses.some(e=>e.extId==='synthetic-roundup-ref'),'el descarte por clave deja una fila, pero pierde la referencia BOOK sin asociación persistida');
});
const cashState=(month,source='macrodroid')=>{
 const rows=[{id:'synthetic-card',date:month+'-10T10:00:00Z',amount:3.58,merchant:'Tienda Sintetica',category:'otros',source:'macrodroid',ent:'trade_republic'},signal({date:month+'-11T10:00:00Z',source})];
 const s=state(rows);s.accounts[0]={...s.accounts[0],roundup:1,inject:0};return s;
};
await t('cash-risk','asiento neutral de notificación no debe restar también el round-up estimado en saldo vivo',()=>{
 const s=cashState('2026-10'),input=client.insumosSaldoGasto(s);
 const shown=client.saldoCuentaGasto({value:1000,injTR:input.injTR,spentOwn:input.spentByBank.trade_republic,roundup:input.roundup,monthlyInvest:input.monthlyInvest});
 observe('cash-live-future-signal',{spent:input.spentByBank.trade_republic,estimatedRoundup:input.roundup,shown,expected:996});
 assert.equal(Math.round(shown*100),99600,'3.58compra +0.42roundup REAL =4.00 salida total, no4.42');
});
await t('cash-risk','control cierre con fila OB de inversión suprime simulación existente',()=>{
 const s=cashState('2026-09','ob');s.trAnchor='2026-09';const closed=client.reconcileTR(clone(s));
 observe('cash-close-OB',{value:closed.accounts[0].value});assert.equal(Math.round(closed.accounts[0].value*100),99600);
});
await t('cash-risk','cierre con solo notificación de inversión tampoco debe restar dos veces',()=>{
 const s=cashState('2026-09');s.trAnchor='2026-09';const closed=client.reconcileTR(clone(s));
 observe('cash-close-future-notify',{value:closed.accounts[0].value,expected:996});
 assert.equal(Math.round(closed.accounts[0].value*100),99600,'obFed solo ve sourceOB, por lo que resta la notificación real y la estimación');
});

evidence.sourceHashes=Object.fromEntries(files);evidence.summary={passed:evidence.cases.filter(x=>x.pass).length,failed,exitCode:failed?1:0};
if(process.env.PRO09_EVIDENCE_DIR) fs.writeFileSync(path.join(process.env.PRO09_EVIDENCE_DIR,'pro09-risk-evidence.json'),JSON.stringify(evidence,null,2)+'\n');
console.log('SUMMARY '+JSON.stringify(evidence.summary));process.exitCode=failed?1:0;
