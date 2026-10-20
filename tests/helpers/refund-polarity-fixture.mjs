import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {transformSync} from 'esbuild';
import {createLogicSandbox} from '../../scripts/load-pure-logic.mjs';
const root=new URL('../../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root),'utf8');
const names=fs.readdirSync(new URL('src/modules/',root)).filter(n=>n.endsWith('.js')).sort();
export const clientSource=names.map(n=>read('src/modules/'+n)).join('\n');
export const serverSource=read('supabase/functions/_shared/presupuesto.ts');
export function fixture(raw=clientSource,ts=serverSource){
const source=raw.slice(0,raw.search(/\nclass ErrorBoundary\b/));
assert.ok(source.length>100000);
const now=Date.parse('2026-10-18T10:00:00Z');class Clock extends Date{constructor(...a){super(...(a.length?a:[now]));}static now(){return now;}}
const c=createLogicSandbox({Date:Clock});vm.runInNewContext(source,c,{filename:'exact141-src-modules'});
const mod={exports:{}};new Function('module','exports',transformSync(ts,{loader:'ts',format:'cjs'}).code)(mod,mod.exports);const server=mod.exports;
const state=expenses=>({accounts:[{id:'cx',ent:'caixabank',role:'diario',spendFrom:true,value:1000}],settings:{expenseBanks:['caixabank'],gTotalMode:'net'},expenses,gemelos:[],deleted:[],fixed:[],debts:[],oneoffs:[],flows:[],investments:[],goals:[],assets:[],budget:1000,bankTx:[],obAccounts:[]});
const purchase={id:'11111111-1111-4111-8111-111111111111',source:'ob',ent:'caixabank',extId:'refund-case-ref',date:'2026-10-15T12:00:00.000Z',amount:12.34,merchant:'Synthetic shop',obName:'Synthetic shop',category:'otros',obAcc:'synthetic-account-a'};
const refund={...purchase,id:'22222222-2222-4222-8222-222222222222',amount:-12.34,category:'ingreso'};
const toRow=e=>({id:e.id,source:c.expenseSourceForCloud(e),fecha:e.date,importe:e.amount,comercio:e.merchant,cat:e.category});
const net=es=>es.reduce((n,e)=>n+Math.round(e.amount*100),0);
const view=es=>({count:es.length,cents:net(es),rows:es.map(e=>({id:e.id,amount:e.amount,extId:e.extId,ent:e.ent,obAcc:e.obAcc,obOrd:e.obOrd,date:e.date}))});
const tx=e=>({id:e.extId,ent:e.ent,date:e.date.slice(0,10),amount:e.amount,merchant:e.obName,status:'BOOK',acc:e.obAcc});
const ingest=(prev,incoming)=>{const s=state(prev),add=c.importObExpenses(s,incoming.map(tx),[{aspsp:'CaixaBank',syncFrom:'2026-10-01'}])||[];return add.concat(prev);};
const paths={merge:es=>c.mergeExpenses([],es).list,cloudBatch:es=>c.mergeExpensesFromCloud([],es).list,cloudSequential:es=>c.mergeExpensesFromCloud([es[0]],[es[1]]).list,importBatch:es=>ingest([],es),importSequential:es=>ingest([es[0]],[es[1]]),server:es=>server.filasComoLaApp(es.map(toRow),[]).map(c.expenseFromRow)};
return {c,server,state,purchase,refund,toRow,net,view,tx,paths,ingest};
}
