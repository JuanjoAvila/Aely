// Reproduce el transporte real: una copia local antigua no es la fuente de source.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadPureLogicFromFile } from '../scripts/load-pure-logic.mjs';

const c=loadPureLogicFromFile();
const core=fs.readFileSync(new URL('../src/modules/00-core.js',import.meta.url),'utf8');
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const id='550e8400-e29b-41d4-a716-446655440001';
const other='550e8400-e29b-41d4-a716-446655440002';
const owner='fixture-owner';
const expense={id,source:'ob',ent:'trade_republic',possibleDup:true};
function method(name,args){
  const marker='async '+name+'('+args+'){',start=core.indexOf(marker);
  assert(start>=0,name);
  const end=core.indexOf('\n    },',start);
  const run=new AsyncFunction('sb','expenseSourceForCloud','expenseCloudEq','isExpenseUuid',
    'writeExpenseSourceField',...args.split(',').map(s=>s.trim()),core.slice(start+marker.length,end));
  return (sb,...values)=>run(sb,c.expenseSourceForCloud,c.expenseCloudEq,c.isExpenseUuid,
    c.writeExpenseSourceField,...values);
}
const bank=method('setExpenseBank','e, ent'),dup=method('setExpenseDup','e, isDup');
function database(source='ob:trade_republic#dup',options={}){
  const row={id,user_id:owner,source,cat:'bares',nota:'conservar'};
  const calls=[];let sessions=0,updates=0;
  const sb={auth:{getSession:async()=>({data:{session:options.noSession?null:
    {user:{id:options.switchUser&&++sessions>1?'other-owner':owner}}}})},from(table){
    assert.equal(table,'expenses');const filters=[];let patch=null;
    const q={select(){return this},update(p){patch=p;return this},
      eq(k,v){filters.push([k,v]);return this},is(k,v){filters.push([k,v]);return this},
      maybeSingle(){return this},then(resolve,reject){
        return Promise.resolve().then(()=>{
          calls.push({patch,filters});
          if(patch){updates++;if(options.beforeUpdate)options.beforeUpdate(row,updates);}
          if(options.error)return {data:null,error:new Error('transport failed')};
          const matches=!options.missing&&filters.every(([k,v])=>row[k]===v);
          if(!matches||options.zeroAck&&patch)return {data:null,error:null};
          if(patch)Object.assign(row,patch);
          return {data:{id:options.badAck&&patch?other:row.id,source:row.source},error:null};
        }).then(resolve,reject);
      }};
    return q;
  }};
  return {sb,row,calls};
}
let failures=0,passed=0;
async function test(name,run){try{await run();passed++;console.log('  OK '+name);}
  catch(e){failures++;console.error('  FAIL '+name+': '+e.message);}}

