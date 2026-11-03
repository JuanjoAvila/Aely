/** PRO-09: solo investigación privada. No implementa ni instala el diseño propuesto. */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {stripTypeScriptTypes} from 'node:module';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../../..');
const base='a9916c3cdb21c93f9d3a47653c0608e630ce50ab';
execFileSync('git',['merge-base','--is-ancestor',base,'HEAD'],{cwd:root});
const files=new Map();
const read=p=>{
 const s=fs.readFileSync(path.join(root,p),'utf8');
 if(!process.argv.includes('--against-working-tree')){
  const original=execFileSync('git',['show',base+':'+p],{cwd:root,encoding:'utf8'});
  assert.equal(s.replace(/\r\n/g,'\n'),original.replace(/\r\n/g,'\n'),'fuente funcional distinta de la base: '+p);
 }
 files.set(p,createHash('sha256').update(s).digest('hex'));return s;
};
const stripImports=s=>s.replace(/^import\s[\s\S]*?from\s+"[^"]+";\r?\n/gm,'');
async function pure(p){const js=stripTypeScriptTypes(read(p));return import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));}
const logic=await pure('supabase/functions/_shared/ingest_logic.ts');
const wallet=await pure('supabase/functions/_shared/wallet.ts');
const identity=await pure('supabase/functions/_shared/ingest_identity.ts');
const budget=await pure('supabase/functions/_shared/presupuesto.ts');
const entrada=await pure('supabase/functions/_shared/entrada.ts');
const widgetSource=stripImports(read('supabase/functions/ingest/widget.ts'));
const widgetNames=[...widgetSource.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)].map(m=>m[1]);
const widget=new Function(...Object.keys(budget),stripTypeScriptTypes(widgetSource).replace(/\bexport\s+/g,'')+';return {'+widgetNames.join(',')+'};')(...Object.values(budget));
const handlerJs=stripTypeScriptTypes(stripImports(read('supabase/functions/ingest/index.ts')));
// Se reutiliza el mock del repo, no una copia de su lógica financiera. Simula solo el Data API.
const fixture=read('tests/helpers/ingest-handler-fixture.mjs');
const fakeBlock=fixture.slice(fixture.indexOf('function fakeDb('),fixture.indexOf('\nfunction makeHandler('));
assert.ok(fakeBlock.startsWith('function fakeDb('));
const fakeDb=new Function(fakeBlock+';return fakeDb;')();
function handler(db,classification=logic.clasificarConMotivo){
 let result;
 const deno={serve:f=>{result=f;},env:{get:k=>({SUPABASE_URL:'https://db.invalid',SUPABASE_SERVICE_ROLE_KEY:'synthetic-role',INGEST_TOKEN:'synthetic-token',INGEST_USER_ID:'user'})[k]||''}};
 const deps={...logic,...wallet,...identity,...budget,...widget,...entrada,Deno:deno,createClient:()=>db,clasificarConMotivo:classification,bucketKey:async()=> 'synthetic-bucket',callerIp:()=> '127.0.0.1',rateLimit:async()=>({ok:true})};
 new Function(...Object.keys(deps),handlerJs)(...Object.values(deps));return result;
}
async function post(env,body,classification){
 const response=await handler(env.db,classification)(new Request('https://app.invalid/ingest',{method:'POST',headers:{'x-ingest-token':'synthetic-token','content-type':'application/json'},body:JSON.stringify(body)}));
 return {status:response.status,data:await response.json()};
}
const {createLogicSandbox}=await import(pathToFileURL(path.join(root,'scripts/load-pure-logic.mjs')));
const NOW=Date.parse(process.argv.includes('--posted-boundary-only')?'2026-10-23T12:00:00Z':'2026-10-17T12:00:00Z');
class FixedDate extends Date {constructor(...a){super(...(a.length?a:[NOW]));}static now(){return NOW;}}
const client=createLogicSandbox({Date:FixedDate});vm.createContext(client);
// No se evalúa 09 ni la hoja de edición de Deudas/Metas. Tampoco se construye public/index.html.
for(const p of ['src/modules/00-core.js','src/modules/01-i18n.js','src/modules/08-motor-bank.js']) vm.runInContext(read(p),client,{filename:p});
const clone=x=>JSON.parse(JSON.stringify(x));
const state=(expenses=[])=>({accounts:[{id:'synthetic-tr',ent:'trade_republic',role:'diario',spendFrom:true,value:1000}],settings:{expenseBanks:['trade_republic']},expenses,gemelos:[],fixed:[],debts:[],oneoffs:[],flows:[],deleted:[],budget:100,investments:[]});
const notify=(extra={})=>({fuente:'tr',titulo:'Round up Invertido',texto:'Se han invertido 0,42 € en Fondo Sintetico',fecha:String(Date.parse('2026-10-16T10:00:00.000Z')),evento:'v1_synthetic_roundup',...extra});
const bank=(extra={})=>({ent:'trade_republic',id:'synthetic-roundup-ref',date:'2026-10-17',amount:0.42,merchant:'Round up Invertido',status:'BOOK',acc:'synthetic-acc',...extra});
const sync=(s,txs)=>{const add=client.importObExpenses(s,txs,[{aspsp:'Trade Republic',syncFrom:'2026-01-01'}])||[];return client.reconcileGemelosAutomaticos({...s,expenses:add.concat(s.expenses),gemelos:client.pushGemelos(s.gemelos,client.gemelosDeImportacion(add,s.expenses))});};
const wire=e=>({id:e.id,user_id:'user',fecha:e.date,importe:e.amount,comercio:e.merchant,source:client.expenseSourceForCloud(e),cat:e.category,no_card:!!e.noCard,ob_name:e.obName});
const fromCloud=rows=>rows.map(r=>client.expenseFromRow(r));
const counted=s=>s.expenses.filter(e=>!e.autoGemelo&&!e.possibleDup);
const cents=rows=>rows.reduce((n,r)=>n+Math.round(Number(r.amount??r.importe)*100),0);

export {here,root,base,files,read,logic,wallet,identity,budget,entrada,handlerJs,fakeDb,handler,post,client,clone,state,notify,bank,sync,wire,fromCloud,counted,cents};
