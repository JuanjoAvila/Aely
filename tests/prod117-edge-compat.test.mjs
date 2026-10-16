import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {transformSync} from 'esbuild';
import {loadPureLogicFromFile} from '../scripts/load-pure-logic.mjs';

// El inventario del12/10 cotejó estos bytes con get_edge_function, sin invocar bancos
// ni proveedores. Reproducir el handler desplegado evita probar sólo la fuente futura.
const root=new URL('../',import.meta.url),read=f=>fs.readFileSync(new URL(f,root),'utf8');
const pin=(sha,file,digest)=>{
  const source=execFileSync('git',['show',sha+':'+file],{encoding:'utf8',maxBuffer:8e6}).replace(/\r\n/g,'\n');
  assert.equal(createHash('sha256').update(source).digest('hex'),digest,file+': fuente desplegada inventariada');return source;
};
const beta='c5f62d6603d016150afd9d0e20547b608b323045';
const hashes={ingest_logic:'f5c7c67d41944626de675d725b8b4f7c13749dd9068ce06050495df0c84f9f01',wallet:'d544b3ccf08d64314cb5c6300f714e73520a37092cacc705474bb87d9905a556',ingest_identity:'709e62a263e606528114df16bf036c4d194888496ed64910744bbe08ab6825af',presupuesto:'26a5d0c7c7bea905d14a9dcf499fede9a86ebda4917c63bd88fef90ba8489df1',entrada:'dbe7eb539017d435bf4207dbb74cae644e034ac4c66dbdef79af9f357d1bf00f'};
const mods={};
for(const [name,hash] of Object.entries(hashes)){
  const source=pin(beta,'supabase/functions/_shared/'+name+'.ts',hash);
  mods[name]=await import('data:text/javascript;base64,'+Buffer.from(transformSync(source,{loader:'ts',format:'esm'}).code).toString('base64'));
}
const strip=s=>s.replace(/^import\s[\s\S]*?from\s+"[^"]+";\r?\n/gm,'');
const deployedIngest=pin('8bda23a5d80e40a65111c58fd92d52e1b8215e73','supabase/functions/ingest/index.ts','744c67c8008da2075b857c129be605b9d8553dd1142911f22803a2f05281c2c8');
const handlerJs=transformSync(strip(deployedIngest),{loader:'ts'}).code;
// Reusar exactamente el doble de BD/SDK del handler vigente, sin ejecutar su suite ni duplicarlo.
const harness=read('tests/helpers/ingest-handler-fixture.mjs'),start=harness.indexOf('function fakeDb('),end=harness.indexOf('export {',start);
assert.ok(start>0&&end>start,'límites del fixture existente');
const {fakeDb,post}=new Function('handlerJs','logic','wallet','identity','budget','entrada','widgetBudget',harness.slice(start,end)+'\nreturn {fakeDb,post};')(
  handlerJs,mods.ingest_logic,mods.wallet,mods.ingest_identity,mods.presupuesto,mods.entrada,{});
const now=Date.now(),state={budget:100,accounts:[{ent:'trade_republic',role:'diario',spendFrom:true}],settings:{budgetCycle:true}};
const env=fakeDb({state});
const body={fuente:'tr',titulo:'Trade Republic',texto:'Has gastado 5,45 € en Compra sintética',fecha:String(now),evento:'compat-v50'};
const first=await post(env,body),repeat=await post(env,body);
assert.equal(first.status,200);assert.equal(first.data.ok,true);assert.ok(first.data.ack);
assert.equal(Object.hasOwn(first.data,'widget'),false,'v50 conserva sólo month, sin fingir despliegue v2');
assert.equal(first.data.month.spent,5.45);assert.equal(first.data.month.shownDelta,5.45);assert.equal(first.data.month.againstDelta,5.45);
assert.equal(first.data.month.cashCounts,1);assert.equal(first.data.month.eventKey,'tr:trade_republic:compat-v50');
assert.equal(repeat.data.skipped,true);assert.equal(repeat.data.ack,first.data.ack);assert.equal(env.rows.length,1);
const cli=loadPureLogicFromFile(),expense=cli.expenseFromRow(env.rows[0]);
assert.equal(expense.amount,5.45);assert.equal(expense.id,first.data.ack);assert.equal(expense.source,"macrodroid");assert.equal(expense.ent,"trade_republic");
const failed=await post(fakeDb({state,monthReadError:true}),{...body,evento:'compat-failure'});
assert.equal(failed.status,200);assert.equal(failed.data.month,null,'sin lectura no inventar cero');
console.log('PASS ingest v50 desplegado: ACK/dedup, month legacy, lectura fallida y consumidor web actual; sin transporte real');

const pricesSha='45800cdbc9c16df51342f4331bff8a042e4171a1';
const pricesSource=pin(pricesSha,'supabase/functions/prices/index.ts','518eb75a246363d33d7333f36174c9c1efd374bffd906f3b9122bf69094480b1');
const corsSource=pin(pricesSha,'supabase/functions/_shared/cors.ts','108cbae910f3347e3f1020fe0fddedcec7b9a4b15e31613d9f962323bc19bce1');
let handler;const calls=[];
const Deno={serve:f=>{handler=f;},env:{get:()=>''}};
const corsModule={exports:{}};
new Function('Deno','module','exports',transformSync(corsSource,{loader:'ts',format:'cjs'}).code)(Deno,corsModule,corsModule.exports);
const provider=async url=>{
  calls.push(String(url));assert.ok(String(url).startsWith('https://query1.finance.yahoo.com/v8/finance/chart/'));
  const sym=decodeURIComponent(new URL(url).pathname.split('/').pop());
  return Response.json({chart:{result:[{meta:{regularMarketPrice:sym==='NVDA'?123.45:sym==='GC=F'?2345.67:0}}]}});
};
new Function('Deno','withCors','fetch',transformSync(strip(pricesSource),{loader:'ts'}).code)(Deno,corsModule.exports.withCors,provider);
const core=read('src/modules/00-core.js'),a=core.indexOf('    async prices(symbols){'),b=core.indexOf('    // IA / KW:',a);
assert.ok(a>0&&b>a,'método prices real del cliente');
const invocation=[];
const sb={functions:{invoke:async(name,opts)=>{
  invocation.push({name,opts});assert.equal(name,'prices');
  const response=await handler(new Request('https://edge.invalid/prices',{method:'POST',headers:{origin:'https://localhost','content-type':'application/json'},body:JSON.stringify(opts?.body||{})}));
  assert.equal(response.headers.get('access-control-allow-origin'),'https://localhost');
  return {data:await response.json(),error:null};
}}};
const cloud=new Function('sb','return {'+core.slice(a,b)+'};')(sb);
const prices=await cloud.prices(['NVDA','GOLD','MISSING']);
assert.deepEqual(invocation[0].opts.body,{symbols:['NVDA','GOLD','MISSING']});
assert.equal(prices.ok,true);assert.deepEqual(prices.prices,{NVDA:123.45,GOLD:2345.67});
assert.equal(Object.hasOwn(prices.prices,'MISSING'),false,'cotización ausente nunca cero inventado');
assert.equal(prices.errors[0].sym,'MISSING');assert.equal(calls.length,3);
const broken=new Function('sb','return {'+core.slice(a,b)+'};')({functions:{invoke:async()=>({data:null,error:Error('synthetic offline')})}});
await assert.rejects(()=>broken.prices(['NVDA']),/synthetic offline/);
console.log('PASS prices v13 desplegado: llamada web real, CORS APK, respuesta numérica/ausencia/error; proveedores sintéticos');