await test('banco conserva decisión remota resuelta pese a copia local pendiente',async()=>{
  const d=database('ob:trade_republic');const ack=await bank(d.sb,expense,'revolut');
  assert.equal(d.row.source,'ob:revolut');assert.equal(ack.id,id);assert.equal(ack.source,d.row.source);
  assert.equal(d.row.cat,'bares');assert.equal(d.row.nota,'conservar');
});
await test('decisión conserva banco remoto cambiado pese a copia local antigua',async()=>{
  const d=database('ob:revolut#dup');await dup(d.sb,expense,false);assert.equal(d.row.source,'ob:revolut');
});
await test('carrera entre lectura y UPDATE relee source y no repone #dup',async()=>{
  const d=database(undefined,{beforeUpdate(row,n){if(n===1)row.source='ob:trade_republic';}});
  await bank(d.sb,expense,'revolut');assert.equal(d.row.source,'ob:revolut');
  assert.equal(d.calls.filter(x=>x.patch).length,2);
});
await test('carrera al resolver mantiene el cambio de banco concurrente',async()=>{
  const d=database(undefined,{beforeUpdate(row,n){if(n===1)row.source='ob:revolut#dup';}});
  await dup(d.sb,expense,false);assert.equal(d.row.source,'ob:revolut');
});
await test('sin cliente ni sesión no se confirma',async()=>{
  await assert.rejects(()=>dup(null,expense,false));
  const d=database(undefined,{noSession:true});await assert.rejects(()=>dup(d.sb,expense,false));
  assert.equal(d.calls.length,0);
});
await test('UUID ausente en nube no se sustituye por un gemelo',async()=>{
  const d=database(undefined,{missing:true});await assert.rejects(()=>dup(d.sb,expense,false));
  assert.equal(d.calls.filter(x=>x.patch).length,0);
});
await test('UPDATE cero filas agota reintentos sin anunciar ACK',async()=>{
  const d=database(undefined,{zeroAck:true});await assert.rejects(()=>dup(d.sb,expense,false));
  assert.equal(d.calls.filter(x=>x.patch).length,3);
});
await test('ACK con otro UUID no se acepta',async()=>{
  const d=database(undefined,{badAck:true});await assert.rejects(()=>dup(d.sb,expense,false));
});
await test('cada consulta restringe usuario e identidad exacta',async()=>{
  const d=database();await dup(d.sb,expense,false);
  for(const q of d.calls){assert(q.filters.some(([k,v])=>k==='user_id'&&v===owner));
    assert(q.filters.some(([k,v])=>k==='id'&&v===id));assert(!q.filters.some(([k])=>k==='fecha'));}
  const write=d.calls.find(x=>x.patch);assert(write.filters.some(([k,v])=>k==='source'&&v==='ob:trade_republic#dup'));
});
await test('cambio de sesión antes de escribir cancela la operación',async()=>{
  const d=database(undefined,{switchUser:true});await assert.rejects(()=>dup(d.sb,expense,false));
  assert.equal(d.calls.filter(x=>x.patch).length,0);
});
await test('error de transporte se propaga sin éxito sintético',async()=>{
  const d=database(undefined,{error:true});await assert.rejects(()=>dup(d.sb,expense,false),/transport failed/);
});
await test('misma decisión ya confirmada devuelve ACK sin UPDATE',async()=>{
  const d=database('ob:trade_republic');const ack=await dup(d.sb,expense,false);
  assert.equal(ack.id,id);assert.equal(d.calls.filter(x=>x.patch).length,0);
});
await test('fuente desconocida no se reconstruye desde copia local',async()=>{
  const d=database('provider-future:opaque');await assert.rejects(()=>bank(d.sb,expense,'revolut'));
  assert.equal(d.row.source,'provider-future:opaque');
});
await test('manual sin banco admite quitar/poner banco sin cambiar de origen',async()=>{
  const d=database('manual:revolut');await bank(d.sb,{...expense,source:'manual'},null);
  assert.equal(d.row.source,'manual');await bank(d.sb,{...expense,source:'manual'},'sabadell');
  assert.equal(d.row.source,'manual:sabadell');
});
await test('otra edición concurrente del mismo banco no se pisa al reintentar',async()=>{
  const d=database('manual:trade_republic',{beforeUpdate(row,n){if(n===1)row.source='manual:sabadell';}});
  await assert.rejects(()=>bank(d.sb,{...expense,source:'manual'},'revolut'),/conflict/);
  assert.equal(d.row.source,'manual:sabadell');assert.equal(d.calls.filter(x=>x.patch).length,1);
});
await test('otra petición ya aplicó el mismo banco: ACK idempotente',async()=>{
  const d=database('manual:trade_republic',{beforeUpdate(row,n){if(n===1)row.source='manual:revolut';}});
  const ack=await bank(d.sb,{...expense,source:'manual'},'revolut');
  assert.equal(ack.source,'manual:revolut');assert.equal(d.calls.filter(x=>x.patch).length,1);
});
await test('source NULL del legado usa condición IS NULL, sin escribir por atributos',async()=>{
  const d=database(null);await bank(d.sb,{...expense,source:'manual'},'revolut');
  assert.equal(d.row.source,'manual:revolut');
  assert(d.calls.find(x=>x.patch).filters.some(([k,v])=>k==='source'&&v===null));
});
await test('banco no acepta un sufijo que inyecte una decisión',async()=>{
  const d=database('manual');await assert.rejects(()=>bank(d.sb,{...expense,source:'manual'},'revolut#dup'));
  assert.equal(d.row.source,'manual');assert.equal(d.calls.filter(x=>x.patch).length,0);
});
console.log('expense-source-ack: '+passed+' OK / '+failures+' FAIL');
process.exitCode=failures?1:0;
