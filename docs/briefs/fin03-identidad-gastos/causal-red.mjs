import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {test,after} from 'node:test';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createLogicSandbox,extractPureLogicSource} from '../../../scripts/load-pure-logic.mjs';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const order=JSON.parse(read('src/build-order.json'));
const rawSource=order.map(p=>read('src/modules/'+p)).join('\n');
const html=read('src/shell.html').replace('<!--MC_APP_SCRIPT-->',()=>rawSource);
const now=Date.parse('2026-10-17T12:00:00.000Z'),day='2026-10-16';
class FixedDate extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
const c=createLogicSandbox({Date:FixedDate});
vm.runInNewContext(extractPureLogicSource(html),c,{filename:'base-source-private-repro'});
const server=await import(pathToFileURL(path.join(root,'supabase/functions/_shared/presupuesto.ts')).href);
const core=read('src/modules/00-core.js');
const state=(expenses=[])=>({accounts:[{id:'synthetic-cx',ent:'caixabank',role:'diario',spendFrom:true,value:1000},{id:'synthetic-sb',ent:'sabadell',role:'diario',spendFrom:true,value:1000}],settings:{expenseBanks:['caixabank','sabadell']},expenses,deleted:[],gemelos:[],fixed:[],debts:[],oneoffs:[],flows:[],investments:[],goals:[],assets:[],budget:1000,bankTx:[]});
const txn=(id)=>({ext_id:id,date:day,amount:2.5,merchant:'Cafe sintetico',status:'BOOK'});
const feed=(sameReference=false)=>[{aspsp:'CaixaBank',syncFrom:'2026-01-01',transactions:[txn('ref-cx')]},{aspsp:'Banco Sabadell',syncFrom:'2026-01-01',transactions:[txn(sameReference?'ref-cx':'ref-sb')]}];
const imported=(sameReference=false)=>{const links=feed(sameReference),flat=c.flattenBankTx(links);assert.equal(flat.length,2);return c.importObExpenses(state(),flat,links)||[];};
const cents=expenses=>expenses.reduce((n,e)=>n+Math.round(e.amount*100),0);
const wire=e=>({id:e.id,user_id:'synthetic-owner',fecha:e.date,importe:e.amount,comercio:e.merchant,cat:e.category,source:c.expenseSourceForCloud(e),ob_name:e.obName});
const observation=[];
function record(name,actual,expected,details={}){observation.push({name,actual,expected,...details});console.log(JSON.stringify(observation.at(-1)));}
const two=imported();
function sdk(){
 const rows=[],calls=[];
 const sql=read('supabase/migrations/0001_init.sql'),m=sql.match(/create unique index if not exists expenses_dedup_idx\s+on public\.expenses \(([^)]+)\)/i);
 assert.ok(m,'read exact unique-index declaration from base');const unique=m[1].split(',').map(x=>x.trim());
 return{rows,calls,unique,auth:{getSession:async()=>({data:{session:{user:{id:'synthetic-owner'}}}})},from(table){assert.equal(table,'expenses');return{upsert(input,options){const all=Array.isArray(input)?input:[input];calls.push({input:JSON.parse(JSON.stringify(all)),options});assert.equal(options.onConflict,unique.join(','));assert.equal(options.ignoreDuplicates,true);const added=[];for(const row of all){if(!rows.some(old=>unique.every(k=>old[k]===row[k]))){rows.push({...row});added.push({id:row.id});}}const out={data:null,error:null};return{then(resolve,reject){return Promise.resolve(out).then(resolve,reject);},select:async()=>({data:added,error:null})};}};}};
}
function realMethod(name,sb){const start=core.indexOf('    async '+name+'('),end=core.indexOf('\n    },',start);assert.ok(start>=0&&end>start);const method=core.slice(start,end+7).trim().replace(/,$/,'');c.__finSdk=sb;try{return vm.runInContext('(function(sb){return ({'+method+'}).'+name+';})(__finSdk)',c);}finally{delete c.__finSdk;}}

