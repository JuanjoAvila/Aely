import {filasComoLaApp,inicioDeMesMs} from './presupuesto.ts';
import {widgetSnapshot} from '../ingest/widget.ts';
const owner='synthetic-owner',id=(n:number)=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const row={id:id(2),source:'ob:caixabank#refbooked#accaccount-a#n2',fecha:'2026-10-16T12:00:00.001Z',importe:3.2,comercio:'Compra sintetica',cat:'otros'};
const kept={...row,id:id(1),source:'ob:caixabank#refpending#accaccount-a#n1',fecha:'2026-10-16T12:00:00Z'};
const entry={owner,id:row.id,key:'ob-absorbed2|caixabank|booked|2|account-a|2026-10-16',keepId:kept.id,keepKey:'ob-absorbed2|caixabank|booked|1|account-a|2026-10-16',ackAt:1792324800000};
const eq=(a:unknown,b:unknown)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw Error('FIN17 assertion '+JSON.stringify(a)+' != '+JSON.stringify(b));};
Deno.test('FIN17 confirmado propio oculta tras poda;ajeno y malformado no tienen autoridad',()=>{
 eq(filasComoLaApp([kept,row],[],[],owner,[entry]),[kept]);eq(filasComoLaApp([kept,row],[],[],'other',[entry]),[kept,row]);
 eq(filasComoLaApp([row],[],[],owner,[{...entry,id:'invalid'}]),[row]);
});
Deno.test('FIN17 match FIN10 account wildcard y fronteras exactas preservadas',()=>{
 eq(filasComoLaApp([{...row,source:row.source.replace('#accaccount-a','')}],[],[],owner,[entry]),[]);
 eq(filasComoLaApp([row],[],[],owner,[{...entry,key:entry.key.replace('|account-a|','||')}]),[]);
 for(const other of [{...row,source:row.source.replace('booked','different')},{...row,source:row.source.replace('account-a','account-b')},{...row,source:row.source.replace('#n2','#n3')},{...row,fecha:'2026-10-15T12:00:00Z'},{...row,id:kept.id}])eq(filasComoLaApp([other],[],[],owner,[entry]),[other]);
});
Deno.test('FIN17 ocultar confirmado antes de consumir la referencia entre días',()=>{
 const later={...row,id:id(3),fecha:'2026-10-17T12:00:00Z'};
 for(const rows of [[row,later],[later,row]])eq(filasComoLaApp(rows,[],[],owner,[entry]),[later]);
});
Deno.test('FIN17 widget usa confirmado;un pago oculto no obtiene snapshot',()=>{
 const now=Date.parse('2026-10-18T12:00:00Z'),start=inicioDeMesMs(now),scope=JSON.stringify([2,start,'mes','gasto','',1000,['caixabank'],'caixabank']);
 const data={budget:1000,accounts:[{ent:'caixabank',role:'diario',spendFrom:true}],settings:{expenseBanks:['caixabank']},widgetPeriod:{v:2,kind:'mes',start,scope},deleted:[],obAbsorbedPending:[],obAbsorbedConfirmed:[entry]};
 eq(widgetSnapshot(data,[kept,row],now,{id:row.id,event:'synthetic',key:'synthetic'},owner),null);
 const result=widgetSnapshot(data,[kept,row],now,{id:kept.id,event:'synthetic',key:'synthetic'},owner);eq(result?.spent,3.2);
});