test('CONTROL import: two banks same cent/date/merchant remain two expenses',()=>{record('import-count',two.length,2,{cents:cents(two),banks:two.map(e=>e.ent),refs:two.map(e=>e.extId),ordinals:two.map(e=>e.obOrd||1)});assert.equal(two.length,2);assert.equal(cents(two),500);assert.deepEqual(new Set(two.map(e=>e.ent)),new Set(['caixabank','sabadell']));});
test('CONTROL import: repeated reference in different banks is scoped',()=>{const rows=imported(true);record('same-ref-different-bank-import',rows.length,2);assert.equal(rows.length,2);});
test('CONTROL reimport same two origins is idempotent',()=>{const links=feed(),s=state(two),rows=c.importObExpenses(s,c.flattenBankTx(links),links)||[];record('reimport-count',rows.length,0);assert.equal(rows.length,0);});
test('CONTROL same bank distinct refs still occupy two slots',()=>{const links=[{...feed()[0],transactions:[txn('ref-a'),txn('ref-b')]}];const rows=c.importObExpenses(state(),c.flattenBankTx(links),links)||[];assert.equal(rows.length,2);assert.equal(new Set(rows.map(e=>c.keyOfExpense(e))).size,2);record('same-bank-distinct-ref-slots',rows.map(e=>e.obOrd||1),[1,2]);});
test('RED local merge retains both banks',()=>{const actual=c.mergeExpenses(two,[]).list;record('local-merge',actual.length,2,{cents:cents(actual),retainedBanks:actual.map(e=>e.ent)});assert.equal(actual.length,2);assert.equal(cents(actual),500);});
test('RED cloud merge retains both already-local origins',()=>{const actual=c.mergeExpensesFromCloud(two,[]).list;record('cloud-merge-existing-local',actual.length,2,{cents:cents(actual)});assert.equal(actual.length,2);});
test('RED cold cloud pull retains two banks even with distinct timestamps',()=>{const rows=two.map(wire);rows[1]={...rows[1],fecha:day+'T16:20:00.000Z'};const actual=c.mergeExpensesFromCloud([],rows.map(c.expenseFromRow)).list;record('cold-pull-distinct-timestamp',actual.length,2,{cents:cents(actual)});assert.equal(actual.length,2);});
test('RED identity collision lets later other bank overwrite category',()=>{const local={...two[0],category:'restaurantes'},incoming={...two[1],category:'transporte'};const actual=c.mergeExpensesFromCloud([local],[incoming]).list;record('crossbank-category-refresh',{count:actual.length,firstCategory:actual[0].category,firstBank:actual[0].ent},{count:2,firstCategory:'restaurantes',firstBank:'caixabank'});assert.equal(actual.length,2);assert.equal(actual[0].category,'restaurantes');});
test('RED actual cloud.addExpense plus schema-index model persists both banks',async()=>{const db=sdk(),add=realMethod('addExpense',db);for(const row of two)await add(row);record('single-writer-schema-model',db.rows.length,2,{cents:db.rows.reduce((n,r)=>n+Math.round(r.importe*100),0),onConflict:db.calls[0].options.onConflict,uniqueColumns:db.unique,sources:db.calls.map(call=>call.input[0].source),limitation:'SDK/index model, no PostgreSQL or RLS executed'});assert.equal(db.rows.length,2);});
test('RED actual cloud.addExpensesBatch ACKs both legitimate banks',async()=>{const db=sdk(),add=realMethod('addExpensesBatch',db);const ack=await add(two);record('batch-writer-schema-model',{stored:db.rows.length,ackCount:ack.cloudIds.length},{stored:2,ackCount:2},{limitation:'SDK/index model only'});assert.equal(db.rows.length,2);assert.equal(ack.cloudIds.length,2);});
test('RED server key and budget keep both banks',()=>{const rows=two.map(wire);rows[1]={...rows[1],fecha:day+'T16:20:00.000Z'};const actual=server.filasComoLaApp(rows,[]),stats=server.statsDelMes(actual,state(),Date.parse('2026-10-01T00:00:00.000Z'));record('server-read-budget',{count:actual.length,cents:Math.round(stats.spent*100)},{count:2,cents:500});assert.equal(actual.length,2);assert.equal(Math.round(stats.spent*100),500);});
test('CONTROL source roundtrip preserves bank and reference; no unknown-bank inference',()=>{for(const e of two){const decoded=c.expenseFromRow(wire(e));assert.equal(decoded.ent,e.ent);assert.equal(decoded.extId,e.extId);}record('source-roundtrip',two.map(e=>c.expenseSourceForCloud(e)),two.map(e=>c.expenseSourceForCloud(e)));});
test('CONTROL legacy same-bank alias still deduplicates and manual UUIDs remain distinct',()=>{const base={...two[0],extId:undefined};assert.equal(c.mergeExpenses([base],[{...base,id:'other-legacy-id'}]).list.length,1);const manual=two.map(e=>({...e,source:'manual'}));assert.equal(c.mergeExpenses(manual,[]).list.length,2);record('legacy-and-manual-controls','pass','pass');});
test('CONTROL schema conflict is exact timestamp whereas read key uses day',async()=>{const db=sdk(),add=realMethod('addExpense',db);await add(two[0]);await add({...two[1],date:day+'T16:20:00.000Z'});assert.equal(db.rows.length,2);record('distinct-timestamp-schema-model',db.rows.length,2);});

after(()=>{const result={schema:1,baseSHA:'a9916c3cdb21c93f9d3a47653c0608e630ce50ab',fixedNow:'2026-10-17T12:00:00.000Z',fixture:'synthetic, 250 cents per bank; exact-cent expectation500',sourceMode:'assembled in memory from exact src/build-order.json plus shell; no build or product mutation',sourceHashes:Object.fromEntries(['AGENTS.md','EMPIEZA-AQUI.md','src/modules/00-core.js','src/modules/08-motor-bank.js','src/modules/11-app-main.js','supabase/functions/_shared/presupuesto.ts','supabase/migrations/0001_init.sql'].map(f=>[f,crypto.createHash('sha256').update(read(f)).digest('hex')])),observations:observation,limits:['No live SQL, database, bank connection, network or Deno run','Node native type stripping executes actual presupuesto.ts','No product changes or mutations; these are baseline causal RED tests','No UI/browser/mobile validation','No FIN10 absorption or FIN11 tombstone changes or assertions']};if(process.env.FIN03_EVIDENCE_FILE)fs.writeFileSync(process.env.FIN03_EVIDENCE_FILE,JSON.stringify(result,null,2)+'\n');else console.log(JSON.stringify(result));});
